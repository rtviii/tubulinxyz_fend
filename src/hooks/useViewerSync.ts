// src/hooks/useViewerSync.ts
import { useEffect, useRef, useCallback, useMemo } from 'react';
import { useAppSelector } from '@/store/store';
import { makeSelectActiveColorRulesForSequenceIds } from '@/store/slices/colorRulesSelector';
import { selectPositionMapping } from '@/store/slices/sequence_registry';
import { MolstarInstance } from '@/components/molstar/services/MolstarInstance';
import { Color } from 'molstar/lib/mol-util/color';
import { MSAHandle } from '@/components/msa/types';
import { authAsymIdFromChainKey, makeChainKey } from '@/lib/chain_key';
import {
    selectActiveMonomerChainId,
    selectAlignedStructuresForActiveChain,
} from '@/components/molstar/state/selectors';

interface UseViewerSyncOptions {
    chainKey: string;
    molstarInstance: MolstarInstance | null;
    msaRef: React.RefObject<MSAHandle>;
    visibleSequenceIds: string[];
}

const selectRulesForVisible = makeSelectActiveColorRulesForSequenceIds();

export function useViewerSync({ chainKey, molstarInstance, msaRef, visibleSequenceIds }: UseViewerSyncOptions) {
    const colorRules = useAppSelector(state => selectRulesForVisible(state, visibleSequenceIds));
    const positionMapping = useAppSelector(state => selectPositionMapping(state, chainKey));

    const activeChainId = useAppSelector(state => selectActiveMonomerChainId(state, 'structure'));
    const alignedStructures = useAppSelector(state => selectAlignedStructuresForActiveChain(state, 'structure'));

    // Stable ref for aligned structures -- avoids infinite loop in effects
    const alignedStructuresRef = useRef(alignedStructures);
    alignedStructuresRef.current = alignedStructures;

    // Stable string key that genuinely changes only when the set of aligned structures changes
    const alignedIds = useMemo(
        () => alignedStructures.map(a => a.id).sort().join(','),
        [alignedStructures]
    );

    // Lookup: chainKey -> aligned structure info
    const alignedByChainKey = useRef<Record<string, { id: string; targetChainId: string; sourceChainId: string }>>({});
    useEffect(() => {
        const map: Record<string, { id: string; targetChainId: string; sourceChainId: string }> = {};
        for (const a of alignedStructures) {
            const key = makeChainKey(a.sourcePdbId, a.sourceChainId);
            map[key] = { id: a.id, targetChainId: a.targetChainId, sourceChainId: a.sourceChainId };
        }
        alignedByChainKey.current = map;
    }, [alignedIds]); // eslint-disable-line react-hooks/exhaustive-deps

    // Reverse mapping for hover coordination
    const authToMasterRef = useRef<Record<number, number>>({});
    useEffect(() => {
        const map: Record<number, number> = {};
        if (positionMapping) {
            for (const [masterStr, authSeqId] of Object.entries(positionMapping)) {
                map[authSeqId] = parseInt(masterStr, 10);
            }
        }
        authToMasterRef.current = map;
    }, [positionMapping]);

    // Aligned chain position mappings -- stable via useMemo
    const allPositionMappings = useAppSelector(state => state.sequenceRegistry.positionMappings);
    const alignedMappings = useMemo(() => {
        const result: Record<string, Record<number, number> | null> = {};
        for (const a of alignedStructuresRef.current) {
            const key = makeChainKey(a.sourcePdbId, a.sourceChainId);
            result[key] = allPositionMappings[key] ?? null;
        }
        return result;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [alignedIds, allPositionMappings]);

    // ============================================================
    // Color Sync Effect
    // ============================================================

    useEffect(() => {
        if (!molstarInstance) return;

        // --- MSA cell colors ---
        if (msaRef.current) {
            const cellColors: Record<string, string> = {};
            for (const rule of colorRules) {
                for (const cell of rule.msaCells) {
                    cellColors[`${cell.row}-${cell.column}`] = rule.color;
                }
            }
            if (Object.keys(cellColors).length > 0) {
                msaRef.current.applyCellColors(cellColors);
            } else {
                msaRef.current.clearPositionColors();
            }
        }

        // --- Primary chain Molstar colors ---
        const primaryRules = colorRules.filter(r => r.chainKey === chainKey);
        const primaryColorings = primaryRules.flatMap(rule =>
            rule.residues.map(r => ({
                chainId: r.chainId,
                authSeqId: r.authSeqId,
                color: Color(parseInt(rule.color.replace('#', ''), 16)),
            }))
        );

        if (primaryColorings.length > 0) {
            molstarInstance.applyColorscheme('annotations', primaryColorings);
        } else {
            molstarInstance.restoreDefaultColors();
        }

        // --- Aligned chain Molstar colors ---
        const currentAligned = alignedStructuresRef.current;
        const alignedRulesByKey = new Map<string, typeof colorRules>();
        for (const rule of colorRules) {
            if (rule.chainKey === chainKey) continue;
            const existing = alignedRulesByKey.get(rule.chainKey) ?? [];
            existing.push(rule);
            alignedRulesByKey.set(rule.chainKey, existing);
        }

        for (const a of currentAligned) {
            const aKey = makeChainKey(a.sourcePdbId, a.sourceChainId);
            const rules = alignedRulesByKey.get(aKey);
            if (!rules) {
                molstarInstance.clearAlignedOverpaint(a.targetChainId, a.id);
            } else {
                const colorings = rules.flatMap(rule =>
                    rule.residues.map(r => ({
                        chainId: r.chainId,
                        authSeqId: r.authSeqId,
                        color: Color(parseInt(rule.color.replace('#', ''), 16)),
                    }))
                );
                molstarInstance.applyColorschemeToAligned(a.targetChainId, a.id, colorings);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [colorRules, molstarInstance, msaRef, chainKey, alignedIds]);

    // ============================================================
    // Click handlers
    // ============================================================

    const windowMaskTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastClickTimeRef = useRef<number>(0);
    const lastClickInfoRef = useRef<{ chainId: string; authSeqId: number } | null>(null);
    const DOUBLE_CLICK_MS = 300;

    const handleMolstarSingleClick = useCallback((chainId: string, authSeqId: number) => {
        const masterIdx = authToMasterRef.current[authSeqId];
        if (masterIdx === undefined || !msaRef.current) return;
        const WINDOW = 25;
        msaRef.current.jumpToRange(Math.max(1, masterIdx - WINDOW), masterIdx + WINDOW);
    }, [msaRef]);

    const handleMolstarDoubleClick = useCallback((chainId: string, authSeqId: number) => {
        molstarInstance?.triggerNeighborhoodFocus(chainId, authSeqId);
    }, [molstarInstance]);

    useEffect(() => {
        if (!molstarInstance?.viewer) return;
        const unsubscribe = molstarInstance.viewer.subscribeToClick((info) => {
            if (!info) {
                molstarInstance.clearFocus();
                molstarInstance.viewer.resetCamera();
                return;
            }
            const now = Date.now();
            const last = lastClickTimeRef.current;
            const lastInfo = lastClickInfoRef.current;
            const isDoubleClick =
                now - last < DOUBLE_CLICK_MS &&
                lastInfo?.chainId === info.chainId &&
                lastInfo?.authSeqId === info.authSeqId;
            lastClickTimeRef.current = now;
            lastClickInfoRef.current = info;
            if (isDoubleClick) handleMolstarDoubleClick(info.chainId, info.authSeqId);
            else handleMolstarSingleClick(info.chainId, info.authSeqId);
        });
        return unsubscribe;
    }, [molstarInstance, handleMolstarSingleClick, handleMolstarDoubleClick]);

    // ============================================================
    // Hover Handlers
    // ============================================================

    const handleMolstarHover = useCallback((chainId: string, authSeqId: number) => {
        const masterIdx = authToMasterRef.current[authSeqId];
        if (masterIdx !== undefined && msaRef.current) {
            msaRef.current.setHighlight(masterIdx, masterIdx);
        }
    }, [msaRef]);

    const handleMolstarHoverEnd = useCallback(() => {
        msaRef.current?.clearHighlight();
    }, [msaRef]);

    const handleMSAHover = useCallback((position: number) => {
        if (!molstarInstance || !positionMapping) return;
        const authSeqId = positionMapping[position + 1];
        if (authSeqId !== undefined) {
            const authAsymId = authAsymIdFromChainKey(chainKey);
            molstarInstance.highlightResidue(authAsymId, authSeqId, true);
        }
    }, [molstarInstance, positionMapping, chainKey]);

    const handleMSAHoverEnd = useCallback(() => {
        molstarInstance?.clearHighlight();
    }, [molstarInstance]);

    useEffect(() => {
        if (!molstarInstance?.viewer) return;
        const unsubscribe = molstarInstance.viewer.subscribeToHover((info) => {
            if (info) handleMolstarHover(info.chainId, info.authSeqId);
            else handleMolstarHoverEnd();
        });
        return unsubscribe;
    }, [molstarInstance, handleMolstarHover, handleMolstarHoverEnd]);

    // ============================================================
    // Window Mask -- primary + aligned chains
    // ============================================================

    const handleDisplayRangeChange = useCallback((masterStart: number, masterEnd: number) => {
        if (!molstarInstance) return;

        if (windowMaskTimerRef.current) clearTimeout(windowMaskTimerRef.current);
        windowMaskTimerRef.current = setTimeout(() => {
            // --- Primary chain ---
            if (positionMapping) {
                const authAsymId = authAsymIdFromChainKey(chainKey);
                const visibleFromMapping = Object.entries(positionMapping)
                    .filter(([masterStr]) => {
                        const idx = parseInt(masterStr, 10);
                        return idx >= masterStart && idx <= masterEnd;
                    })
                    .map(([, authSeqId]) => authSeqId);

                if (visibleFromMapping.length === 0) {
                    molstarInstance.applyWindowMask(authAsymId, [], []);
                } else {
                    const mappedAuthSeqIds = new Set(Object.values(positionMapping));
                    const minVisible = Math.min(...visibleFromMapping);
                    const maxVisible = Math.max(...visibleFromMapping);
                    const unmappedAuthSeqIds = (molstarInstance.getObservedSequence(authAsymId)?.authSeqIds ?? [])
                        .filter(id => !mappedAuthSeqIds.has(id) && id >= minVisible && id <= maxVisible);

                    const visibleAuthSeqIds = [...visibleFromMapping, ...unmappedAuthSeqIds];
                    const visibleSet = new Set(visibleAuthSeqIds);
                    const pinnedAuthSeqIds = colorRules
                        .filter(r => r.chainKey === chainKey)
                        .flatMap(rule => rule.residues.filter(r => r.chainId === authAsymId).map(r => r.authSeqId))
                        .filter(id => visibleSet.has(id));

                    molstarInstance.applyWindowMask(authAsymId, visibleAuthSeqIds, pinnedAuthSeqIds);
                }
            }

            // --- Aligned chains ---
            const currentAligned = alignedStructuresRef.current;
            for (const a of currentAligned) {
                const aKey = makeChainKey(a.sourcePdbId, a.sourceChainId);
                const aMapping = alignedMappings[aKey];
                if (!aMapping) {
                    molstarInstance.clearWindowMaskForAligned(a.targetChainId, a.id);
                    continue;
                }

                const visibleFromMapping = Object.entries(aMapping)
                    .filter(([masterStr]) => {
                        const idx = parseInt(masterStr, 10);
                        return idx >= masterStart && idx <= masterEnd;
                    })
                    .map(([, authSeqId]) => authSeqId);

                const visibleSet = new Set(visibleFromMapping);
                const pinnedAuthSeqIds = colorRules
                    .filter(r => r.chainKey === aKey)
                    .flatMap(rule => rule.residues.map(r => r.authSeqId))
                    .filter(id => visibleSet.has(id));

                molstarInstance.applyWindowMaskToAligned(
                    a.targetChainId, a.id, a.sourceChainId,
                    visibleFromMapping, pinnedAuthSeqIds
                );
            }
        }, 40);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [molstarInstance, positionMapping, chainKey, colorRules, alignedIds, alignedMappings]);

    const clearWindowMask = useCallback(() => {
        if (!molstarInstance) return;
        if (windowMaskTimerRef.current) {
            clearTimeout(windowMaskTimerRef.current);
            windowMaskTimerRef.current = null;
        }
        const authAsymId = authAsymIdFromChainKey(chainKey);

        molstarInstance.clearWindowMask(authAsymId).then(() => {
            const primaryColorings = colorRules
                .filter(r => r.chainKey === chainKey)
                .flatMap(rule => rule.residues.map(r => ({
                    chainId: r.chainId,
                    authSeqId: r.authSeqId,
                    color: Color(parseInt(rule.color.replace('#', ''), 16)),
                })));
            if (primaryColorings.length > 0) {
                molstarInstance.applyColorscheme('annotations', primaryColorings);
            }
        });

        // Clear aligned masks too
        const currentAligned = alignedStructuresRef.current;
        for (const a of currentAligned) {
            molstarInstance.clearWindowMaskForAligned(a.targetChainId, a.id);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [molstarInstance, chainKey, colorRules, alignedIds]);

    // ============================================================
    // Navigation Actions
    // ============================================================

    const focusLigandSite = useCallback((siteId: string) => {
        const rule = colorRules.find(r => r.id === siteId);
        if (!rule || rule.msaCells.length === 0) return;
        const columns = rule.msaCells.map(c => c.column);
        msaRef.current?.jumpToRange(Math.min(...columns) + 1, Math.max(...columns) + 1);
        if (molstarInstance && rule.residues.length > 0) {
            const { chainId, authSeqId } = rule.residues[0];
            const lastResidue = rule.residues[rule.residues.length - 1];
            molstarInstance.focusResidueRange(chainId, authSeqId, lastResidue.authSeqId);
        }
    }, [colorRules, msaRef, molstarInstance]);

    const focusMutation = useCallback((masterIndex: number) => {
        msaRef.current?.jumpToRange(masterIndex, masterIndex);
        if (molstarInstance && positionMapping) {
            const authSeqId = positionMapping[masterIndex];
            if (authSeqId !== undefined) {
                molstarInstance.focusResidue(authAsymIdFromChainKey(chainKey), authSeqId);
            }
        }
    }, [msaRef, molstarInstance, positionMapping, chainKey]);

    return {
        handleMSAHover,
        handleMSAHoverEnd,
        focusLigandSite,
        focusMutation,
        handleDisplayRangeChange,
        clearWindowMask,
    };
}