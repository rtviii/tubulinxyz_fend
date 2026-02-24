// src/hooks/useViewerSync.ts
import { useEffect, useRef, useCallback } from 'react';
import { useAppSelector } from '@/store/store';
import { makeSelectActiveColorRulesForSequenceIds, selectActiveColorRules } from '@/store/slices/colorRulesSelector';
import { selectPositionMapping } from '@/store/slices/sequence_registry';
import { MolstarInstance } from '@/components/molstar/services/MolstarInstance';
import { Color } from 'molstar/lib/mol-util/color';
import { MSAHandle } from '@/components/msa/types';

function getAuthAsymIdFromKey(key: string): string {
  const noFamily = key.split('__')[0];
  const parts = noFamily.split('_');
  return parts[parts.length - 1];
}

interface UseViewerSyncOptions {
    chainKey: string;
    molstarInstance: MolstarInstance | null;
    msaRef: React.RefObject<MSAHandle>;
}
const selectRulesForVisible = makeSelectActiveColorRulesForSequenceIds();


export function useViewerSync({ chainKey, molstarInstance, msaRef, visibleSequenceIds }: UseViewerSyncOptions & { visibleSequenceIds: string[] }) {
  const colorRules = useAppSelector(state => selectRulesForVisible(state, visibleSequenceIds));
  const positionMapping = useAppSelector(state => selectPositionMapping(state, chainKey));
 
    // Build reverse mapping for hover coordination
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

    // ============================================================
    // Color Sync Effect
    // ============================================================

    useEffect(() => {
        if (!molstarInstance) return;

        // Apply to Molstar
        const molstarColorings = colorRules.flatMap(rule =>
            rule.residues.map(r => ({
                chainId: r.chainId,
                authSeqId: r.authSeqId,
                color: Color(parseInt(rule.color.replace('#', ''), 16)),
            }))
        );

        if (molstarColorings.length > 0) {
            molstarInstance.applyColorscheme('annotations', molstarColorings);
        } else {
            molstarInstance.restoreDefaultColors();
        }

        // Apply to MSA using cell colors (row-column specific)
        if (msaRef.current) {
            const cellColors: Record<string, string> = {};

            for (const rule of colorRules) {
                for (const cell of rule.msaCells) {
                    const key = `${cell.row}-${cell.column}`;
                    cellColors[key] = rule.color;
                }
            }

            console.log('[ViewerSync] Cell colors:', {
                colorCount: Object.keys(cellColors).length,
                sampleKeys: Object.keys(cellColors).slice(0, 5),
                sampleEntries: Object.entries(cellColors).slice(0, 5),
            });


            if (Object.keys(cellColors).length > 0) {
                msaRef.current.applyCellColors(cellColors);
            } else {
                msaRef.current.clearPositionColors();
            }
        }
    }, [colorRules, molstarInstance, msaRef]);

    // ============================================================
    // Hover Handlers
    // ============================================================

    // Called when Molstar hover occurs - highlight in MSA
    const handleMolstarHover = useCallback((chainId: string, authSeqId: number) => {
        const masterIdx = authToMasterRef.current[authSeqId];
        if (masterIdx !== undefined && msaRef.current) {
            // masterIdx is 1-based, setHighlight expects 1-based (it's for the highlight attribute)
            msaRef.current.setHighlight(masterIdx, masterIdx);
        }
    }, [msaRef]);

    const handleMolstarHoverEnd = useCallback(() => {
        msaRef.current?.clearHighlight();
    }, [msaRef]);

    // Called when MSA hover occurs - highlight in Molstar
    const handleMSAHover = useCallback((position: number) => {
        if (!molstarInstance || !positionMapping) return;
        // Nightingale sends 0-based position, positionMapping is keyed 1-based
        const authSeqId = positionMapping[position + 1];
        if (authSeqId !== undefined) {
            const authAsymId = getAuthAsymIdFromKey(chainKey);
            molstarInstance.highlightResidue(authAsymId, authSeqId, true);
        }
    }, [molstarInstance, positionMapping, chainKey]);

    const handleMSAHoverEnd = useCallback(() => {
        molstarInstance?.clearHighlight();
    }, [molstarInstance]);

    // ============================================================
    // Subscribe to Molstar hover events
    // ============================================================

    useEffect(() => {
        if (!molstarInstance?.viewer) return;

        const unsubscribe = molstarInstance.viewer.subscribeToHover((info) => {
            if (info) {
                handleMolstarHover(info.chainId, info.authSeqId);
            } else {
                handleMolstarHoverEnd();
            }
        });

        return unsubscribe;
    }, [molstarInstance, handleMolstarHover, handleMolstarHoverEnd]);

    // ============================================================
    // Navigation Actions
    // ============================================================

    const focusLigandSite = useCallback((siteId: string) => {
        const rule = colorRules.find(r => r.id === siteId);
        if (!rule || rule.msaCells.length === 0) return;

        const columns = rule.msaCells.map(c => c.column);
        const start = Math.min(...columns) + 1; // Convert to 1-based for jumpToRange
        const end = Math.max(...columns) + 1;

        msaRef.current?.jumpToRange(start, end);

        if (molstarInstance && rule.residues.length > 0) {
            const { chainId, authSeqId } = rule.residues[0];
            const lastResidue = rule.residues[rule.residues.length - 1];
            molstarInstance.focusResidueRange(chainId, authSeqId, lastResidue.authSeqId);
        }
    }, [colorRules, msaRef, molstarInstance]);

    const focusMutation = useCallback((masterIndex: number) => {
        // masterIndex is 1-based, jumpToRange expects 1-based
        msaRef.current?.jumpToRange(masterIndex, masterIndex);

        if (molstarInstance && positionMapping) {
            const authSeqId = positionMapping[masterIndex];
            if (authSeqId !== undefined) {
const authAsymId = getAuthAsymIdFromKey(chainKey);

                molstarInstance.focusResidue(authAsymId, authSeqId);
            }
        }
    }, [msaRef, molstarInstance, positionMapping, chainKey]);

    return {
        handleMSAHover,
        handleMSAHoverEnd,
        focusLigandSite,
        focusMutation,
    };
}