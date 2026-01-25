// src/hooks/useViewerSync.ts
import { useEffect, useRef, useCallback } from 'react';
import { useAppSelector } from '@/store/store';
import { selectActiveColorRules, ColorRule } from '@/store/slices/colorRulesSelector'
import { selectPositionMapping } from '@/store/slices/sequence_registry';
import { MolstarInstance } from '@/components/molstar/services/MolstarInstance';
import { Color } from 'molstar/lib/mol-util/color';

export interface MSAHandle {
  setHighlight: (start: number, end: number) => void;
  clearHighlight: () => void;
  jumpToRange: (start: number, end: number) => void;
  setColorScheme: (scheme: string) => void;
  applyPositionColors: (colors: Record<number, string>) => void;
  clearPositionColors: () => void;
}

interface UseViewerSyncOptions {
  chainKey: string;
  molstarInstance: MolstarInstance | null;
  msaRef: React.RefObject<MSAHandle>;
}

/**
 * Synchronizes viewer state with Redux annotation visibility.
 * 
 * Responsibilities:
 * - Apply color rules to Molstar when visibility changes
 * - Apply color rules to MSA when visibility changes  
 * - Coordinate hover events between viewers
 */
export function useViewerSync({ chainKey, molstarInstance, msaRef }: UseViewerSyncOptions) {
  const colorRules = useAppSelector(selectActiveColorRules);
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

    // Apply to MSA
    if (msaRef.current) {
      const positionColors: Record<number, string> = {};
      for (const rule of colorRules) {
        for (const pos of rule.msaPositions) {
          // Later rules override earlier ones (mutations over ligands)
          positionColors[pos] = rule.color;
        }
      }

      if (Object.keys(positionColors).length > 0) {
        msaRef.current.applyPositionColors(positionColors);
      } else {
        msaRef.current.clearPositionColors();
      }
    }
  }, [colorRules, molstarInstance, msaRef]);

  // ============================================================
  // Hover Handlers
  // ============================================================

  // Called when Molstar hover occurs
  const handleMolstarHover = useCallback((chainId: string, authSeqId: number) => {
    const masterIdx = authToMasterRef.current[authSeqId];
    if (masterIdx !== undefined && msaRef.current) {
      msaRef.current.setHighlight(masterIdx, masterIdx);
    }
  }, [msaRef]);

  const handleMolstarHoverEnd = useCallback(() => {
    msaRef.current?.clearHighlight();
  }, [msaRef]);

  // Called when MSA hover occurs
  const handleMSAHover = useCallback((position: number) => {
    if (!molstarInstance || !positionMapping) return;
    const authSeqId = positionMapping[position];
    if (authSeqId !== undefined) {
      // Extract chainId from chainKey
      const parts = chainKey.split('_');
      const authAsymId = parts[parts.length - 1];
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
    // Find the site in color rules
    const rule = colorRules.find(r => r.id === siteId);
    if (!rule || rule.msaPositions.length === 0) return;

    const start = Math.min(...rule.msaPositions);
    const end = Math.max(...rule.msaPositions);

    // Jump MSA
    msaRef.current?.jumpToRange(start, end);

    // Focus Molstar
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
        const parts = chainKey.split('_');
        const authAsymId = parts[parts.length - 1];
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