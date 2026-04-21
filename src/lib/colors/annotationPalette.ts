import type { VariantType } from '@/store/slices/annotationsSlice';
import { getHexForLigand } from '@/components/molstar/colors/palette';

export const VARIANT_COLORS: Record<VariantType, string> = {
  substitution: '#f97316',
  insertion:    '#22c55e',
  deletion:     '#ef4444',
};

export const MODIFICATION_COLORS: Record<string, string> = {
  acetylation:     '#6366f1', // indigo
  phosphorylation: '#0ea5e9', // sky
  palmitoylation:  '#f59e0b', // amber
  ubiquitination:  '#ef4444', // red
  methylation:     '#8b5cf6', // violet
  nitrosylation:   '#14b8a6', // teal
  sumoylation:     '#f97316', // orange
  glutamylation:   '#22c55e', // green
  glycylation:     '#06b6d4', // cyan
  tyrosination:    '#ec4899', // pink
};

export const DEFAULT_ANNOTATION_COLOR = '#9ca3af';

export const getVariantColor = (t: VariantType): string => VARIANT_COLORS[t];

export const getModificationColor = (t: string): string =>
  MODIFICATION_COLORS[t] ?? DEFAULT_ANNOTATION_COLOR;

export { getHexForLigand };
