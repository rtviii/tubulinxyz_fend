import type { VariantType } from '@/store/slices/annotationsSlice';
import {
  VARIANT_COLORS,
  getHexForLigand,
  getModificationColor,
} from './annotationPalette';

export type LigandOverrideMap = Record<string, string>;
export type VariantOverrideMap = Partial<Record<VariantType, string>>;
export type ModificationOverrideMap = Record<string, string>;

export function resolveLigandColor(
  overrides: LigandOverrideMap | undefined,
  ligandId: string,
): string {
  return overrides?.[ligandId] ?? getHexForLigand(ligandId);
}

export function resolveVariantColor(
  overrides: VariantOverrideMap | undefined,
  type: VariantType,
): string {
  return overrides?.[type] ?? VARIANT_COLORS[type];
}

export function resolveModificationColor(
  overrides: ModificationOverrideMap | undefined,
  modType: string,
): string {
  return overrides?.[modType] ?? getModificationColor(modType);
}
