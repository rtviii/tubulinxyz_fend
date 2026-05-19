import { createSelector } from '@reduxjs/toolkit';
import { RootState } from '../store';
import { VariantType } from './annotationsSlice';
import { authAsymIdFromChainKey } from '@/lib/chain_key';
import type { MsaSequence } from './sequence_registry';
import {
  resolveLigandColor,
  resolveVariantColor,
  resolveModificationColor,
  type LigandOverrideMap,
  type VariantOverrideMap,
  type ModificationOverrideMap,
} from '@/lib/colors/annotationPaletteResolve';
import { parseLayerType } from '@/components/msa/auxiliary/layerKind';
import { AUX_COLOR_PROVIDERS, isAuxLayerActive } from '@/components/msa/auxiliary/colorProviders';

export interface ColorRule {
  id: string;

  chainKey: string;          // <-- added: e.g. "9OT2_A"
  type: 'ligand' | 'variant' | 'modification';
  variantType?: VariantType;
  /** For modification rules: the PTM type id (e.g. 'palmitoylation'). */
  modificationType?: string;
  color: string;
  msaCells: Array<{ row: number; column: number }>;
  residues: Array<{ chainId: string; authSeqId: number }>;
}

export const makeSelectActiveColorRulesForSequenceIds = () =>
  createSelector(
    [
      (state: RootState) => state.annotations.chains,
      (state: RootState) => state.colorOverrides.ligand,
      (state: RootState) => state.colorOverrides.variant,
      (state: RootState) => state.colorOverrides.modification,
      (_state: RootState, visibleSeqIds: string[]) => visibleSeqIds,
    ],
    (chains, ligandOverrides, variantOverrides, modificationOverrides, visibleSeqIds): ColorRule[] => {
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
            color: resolveLigandColor(ligandOverrides, site.ligandId),
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
              color: resolveVariantColor(variantOverrides, variant.type),
              msaCells: [{ row: rowIndex, column: variant.masterIndex - 1 }],
              residues: [{ chainId: authAsymId, authSeqId: variant.authSeqId }],
            });
          }
        }

        // PTM rules: each selected (non-muted) type contributes cells for every
        // modification in the current species selection. These paint the principal
        // row when the chain is collapsed; when expanded, useViewerSync skips
        // principal painting for this chain and the aux PTM rows take over via
        // computeAuxiliaryCellColors. The /3D/ overpaint always honors these rules.
        const speciesSet = new Set(visibility.includedSpeciesTaxIds ?? []);
        const muted = new Set(visibility.mutedModificationTypes ?? []);
        if (speciesSet.size > 0) {
          for (const modType of visibility.visibleModificationTypes ?? []) {
            if (muted.has(modType)) continue;
            const color = resolveModificationColor(modificationOverrides, modType);
            for (const m of entry.data.modifications) {
              if (m.modificationType !== modType) continue;
              if (m.taxId == null || !speciesSet.has(m.taxId)) continue;
              const authSeqId = entry.data
                ? null  // master_index -> auth_seq_id mapping lives outside this slice; skip residue payload for now
                : null;
              rules.push({
                id: `mod_${chainKey}_${modType}_${m.masterIndex}_${m.taxId}`,
                chainKey,
                type: 'modification',
                modificationType: modType,
                color,
                msaCells: [{ row: rowIndex, column: m.masterIndex - 1 }],
                // residues left empty: 3D overpaint for PTMs uses the
                // computeAuxiliaryCellColors path + the chain's residue mapping
                // upstream; PTMs typically don't need a per-residue 3D recolor.
                residues: authSeqId != null ? [{ chainId: authAsymId, authSeqId }] : [],
              });
            }
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
  overrides: {
    ligand: LigandOverrideMap;
    variant: VariantOverrideMap;
    modification: ModificationOverrideMap;
  },
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

    const desc = parseLayerType(seq.layerType);
    if (!desc) continue;

    const chainKey = parentToChainKey[seq.parentSequenceId];
    if (!chainKey) continue;

    const entry = annotationChains[chainKey];
    if (!entry?.data) continue;

    // Row is always materialized, but colors only paint when the layer is "active"
    // (eye icon on). Inactive layers keep the row but leave its cells blank.
    if (!isAuxLayerActive(desc, entry.visibility)) continue;

    for (const { masterIndex, color } of AUX_COLOR_PROVIDERS[desc.kind](desc, entry.data, overrides, entry.visibility)) {
      cellColors[`${rowIdx}-${masterIndex - 1}`] = color;
    }
  }

  return cellColors;
}
