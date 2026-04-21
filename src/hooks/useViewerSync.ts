// src/hooks/useViewerSync.ts
import { useEffect, useRef, useCallback, useMemo } from 'react';
import { useAppSelector, useAppDispatch } from '@/store/store';
import { makeSelectActiveColorRulesForSequenceIds, computeAuxiliaryCellColors } from '@/store/slices/colorRulesSelector';
import { selectPositionMapping } from '@/store/slices/sequence_registry';
import type { MsaSequence } from '@/store/slices/sequence_registry';
import { setHoveredChain } from '@/store/slices/chainFocusSlice';
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
    /** The full display sequences array (including auxiliaries) for auxiliary color computation */
    displaySequences?: Array<Pick<MsaSequence, 'id' | 'originType' | 'parentSequenceId' | 'layerType'>>;
    /** Maps auth_asym_id -> { chainKey, displayRow } for all structural chains in the MSA */
    chainRowMap?: Record<string, { chainKey: string; displayRow: number }>;
    /** Chain keys whose parent PDB row is expanded in the MSA. When expanded, the
     *  annotation overpaint is dropped from the principal row in the MSA so that the
     *  mono base colorscheme shows through; the aux rows below carry the colors.
     *  Molstar 3D overpaint is unaffected. */
    expandedChainKeys?: Set<string>;
    /** Called when a Molstar click selects a residue (single click) */
    onMolstarResidueSelect?: (chainKey: string, masterIdx: number, authSeqId: number) => void;
}

const selectRulesForVisible = makeSelectActiveColorRulesForSequenceIds();

