import { MolstarInstance } from '../services/MolstarInstance';
import { ColorschemeDefinition, AnnotationDataMap, ResidueColoring } from './types';
import { mutationColorscheme } from './schemes/mutationScheme';
import { interactionColorscheme } from './schemes/interactionScheme'

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
 * This computes the specific residue colorings and passes them to the 
 * MolstarInstance to be applied via overpaint.
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

  const structure = instance.viewer.getCurrentStructure();
  if (!structure) {
    console.warn(`[Colorscheme] No structure loaded in instance ${instance.id}`);
    return;
  }

  const pdbId = structure.model.entryId ?? '';

  // Calculate the specific colorings (chainId, authSeqId, color) based on the scheme logic
  const colorings = scheme.getColorings({
    pdbId,
    chainId,
    annotationData,
  });

  if (colorings.length === 0) {
    console.log(`[Colorscheme] No residues to color for ${colorschemeId}`);
    // Optional: Clear existing overpaint if no new data is present
    await instance.restoreDefaultColors();
    return;
  }

  console.log(`[Colorscheme] Applying ${colorings.length} colorings for scheme: ${colorschemeId}`);

  // Pass the computed colorings to the instance which handles the Molstar state updates
  await instance.applyColorscheme(colorschemeId, colorings);
}

/**
 * Remove all colorscheme overpaints and restore default colors.
 */
export async function restoreDefaultColors(instance: MolstarInstance): Promise<void> {
  console.log(`[Colorscheme] Restoring default colors for instance ${instance.id}`);
  await instance.restoreDefaultColors();
}