import { Color } from 'molstar/lib/mol-util/color';
import { ColorschemeDefinition, ResidueColoring, ColorschemeParams } from '../types';

export const MUTATION_COLORS = {
  withMutation: Color(0xE53935), // Red
  noMutation: Color(0xE0E0E0),   // Light gray
};

export const mutationColorscheme: ColorschemeDefinition = {
  id: 'mutations',
  name: 'Mutation Sites',
  description: 'Highlights residues with known mutations',
  baseColor: MUTATION_COLORS.noMutation,

  getColorings(params: ColorschemeParams): ResidueColoring[] {
    const { annotationData, chainId } = params;
    const mutations = annotationData.mutations ?? [];

    if (mutations.length === 0) return [];

    // Note: mutations have master_index, you'll need to translate to auth_seq_id
    // using your alignment mapping. For now, this is a placeholder.
    // In practice, you'd pass the mapping in params or fetch it.

    return mutations.map(mutation => ({
      chainId: chainId ?? 'A', // You'll need proper chain resolution
      authSeqId: mutation.master_index, // This needs translation!
      color: MUTATION_COLORS.withMutation,
    }));
  },
};