export function useViewerSync({ chainKey, molstarInstance, msaRef, visibleSequenceIds, displaySequences, chainRowMap, expandedChainKeys, onMolstarResidueSelect }: UseViewerSyncOptions) {
    const dispatch = useAppDispatch();
    const colorRules = useAppSelector(state => selectRulesForVisible(state, visibleSequenceIds));
    const positionMapping = useAppSelector(state => selectPositionMapping(state, chainKey));
    const annotationChains = useAppSelector(state => state.annotations.chains);

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

    // Reverse mapping for hover coordination (primary chain)
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

    // All position mappings (must be declared before effects that use it)
    const allPositionMappings = useAppSelector(state => state.sequenceRegistry.positionMappings);

    // Reverse mappings for ALL chains keyed by auth_asym_id
    const chainRowMapRef = useRef(chainRowMap);
    chainRowMapRef.current = chainRowMap;

    const allAuthToMasterRef = useRef<Record<string, Record<number, number>>>({});
    useEffect(() => {
        const result: Record<string, Record<number, number>> = {};
        // Primary chain
        const primaryAuth = authAsymIdFromChainKey(chainKey);
        if (positionMapping) {
            const map: Record<number, number> = {};
            for (const [masterStr, authSeqId] of Object.entries(positionMapping)) {
                map[authSeqId] = parseInt(masterStr, 10);
            }
            result[primaryAuth] = map;
        }
        // Aligned chains
        for (const a of alignedStructuresRef.current) {
            const aKey = makeChainKey(a.sourcePdbId, a.sourceChainId);
            const aMapping = allPositionMappings[aKey];
            if (aMapping) {
                const map: Record<number, number> = {};
                for (const [masterStr, authSeqId] of Object.entries(aMapping)) {
                    map[authSeqId] = parseInt(masterStr, 10);
                }
                result[a.sourceChainId] = map;
            }
        }
        allAuthToMasterRef.current = result;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [positionMapping, chainKey, alignedIds, allPositionMappings]);

    // Aligned chain position mappings -- stable via useMemo
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
    // Color Sync Effect (debounced + serialized)
    // ============================================================

    const colorSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const colorSyncInFlightRef = useRef(false);
    const colorSyncPendingRef = useRef(false);

    // Snapshot refs so the async function always reads the latest values
    const colorRulesRef = useRef(colorRules);
    colorRulesRef.current = colorRules;
    const chainKeyRef = useRef(chainKey);
    chainKeyRef.current = chainKey;
    const molstarRef = useRef(molstarInstance);
    molstarRef.current = molstarInstance;

    const runColorSync = useCallback(async () => {
        if (colorSyncInFlightRef.current) {
            // Another sync is running; mark pending so it re-runs when done
            colorSyncPendingRef.current = true;
            return;
        }

        colorSyncInFlightRef.current = true;
        colorSyncPendingRef.current = false;

        try {
            const rules = colorRulesRef.current;
            const instance = molstarRef.current;
            const ck = chainKeyRef.current;
            if (!instance) return;

            // --- Primary chain Molstar colors ---
            const primaryRules = rules.filter(r => r.chainKey === ck);
            const primaryColorings = primaryRules.flatMap(rule =>
                rule.residues.map(r => ({
                    chainId: r.chainId,
                    authSeqId: r.authSeqId,
                    color: Color(parseInt(rule.color.replace('#', ''), 16)),
                }))
            );

            if (primaryColorings.length > 0) {
                await instance.applyColorscheme('annotations', primaryColorings);
            } else {
                await instance.restoreDefaultColors();
            }

            // --- Aligned chain Molstar colors (serialized) ---
            const currentAligned = alignedStructuresRef.current;
            const alignedRulesByKey = new Map<string, typeof rules>();
            for (const rule of rules) {
                if (rule.chainKey === ck) continue;
                const existing = alignedRulesByKey.get(rule.chainKey) ?? [];
                existing.push(rule);
                alignedRulesByKey.set(rule.chainKey, existing);
            }

            for (const a of currentAligned) {
                const aKey = makeChainKey(a.sourcePdbId, a.sourceChainId);
                const aRules = alignedRulesByKey.get(aKey);
                if (!aRules) {
                    await instance.clearAlignedOverpaint(a.targetChainId, a.id);
                } else {
                    const colorings = aRules.flatMap(rule =>
                        rule.residues.map(r => ({
                            chainId: r.chainId,
                            authSeqId: r.authSeqId,
                            color: Color(parseInt(rule.color.replace('#', ''), 16)),
                        }))
                    );
                    await instance.applyColorschemeToAligned(a.targetChainId, a.id, colorings);
                }
            }
        } catch (err) {
            console.error('[useViewerSync] Color sync error:', err);
        } finally {
            colorSyncInFlightRef.current = false;

            // If another update came in while we were working, run again
            if (colorSyncPendingRef.current) {
                colorSyncPendingRef.current = false;
                runColorSync();
            }
        }
    }, []); // stable -- reads everything from refs

    useEffect(() => {
        if (colorSyncTimerRef.current) clearTimeout(colorSyncTimerRef.current);

        // Apply MSA cell colors immediately -- this is cheap
        if (msaRef.current) {
            const cellColors: Record<string, string> = {};

            // Primary row colors from color rules.
            // When a chain's parent row is expanded in the MSA, skip painting its principal
            // row -- the aux rows below carry the annotation colors, and the principal stays
            // under the base mono colorscheme. Molstar 3D overpaint is unaffected (see below).
            for (const rule of colorRules) {
                if (expandedChainKeys?.has(rule.chainKey)) continue;
                for (const cell of rule.msaCells) {
                    cellColors[`${cell.row}-${cell.column}`] = rule.color;
                }
            }

            // Auxiliary row colors
            if (displaySequences) {
                const auxColors = computeAuxiliaryCellColors(displaySequences, annotationChains);
                Object.assign(cellColors, auxColors);
            }

            if (Object.keys(cellColors).length > 0) {
                msaRef.current.applyCellColors(cellColors);
            } else {
                msaRef.current.clearPositionColors();
            }
        }

        // Debounce + serialize the expensive Molstar operations
        colorSyncTimerRef.current = setTimeout(() => {
            runColorSync();
        }, 80);

        return () => {
            if (colorSyncTimerRef.current) clearTimeout(colorSyncTimerRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [colorRules, molstarInstance, msaRef, chainKey, alignedIds, displaySequences, annotationChains, expandedChainKeys]);

    // ============================================================
    // Click handlers
    // ============================================================

    const windowMaskTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastClickTimeRef = useRef<number>(0);
    const lastClickInfoRef = useRef<{ chainId: string; authSeqId: number } | null>(null);
    const DOUBLE_CLICK_MS = 300;

    const onMolstarResidueSelectRef = useRef(onMolstarResidueSelect);
    onMolstarResidueSelectRef.current = onMolstarResidueSelect;

    // Single click in Molstar: select the residue (MSA + Molstar)
    const handleMolstarSingleClick = useCallback((chainId: string, authSeqId: number) => {
        const reverseMap = allAuthToMasterRef.current[chainId];
        if (!reverseMap) return;
        const masterIdx = reverseMap[authSeqId];
        if (masterIdx === undefined) return;

        const rowInfo = chainRowMapRef.current?.[chainId];
        const ck = rowInfo?.chainKey ?? makeChainKey('', chainId);
        onMolstarResidueSelectRef.current?.(ck, masterIdx, authSeqId);
    }, []);

    // Track visible MSA range for skip-if-visible logic
    const visibleRangeRef = useRef<[number, number] | null>(null);

    // Double click in Molstar: focus camera + MSA range adjustment (only if off-screen)
    const handleMolstarDoubleClick = useCallback((chainId: string, authSeqId: number) => {
        const reverseMap = allAuthToMasterRef.current[chainId];
        const masterIdx = reverseMap?.[authSeqId];

        if (masterIdx !== undefined && msaRef.current) {
            const range = visibleRangeRef.current;
            const MARGIN = 3;
            const isVisible = range && masterIdx >= range[0] + MARGIN && masterIdx <= range[1] - MARGIN;
            if (!isVisible) {
                const WINDOW = 15;
                msaRef.current.jumpToRange(Math.max(1, masterIdx - WINDOW), masterIdx + WINDOW);
            }
        }

        // Camera focus
        molstarInstance?.focusResidue(chainId, authSeqId);
    }, [molstarInstance, msaRef]);

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

    // Track last hovered Molstar residue for context menu
    const lastHoveredMolstarResidueRef = useRef<{ chainId: string; authSeqId: number; masterIdx: number; position3d?: [number, number, number]; pageCoords?: [number, number] } | null>(null);

    const handleMolstarHover = useCallback((chainId: string, authSeqId: number, position3d?: [number, number, number], pageCoords?: [number, number]) => {
        // Look up masterIdx from any chain's reverse mapping
        const reverseMap = allAuthToMasterRef.current[chainId];
        if (!reverseMap) return;
        const masterIdx = reverseMap[authSeqId];
        if (masterIdx === undefined || !msaRef.current) return;

        lastHoveredMolstarResidueRef.current = { chainId, authSeqId, masterIdx, position3d, pageCoords };

        // Look up the display row for this chain
        const rowInfo = chainRowMapRef.current?.[chainId];
        if (rowInfo && rowInfo.displayRow >= 0) {
            // Crosshair: dim column + bold cell
            msaRef.current.setCrosshairHighlight(rowInfo.displayRow, masterIdx - 1);
            // Highlight the label row
            dispatch(setHoveredChain(rowInfo.chainKey));
        } else {
            // Fallback: column-only highlight (chain not visible in MSA)
            msaRef.current.setHighlight(masterIdx, masterIdx);
        }
    }, [msaRef, dispatch]);

    const handleMolstarHoverEnd = useCallback(() => {
        msaRef.current?.clearHighlight();
        dispatch(setHoveredChain(null));
        lastHoveredMolstarResidueRef.current = null;
    }, [msaRef, dispatch]);

    const handleMSAHover = useCallback((seqId: string, position: number) => {
        if (!molstarInstance) return;
        // Master/custom sequences have no 3D representation
        if (!seqId || seqId.startsWith('master__')) return;

        const candidateChainKey = seqId; // PDB seq id IS the chainKey
        const mapping = candidateChainKey === chainKey
            ? positionMapping
            : allPositionMappings[candidateChainKey] ?? null;
        if (!mapping) return;

        const authSeqId = mapping[position + 1];
        if (authSeqId === undefined) return;

        if (candidateChainKey === chainKey) {
            // Primary chain
            const authAsymId = authAsymIdFromChainKey(chainKey);
            molstarInstance.highlightResidue(authAsymId, authSeqId, true);
        } else {
            // Aligned chain
            const alignedInfo = alignedByChainKey.current[candidateChainKey];
            if (alignedInfo) {
                molstarInstance.highlightAlignedResidue(
                    alignedInfo.targetChainId,
                    alignedInfo.id,
                    alignedInfo.sourceChainId,
                    authSeqId,
                    true
                );
            }
        }
    }, [molstarInstance, positionMapping, chainKey, allPositionMappings]);

    const handleMSAHoverEnd = useCallback(() => {
        molstarInstance?.clearHighlight();
    }, [molstarInstance]);

    useEffect(() => {
        if (!molstarInstance?.viewer) return;
        const unsubscribe = molstarInstance.viewer.subscribeToHover((info) => {
            if (info) handleMolstarHover(info.chainId, info.authSeqId, info.position3d, info.pageCoords);
            else handleMolstarHoverEnd();
        });
        return unsubscribe;
    }, [molstarInstance, handleMolstarHover, handleMolstarHoverEnd]);

    // ============================================================
    // Window Mask -- primary + aligned chains
    // ============================================================

    const handleDisplayRangeChange = useCallback((masterStart: number, masterEnd: number) => {
        visibleRangeRef.current = [masterStart, masterEnd];
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
        lastHoveredMolstarResidueRef,
    };
}