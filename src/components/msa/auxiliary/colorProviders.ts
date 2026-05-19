import type { ChainAnnotationData, ChainVisibility } from '@/store/slices/annotationsSlice';
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

export const AUX_COLOR_PROVIDERS: Record<AuxLayerKind, AuxColorProvider> = {
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

/** Compute per-layer "is this layer's overpaint currently visible?" from chain visibility.
 *  For PTMs this means selected AND not muted -- selection determines whether the row
 *  exists at all (managed by the PTMs+ popup / X button), muting just suppresses paint. */
export function isAuxLayerActive(
  desc: AuxLayerDescriptor,
  vis: ChainVisibility | undefined,
): boolean {
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
