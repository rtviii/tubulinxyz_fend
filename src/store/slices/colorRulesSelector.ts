// src/store/slices/colorRulesSelector.ts
import { createSelector } from '@reduxjs/toolkit';
import { RootState } from '../store';
import { selectAnnotationsState } from './annotationsSlice';
import { selectPositionMappingsMap } from './sequence_registry';

export const MUTATION_COLOR = '#ff6b6b';

export interface ColorRule {
  id: string;
  type: 'ligand' | 'mutation';
  color: string;
  // For MSA
  msaPositions: number[];
  // For Molstar
  residues: Array<{ chainId: string; authSeqId: number }>;
}

/**
 * Derives active color rules from annotation visibility state.
 * This is the single source of truth for "what should be colored".
 */
export const selectActiveColorRules = createSelector(
  [
    (state: RootState) => state.annotations.chains,
    (state: RootState) => state.annotations.primaryChainKey,
    (state: RootState) => state.sequenceRegistry.positionMappings,
  ],
  (chains, primaryKey, positionMappings): ColorRule[] => {
    const rules: ColorRule[] = [];

    for (const [chainKey, entry] of Object.entries(chains)) {
      if (!entry.data) continue;

      const mapping = positionMappings[chainKey];
      const visibility = entry.visibility;

      // Build reverse map: authSeqId -> masterIndex
      const authToMaster: Record<number, number> = {};
      if (mapping) {
        for (const [masterStr, authSeqId] of Object.entries(mapping)) {
          authToMaster[authSeqId] = parseInt(masterStr, 10);
        }
      }

      // Parse chainId from chainKey (format: "RCSB_ID_authAsymId")
      const parts = chainKey.split('_');
      const authAsymId = parts[parts.length - 1];

      // Ligand sites
      for (const site of entry.data.ligandSites) {
        if (!visibility.visibleLigandIds.includes(site.id)) continue;

        const msaPositions: number[] = [];
        const residues: Array<{ chainId: string; authSeqId: number }> = [];

        for (const authSeqId of site.neighborhoodAuthSeqIds) {
          residues.push({ chainId: authAsymId, authSeqId });
          const masterIdx = authToMaster[authSeqId];
          if (masterIdx !== undefined) {
            msaPositions.push(masterIdx);
          }
        }

        rules.push({
          id: site.id,
          type: 'ligand',
          color: site.color,
          msaPositions,
          residues,
        });
      }

      // Mutations
      if (visibility.showMutations) {
        for (const mutation of entry.data.mutations) {
          const authSeqId = mutation.authSeqId;
          if (authSeqId === null) continue;

          rules.push({
            id: `mutation_${chainKey}_${mutation.masterIndex}`,
            type: 'mutation',
            color: MUTATION_COLOR,
            msaPositions: [mutation.masterIndex],
            residues: [{ chainId: authAsymId, authSeqId }],
          });
        }
      }
    }

    return rules;
  }
);