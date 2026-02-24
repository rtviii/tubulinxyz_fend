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
  msaCells: Array<{ row: number; column: number }>;
  residues: Array<{ chainId: string; authSeqId: number }>;
}

export const makeSelectActiveColorRulesForSequenceIds = () =>
  createSelector(
    [
      (state: RootState) => state.annotations.chains,
      (_state: RootState, visibleSeqIds: string[]) => visibleSeqIds,
    ],
    (chains, visibleSeqIds): ColorRule[] => {
      const rules: ColorRule[] = [];
      const visible = new Set(visibleSeqIds);

      const chainKeyToRowIndex: Record<string, number> = {};
      visibleSeqIds.forEach((id, idx) => {
        chainKeyToRowIndex[id] = idx;
      });

      for (const [chainKey, entry] of Object.entries(chains)) {
        if (!entry.data) continue;
        if (!visible.has(chainKey)) continue;

        const rowIndex = chainKeyToRowIndex[chainKey];
        if (rowIndex === undefined) continue;

        const visibility = entry.visibility;
        const parts = chainKey.split('_');
        const authAsymId = parts[parts.length - 1];

        for (const site of entry.data.ligandSites) {
          if (!visibility.visibleLigandIds.includes(site.id)) continue;

          rules.push({
            id: site.id,
            type: 'ligand',
            color: site.color,
            msaCells: site.masterIndices.map(mi => ({ row: rowIndex, column: mi - 1 })),
            residues: site.authSeqIds.map(id => ({ chainId: authAsymId, authSeqId: id })),
          });
        }

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