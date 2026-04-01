import { createSelector } from '@reduxjs/toolkit';
import { RootState } from '../store';
import { VariantType } from './annotationsSlice';
import { authAsymIdFromChainKey } from '@/lib/chain_key';
import type { MsaSequence } from './sequence_registry';
import { MODIFICATION_COLORS } from '@/components/annotations/ModificationsPanel';


export const VARIANT_COLORS: Record<VariantType, string> = {
  substitution: '#f97316',
  insertion: '#22c55e',
  deletion: '#ef4444',
};

export interface ColorRule {
  id: string;

  chainKey: string;          // <-- added: e.g. "9OT2_A"
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
        const authAsymId = authAsymIdFromChainKey(chainKey);

        for (const site of entry.data.ligandSites) {
          if (!visibility.visibleLigandIds.includes(site.id)) continue;
          rules.push({
            id: site.id,
            chainKey,                   // <-- added
            type: 'ligand',
            color: site.color,
            msaCells: site.masterIndices.map(mi => ({ row: rowIndex, column: mi - 1 })),
            residues: site.authSeqIds.map(id => ({ chainId: authAsymId, authSeqId: id })),
          });
        }

        if (visibility.showVariants) {
          for (const variant of entry.data.variants) {
            if (variant.authSeqId === null) continue;
            if (variant.source === 'morisette') continue;
            rules.push({
              id: `variant_${chainKey}_${variant.masterIndex}`,
              chainKey,                 // <-- added
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

/**
 * Compute cell colors for auxiliary (annotation layer) rows.
 * Called from useViewerSync alongside the primary color rules.
 */
export function computeAuxiliaryCellColors(
  displaySequences: Array<Pick<MsaSequence, 'id' | 'originType' | 'parentSequenceId' | 'layerType'>>,
  annotationChains: RootState['annotations']['chains'],
): Record<string, string> {
  const cellColors: Record<string, string> = {};

  // Build a map: parentSeqId -> chainKey (for looking up annotation data)
  const parentToChainKey: Record<string, string> = {};
  for (const seq of displaySequences) {
    if (seq.originType === 'pdb') {
      // The seq.id for pdb sequences IS the chain key (e.g., "9MLF_A")
      parentToChainKey[seq.id] = seq.id;
    }
  }

  for (let rowIdx = 0; rowIdx < displaySequences.length; rowIdx++) {
    const seq = displaySequences[rowIdx];
    if (seq.originType !== 'auxiliary' || !seq.parentSequenceId || !seq.layerType) continue;

    const chainKey = parentToChainKey[seq.parentSequenceId];
    if (!chainKey) continue;

    const entry = annotationChains[chainKey];
    if (!entry?.data) continue;

    const { data } = entry;

    if (seq.layerType === 'variants') {
      // Paint structural variant positions
      for (const v of data.variants) {
        if (v.source === 'morisette') continue;
        cellColors[`${rowIdx}-${v.masterIndex - 1}`] = VARIANT_COLORS[v.type];
      }
    } else if (seq.layerType.startsWith('ligand:')) {
      const siteId = seq.layerType.slice('ligand:'.length);
      const site = data.ligandSites.find(s => s.id === siteId);
      if (site) {
        for (const mi of site.masterIndices) {
          cellColors[`${rowIdx}-${mi - 1}`] = site.color;
        }
      }
    } else if (seq.layerType.startsWith('ptm:')) {
      const modType = seq.layerType.slice('ptm:'.length);
      const color = MODIFICATION_COLORS[modType] ?? '#9ca3af';
      for (const mod of data.modifications) {
        if (mod.modificationType !== modType) continue;
        cellColors[`${rowIdx}-${mod.masterIndex - 1}`] = color;
      }
    }
  }

  return cellColors;
}