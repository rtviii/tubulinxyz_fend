import { Color } from 'molstar/lib/mol-util/color';
import { ColorschemeDefinition, ResidueColoring, ColorschemeParams } from '../types';

export const INTERACTION_COLORS = {
  withInteraction: Color(0x1E88E5), // Blue
  noInteraction: Color(0xE0E0E0),   // Light gray
};

export const interactionColorscheme: ColorschemeDefinition = {
  id: 'interactions',
  name: 'Ligand Interaction Sites',
  description: 'Highlights residues that interact with ligands',
  baseColor: INTERACTION_COLORS.noInteraction,

  getColorings(params: ColorschemeParams): ResidueColoring[] {
    const { annotationData, chainId } = params;
    const interactions = annotationData.interactions ?? [];

    if (interactions.length === 0) return [];

    return interactions.map(interaction => ({
      chainId: chainId ?? interaction.residue_comp_id, // Adjust as needed
      authSeqId: interaction.residue_auth_seq_id,
      color: INTERACTION_COLORS.withInteraction,
    }));
  },
};