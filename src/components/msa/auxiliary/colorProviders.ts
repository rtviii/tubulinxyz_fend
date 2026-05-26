import type { ChainAnnotationData, ChainVisibility } from '@/store/slices/annotationsSlice';
import type { TrackEntry, PaintSpec } from '@/store/slices/annotationTracksSlice';
import {
  resolveLigandColor,
  resolveVariantColor,
  resolveModificationColor,
  type LigandOverrideMap,
  type VariantOverrideMap,
  type ModificationOverrideMap,
} from '@/lib/colors/annotationPaletteResolve';
import type { AuxLayerDescriptor, AuxLayerKind } from './layerKind';

export interface AuxColorCell {
  masterIndex: number;
  color: string;
}

export interface AuxColorOverrides {
  ligand: LigandOverrideMap;
  variant: VariantOverrideMap;
  modification: ModificationOverrideMap;
}

export type AuxColorProvider = (
  desc: AuxLayerDescriptor,
  data: ChainAnnotationData,
  overrides: AuxColorOverrides,
  /** Per-chain visibility. Currently only needed by the ptm provider to read
   *  includedSpeciesTaxIds for multi-species aggregation. Optional so callers
   *  that don't have it still get the chain's-own-species default. */
  visibility?: ChainVisibility,
) => AuxColorCell[];

/** Chain-scoped providers. Track painting is handled separately via
 *  computeTrackCells below (different data source: tracks slice, not
 *  ChainAnnotationData). */
type ChainScopedKind = Exclude<AuxLayerKind, 'track'>;

export const AUX_COLOR_PROVIDERS: Record<ChainScopedKind, AuxColorProvider> = {
  variants: (_desc, data, overrides) =>
    data.variants
      .filter(v => v.source !== 'morisette')
      .map(v => ({ masterIndex: v.masterIndex, color: resolveVariantColor(overrides.variant, v.type) })),

  ligand: (desc, data, overrides) => {
    const site = data.ligandSites.find(s => s.id === desc.id);
    if (!site) return [];
    const color = resolveLigandColor(overrides.ligand, site.ligandId);
    return site.masterIndices.map(mi => ({ masterIndex: mi, color }));
  },

  ptm: (desc, data, overrides, visibility) => {
    if (!desc.id) return [];
    const color = resolveModificationColor(overrides.modification, desc.id);
    // Color residues whose PTM type matches AND whose species is in the chain's
    // current selection (includedSpeciesTaxIds). When multiple species are
    // selected, cells aggregate across them all.
    const allowed = visibility?.includedSpeciesTaxIds
      ? new Set(visibility.includedSpeciesTaxIds)
      : (data.taxId != null ? new Set([data.taxId]) : new Set<number>());
    return data.modifications
      .filter(m => m.modificationType === desc.id && m.taxId != null && allowed.has(m.taxId))
      .map(m => ({ masterIndex: m.masterIndex, color }));
  },
};

/** Paint cells for a track row. Reads resolved positions from the track entry
 *  and applies the PaintSpec — flat (one color all cells) or byField (look up
 *  a categorical field on each matched record and map via the palette). */
export function computeTrackCells(entry: TrackEntry): AuxColorCell[] {
  if (!entry.resolved || !entry.visibility.visible) return [];
  const paint = entry.spec.paint;

  if (paint.kind === 'flat') {
    return entry.resolved.map(p => ({ masterIndex: p.master_index, color: paint.color }));
  }

  // byField: pick the first matched record at the position, read the field,
  // map to a color. Positions whose field value isn't in the palette fall
  // through to a default gray.
  const DEFAULT = '#9ca3af';
  return entry.resolved.map(p => {
    const rec = p.matched_records[0];
    const val = rec ? rec[paint.field] : null;
    const color = (val != null && paint.palette[String(val)]) || DEFAULT;
    return { masterIndex: p.master_index, color };
  });
}

/** Compute per-layer "is this layer's overpaint currently visible?" from chain visibility.
 *  For PTMs this means selected AND not muted -- selection determines whether the row
 *  exists at all (managed by the PTMs+ popup / X button), muting just suppresses paint.
 *  Track rows are handled separately (no chain visibility) via the track entry itself. */
export function isAuxLayerActive(
  desc: AuxLayerDescriptor,
  vis: ChainVisibility | undefined,
): boolean {
  if (desc.kind === 'track') {
    // Tracks aren't chain-scoped; their visibility lives on the TrackEntry.
    // computeAuxiliaryCellColors handles the gating; this function only
    // covers the chain-scoped kinds.
    return false;
  }
  if (!vis) return false;
  switch (desc.kind) {
    case 'variants': return vis.showVariants;
    case 'ligand':   return desc.id ? vis.visibleLigandIds.includes(desc.id) : false;
    case 'ptm': {
      if (!desc.id) return false;
      if (!vis.visibleModificationTypes.includes(desc.id)) return false;
      return !(vis.mutedModificationTypes ?? []).includes(desc.id);
    }
  }
}
