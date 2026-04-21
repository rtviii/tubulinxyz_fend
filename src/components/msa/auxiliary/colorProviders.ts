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

  ptm: (desc, data, overrides) => {
    if (!desc.id) return [];
    const color = resolveModificationColor(overrides.modification, desc.id);
    return data.modifications
      .filter(m => m.modificationType === desc.id)
      .map(m => ({ masterIndex: m.masterIndex, color }));
  },
};

/** Compute per-layer "is this layer currently visible?" from chain visibility. */
export function isAuxLayerActive(
  desc: AuxLayerDescriptor,
  vis: ChainVisibility | undefined,
): boolean {
  if (!vis) return false;
  switch (desc.kind) {
    case 'variants': return vis.showVariants;
    case 'ligand':   return desc.id ? vis.visibleLigandIds.includes(desc.id) : false;
    case 'ptm':      return desc.id ? vis.visibleModificationTypes.includes(desc.id) : false;
  }
}
