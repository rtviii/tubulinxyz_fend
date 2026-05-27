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
import { AUX_COLOR_PROVIDERS, isAuxLayerActive, computeTrackCells } from '@/components/msa/auxiliary/colorProviders';
import type { TrackEntry } from './annotationTracksSlice';

export interface ColorRule {
  id: string;

  chainKey: string;          // <-- added: e.g. "9OT2_A"
  type: 'ligand' | 'variant' | 'modification' | 'track';
  variantType?: VariantType;
  /** For modification rules: the PTM type id (e.g. 'palmitoylation'). */
  modificationType?: string;
  /** For track rules: the originating TrackEntry id. */
  trackId?: string;
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
      // Per-chain master_index -> auth_seq_id mappings, populated by the MSA
      // panel after sequence registration. Variants stored under
      // annotations.chains may have a null authSeqId if their annotations
      // arrived before the mapping; reading from here lets us back-fill
      // on the fly so 3D paint never silently drops them.
      (state: RootState) => state.sequenceRegistry.positionMappings,
      // Aux tracks: family-scoped annotation rows added via "+ add variants track".
      // We fan them out into per-(chain, position) ColorRules so the 3D paint
      // pipeline picks them up via the same residues[] payload as variants/ligands.
      (state: RootState) => state.annotationTracks.tracks,
      (state: RootState) => state.annotationTracks.order,
      (_state: RootState, visibleSeqIds: string[]) => visibleSeqIds,
    ],
    (chains, ligandOverrides, variantOverrides, modificationOverrides, positionMappings, trackEntries, trackOrder, visibleSeqIds): ColorRule[] => {
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
        const chainPositionMapping = positionMappings[chainKey];

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
            if (variant.source === 'morisette') continue;
            // Back-fill authSeqId from the current position mapping when the
            // stored value is null (annotations resolved before the MSA
            // registered its sequence).
            const authSeqId = variant.authSeqId
              ?? chainPositionMapping?.[variant.masterIndex]
              ?? null;
            if (authSeqId === null) continue;
            rules.push({
              id: `variant_${chainKey}_${variant.masterIndex}`,
              chainKey,                 // <-- added
              type: 'variant',
              variantType: variant.type,
              color: resolveVariantColor(variantOverrides, variant.type),
              msaCells: [{ row: rowIndex, column: variant.masterIndex - 1 }],
              residues: [{ chainId: authAsymId, authSeqId }],
            });
          }
        }

        // PTM rules: each selected (non-muted) type contributes cells for every
        // modification in the current species selection. The MSA principal row
        // is painted when the chain is collapsed; when expanded, useViewerSync
        // routes MSA painting through the aux rows via computeAuxiliaryCellColors.
        // For 3D, we resolve the per-chain auth_seq_id from positionMappings the
        // same way variants and tracks do, so toggling a PTM row's eye paints/
        // unpaints the residue on the 3D structure.
        const speciesSet = new Set(visibility.includedSpeciesTaxIds ?? []);
        const muted = new Set(visibility.mutedModificationTypes ?? []);
        if (speciesSet.size > 0) {
          for (const modType of visibility.visibleModificationTypes ?? []) {
            if (muted.has(modType)) continue;
            const color = resolveModificationColor(modificationOverrides, modType);
            // Dedupe per (modType, masterIndex): the same residue can carry
            // records from multiple species in the current selection, which
            // would emit identical-color rules and bloat the rule list.
            const seenMasterIndices = new Set<number>();
            for (const m of entry.data.modifications) {
              if (m.modificationType !== modType) continue;
              if (m.taxId == null || !speciesSet.has(m.taxId)) continue;
              if (seenMasterIndices.has(m.masterIndex)) continue;
              seenMasterIndices.add(m.masterIndex);
              const authSeqId = chainPositionMapping?.[m.masterIndex] ?? null;
              rules.push({
                id: `mod_${chainKey}_${modType}_${m.masterIndex}`,
                chainKey,
                type: 'modification',
                modificationType: modType,
                color,
                msaCells: [{ row: rowIndex, column: m.masterIndex - 1 }],
                residues: authSeqId != null ? [{ chainId: authAsymId, authSeqId }] : [],
              });
            }
          }
        }
      }

      // ---- Aux track 3D projection ----
      // For each visible track, find every visible chain whose annotation family
      // matches the track's family, look up the per-chain auth_seq_id for each
      // resolved master_index via positionMappings, and emit a ColorRule. The
      // MSA aux-row cells are NOT painted from here -- that's handled by
      // computeAuxiliaryCellColors -> computeTrackCells; we leave msaCells empty
      // so the principal chain rows don't get smeared with the track color.
      for (const trackId of trackOrder) {
        const entry = trackEntries[trackId];
        if (!entry) continue;
        const cells = computeTrackCells(entry); // returns [] if !resolved or !visible
        if (cells.length === 0) continue;

        for (const [chainKey, chainEntry] of Object.entries(chains)) {
          if (!chainEntry.data) continue;
          if (!visible.has(chainKey)) continue;
          if (chainEntry.data.family !== entry.spec.family) continue;
          const mapping = positionMappings[chainKey];
          if (!mapping) continue;
          const authAsymId = authAsymIdFromChainKey(chainKey);

          for (const { masterIndex, color } of cells) {
            const authSeqId = mapping[masterIndex];
            if (authSeqId == null) continue;
            rules.push({
              id: `track_${trackId}_${chainKey}_${masterIndex}`,
              chainKey,
              type: 'track',
              trackId,
              color,
              msaCells: [],
              residues: [{ chainId: authAsymId, authSeqId }],
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
 *
 * Two code paths:
 *  1. Chain-scoped rows ('variants', 'ligand', 'ptm') -- need parentSequenceId,
 *     read from annotationChains keyed by chain.
 *  2. Global track rows ('track:<id>') -- no parent, read from annotationTracks
 *     by parsing the track id out of the layerType.
 */
export function computeAuxiliaryCellColors(
  displaySequences: Array<Pick<MsaSequence, 'id' | 'originType' | 'parentSequenceId' | 'layerType'>>,
  annotationChains: RootState['annotations']['chains'],
  overrides: {
    ligand: LigandOverrideMap;
    variant: VariantOverrideMap;
    modification: ModificationOverrideMap;
  },
  trackEntries?: Record<string, TrackEntry>,
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
    if (seq.originType !== 'auxiliary' || !seq.layerType) continue;

    const desc = parseLayerType(seq.layerType);
    if (!desc) continue;

    // ---- Global track row: no parent, paint from tracks slice ----
    if (desc.kind === 'track') {
      if (!desc.id || !trackEntries) continue;
      const trackId = `track_${desc.id}`.startsWith('track_')
        ? (desc.id.startsWith('track_') ? desc.id : `track_${desc.id}`)
        : desc.id;
      // The layerType encodes the id after 'track:'; track ids in the slice are
      // prefixed with 'track_'. We accept either form for robustness.
      const entry = trackEntries[trackId] ?? trackEntries[desc.id];
      if (!entry) continue;
      for (const { masterIndex, color } of computeTrackCells(entry)) {
        cellColors[`${rowIdx}-${masterIndex - 1}`] = color;
      }
      continue;
    }

    // ---- Chain-scoped row: needs parent + annotation data ----
    if (!seq.parentSequenceId) continue;

    const chainKey = parentToChainKey[seq.parentSequenceId];
    if (!chainKey) continue;

    const entry = annotationChains[chainKey];
    if (!entry?.data) continue;

    // Row is always materialized, but colors only paint when the layer is "active"
    // (eye icon on). Inactive layers keep the row but leave its cells blank.
    if (!isAuxLayerActive(desc, entry.visibility)) continue;

    // desc.kind is 'variants' | 'ligand' | 'ptm' here (the 'track' branch returns above)
    const provider = AUX_COLOR_PROVIDERS[desc.kind as keyof typeof AUX_COLOR_PROVIDERS];
    if (!provider) continue;
    for (const { masterIndex, color } of provider(desc, entry.data, overrides, entry.visibility)) {
      cellColors[`${rowIdx}-${masterIndex - 1}`] = color;
    }
  }

  return cellColors;
}
