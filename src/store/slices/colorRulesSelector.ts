// src/store/slices/colorRulesSelector.ts
import { createSelector } from '@reduxjs/toolkit';
import { RootState } from '../store';
import { VariantType } from './annotationsSlice';

export const VARIANT_COLORS: Record<VariantType, string> = {
  substitution: '#f97316',
  insertion: '#22c55e',
  deletion: '#ef4444',
};

export interface ColorRule {
  id: string;
  type: 'ligand' | 'variant';
  variantType?: VariantType;
  color: string;
  // For MSA - cell-based (row + column)
  msaCells: Array<{ row: number; column: number }>;
  // For Molstar
  residues: Array<{ chainId: string; authSeqId: number }>;
}

export const makeSelectActiveColorRulesForSequenceIds = () =>
  createSelector(
    [
      (state: RootState) => state.annotations.chains,
      (state: RootState) => state.sequenceRegistry.positionMappings,
      (_state: RootState, visibleSeqIds: string[]) => visibleSeqIds,
    ],
    (chains, positionMappings, visibleSeqIds): ColorRule[] => {
      const rules: ColorRule[] = [];
      const visible = new Set(visibleSeqIds);

      // ✅ Row indices must match the order passed into <nightingale-msa data=...>
      const chainKeyToRowIndex: Record<string, number> = {};
      visibleSeqIds.forEach((id, idx) => {
        chainKeyToRowIndex[id] = idx; // 0-based row
      });

      for (const [chainKey, entry] of Object.entries(chains)) {
        if (!entry.data) continue;
        if (!visible.has(chainKey)) continue;

        const rowIndex = chainKeyToRowIndex[chainKey];
        if (rowIndex === undefined) continue;

        const mapping = positionMappings[chainKey];
        const visibility = entry.visibility;

        const authToMaster: Record<number, number> = {};
        if (mapping) {
          for (const [masterStr, authSeqId] of Object.entries(mapping)) {
            authToMaster[authSeqId] = parseInt(masterStr, 10);
          }
        }

        const parts = chainKey.split('_');
        const authAsymId = parts[parts.length - 1];

        // Ligands
        for (const site of entry.data.ligandSites) {
          if (!visibility.visibleLigandIds.includes(site.id)) continue;

          const msaCells: Array<{ row: number; column: number }> = [];
          const residues: Array<{ chainId: string; authSeqId: number }> = [];

          for (const authSeqId of site.neighborhoodAuthSeqIds) {
            residues.push({ chainId: authAsymId, authSeqId });
            const masterIdx = authToMaster[authSeqId];
            if (masterIdx !== undefined) {
              msaCells.push({ row: rowIndex, column: masterIdx - 1 }); // 0-based column
            }
          }

          rules.push({ id: site.id, type: 'ligand', color: site.color, msaCells, residues });
        }

        // Variants
        if (visibility.showVariants) {
          for (const variant of entry.data.variants) {
            if (variant.authSeqId === null) continue;

            rules.push({
              id: `variant_${chainKey}_${variant.masterIndex}`,
              type: 'variant',
              variantType: variant.type,
              color: VARIANT_COLORS[variant.type],
              msaCells: [{ row: rowIndex, column: variant.masterIndex - 1 }],
              residues: [{ chainId: authAsymId, authSeqId: variant.authSeqId }],
            });
          }
        }
      }

      return rules;
    }
  );



export const selectActiveColorRules = createSelector(
  [
    (state: RootState) => state.annotations.chains,
    (state: RootState) => state.annotations.primaryChainKey,
    (state: RootState) => state.sequenceRegistry.positionMappings,
    (state: RootState) => state.sequenceRegistry.sequences,
  ],
  (chains, primaryKey, positionMappings, sequences): ColorRule[] => {
    const rules: ColorRule[] = [];

    // Build chainKey -> rowIndex mapping from sequence registry
    const chainKeyToRowIndex: Record<string, number> = {};
    for (const seq of Object.values(sequences)) {
      if (seq.originType === 'pdb' && seq.chainRef) {
        const key = `${seq.chainRef.pdbId}_${seq.chainRef.chainId}`;
        chainKeyToRowIndex[key] = seq.rowIndex;
      }
    }

    console.log('[ColorRules Debug]', {
      primaryKey,
      annotationChainKeys: Object.keys(chains),
      sequenceChainKeys: chainKeyToRowIndex,
      sequenceCount: Object.keys(sequences).length,
    });

    for (const [chainKey, entry] of Object.entries(chains)) {
      if (!entry.data) continue;

      const mapping = positionMappings[chainKey];
      const visibility = entry.visibility;
      const rowIndex = chainKeyToRowIndex[chainKey];

      console.log('[ColorRules] Processing chain:', {
        chainKey,
        rowIndex,
        hasMapping: !!mapping,
        mappingKeys: mapping ? Object.keys(mapping).length : 0,
        visibility,
        variantCount: entry.data.variants.length,
        ligandCount: entry.data.ligandSites.length,
      });
      if (rowIndex === undefined) {
        console.log('[ColorRules] Skipping - no rowIndex');
        continue;
      }
      // Skip if this chain isn't in the MSA yet (no row to paint)
      if (rowIndex === undefined) continue;

      const authToMaster: Record<number, number> = {};
      if (mapping) {
        for (const [masterStr, authSeqId] of Object.entries(mapping)) {
          authToMaster[authSeqId] = parseInt(masterStr, 10);
        }
      }

      const noFamily = chainKey.split('__')[0];
      const parts = noFamily.split('_');
      const authAsymId = parts[parts.length - 1];



      // Ligand sites
      for (const site of entry.data.ligandSites) {
        if (!visibility.visibleLigandIds.includes(site.id)) continue;

        const msaCells: Array<{ row: number; column: number }> = [];
        const residues: Array<{ chainId: string; authSeqId: number }> = [];

        for (const authSeqId of site.neighborhoodAuthSeqIds) {
          residues.push({ chainId: authAsymId, authSeqId });
          const masterIdx = authToMaster[authSeqId];
          if (masterIdx !== undefined) {
            // masterIdx is 1-based, Nightingale position is 0-based
            msaCells.push({ row: rowIndex, column: masterIdx - 1 });
          }
        }

        rules.push({
          id: site.id,
          type: 'ligand',
          color: site.color,
          msaCells,
          residues,
        });
      }

      // Variants
      if (visibility.showVariants) {
        for (const variant of entry.data.variants) {
          const authSeqId = variant.authSeqId;
          console.log('[ColorRules] Variant:', {
            masterIndex: variant.masterIndex,
            authSeqId,
            type: variant.type,
            skipping: authSeqId === null,
          });

          if (authSeqId === null) continue;

          rules.push({
            id: `variant_${chainKey}_${variant.masterIndex}`,
            type: 'variant',
            variantType: variant.type,
            color: VARIANT_COLORS[variant.type],
            // masterIndex is 1-based, Nightingale is 0-based
            msaCells: [{ row: rowIndex, column: variant.masterIndex - 1 }],
            residues: [{ chainId: authAsymId, authSeqId }],
          });
        }
      } else {

        console.log('[ColorRules] showVariants is false');
      }
    }
    console.log('[ColorRules] Generated rules:', {
      ruleCount: rules.length,
      rules: rules.map(r => ({
        id: r.id,
        type: r.type,
        color: r.color,
        cellCount: r.msaCells.length,
        firstCells: r.msaCells.slice(0, 3),
      })),
    });

    return rules;
  }
);