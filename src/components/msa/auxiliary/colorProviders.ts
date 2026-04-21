import type { ChainAnnotationData, ChainVisibility } from '@/store/slices/annotationsSlice';
import {
  getVariantColor,
  getModificationColor,
  getHexForLigand,
} from '@/lib/colors/annotationPalette';
import type { AuxLayerDescriptor, AuxLayerKind } from './layerKind';

export interface AuxColorCell {
  masterIndex: number;
  color: string;
}

export type AuxColorProvider = (
  desc: AuxLayerDescriptor,
  data: ChainAnnotationData,
) => AuxColorCell[];

export const AUX_COLOR_PROVIDERS: Record<AuxLayerKind, AuxColorProvider> = {
  variants: (_desc, data) =>
    data.variants
      .filter(v => v.source !== 'morisette')
      .map(v => ({ masterIndex: v.masterIndex, color: getVariantColor(v.type) })),

  ligand: (desc, data) => {
    const site = data.ligandSites.find(s => s.id === desc.id);
    if (!site) return [];
    const color = getHexForLigand(site.ligandId);
    return site.masterIndices.map(mi => ({ masterIndex: mi, color }));
  },

  ptm: (desc, data) => {
    if (!desc.id) return [];
    const color = getModificationColor(desc.id);
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
