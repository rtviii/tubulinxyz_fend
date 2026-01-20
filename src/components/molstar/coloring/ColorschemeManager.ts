import { MolstarInstance } from '../services/MolstarInstance';
import { ColorschemeDefinition, AnnotationDataMap, ResidueColoring } from './types';
import { mutationColorscheme } from './schemes/mutationScheme';
import { interactionColorscheme } from './schemes/interactionScheme';

// Registry of available colorschemes
const COLORSCHEME_REGISTRY: Record<string, ColorschemeDefinition> = {
  mutations: mutationColorscheme,
  interactions: interactionColorscheme,
};

export function getAvailableColorschemes(): ColorschemeDefinition[] {
  return Object.values(COLORSCHEME_REGISTRY);
}

export function getColorscheme(id: string): ColorschemeDefinition | null {
  return COLORSCHEME_REGISTRY[id] ?? null;
}

/**
 * Apply a colorscheme to an instance.
 * This uses Molstar's overpaint functionality.
 */
export async function applyColorscheme(
  instance: MolstarInstance,
  colorschemeId: string,
  annotationData: AnnotationDataMap,
  chainId?: string
): Promise<void> {
  const scheme = getColorscheme(colorschemeId);
  if (!scheme) {
    console.warn(`Colorscheme not found: ${colorschemeId}`);
    return;
  }

  const pdbId = instance.viewer.getCurrentStructure()?.model.entryId ?? '';

  const colorings = scheme.getColorings({
    pdbId,
    chainId,
    annotationData,
  });

  // TODO: Apply colorings using Molstar overpaint
  // This requires building overpaint bundles and applying them
  // to the structure representations

  console.log(`[Colorscheme] Would apply ${colorings.length} colorings for ${colorschemeId}`);

  await instance.applyColorscheme(colorschemeId);
}

/**
 * Remove all colorscheme overpaints and restore default colors.
 */
export async function restoreDefaultColors(instance: MolstarInstance): Promise<void> {
  // TODO: Clear all overpaint and restore original representation colors
  await instance.restoreDefaultColors();
}