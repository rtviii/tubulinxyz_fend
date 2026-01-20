import { Color } from 'molstar/lib/mol-util/color';

export interface ResidueColoring {
  chainId: string;
  authSeqId: number;
  color: Color;
}

export interface ColorschemeDefinition {
  id: string;
  name: string;
  description?: string;
  baseColor: Color; // Color for non-annotated residues
  getColorings: (params: ColorschemeParams) => ResidueColoring[];
}

export interface ColorschemeParams {
  pdbId: string;
  chainId?: string; // If specified, only color this chain
  annotationData: AnnotationDataMap;
}

export interface AnnotationDataMap {
  mutations?: MutationAnnotation[];
  interactions?: InteractionAnnotation[];
  neighborhoods?: NeighborhoodAnnotation[];
}

// These match your backend response shapes
export interface MutationAnnotation {
  master_index: number;
  from_residue: string;
  to_residue: string;
  uniprot_id?: string;
  species?: string;
  phenotype?: string;
}

export interface InteractionAnnotation {
  master_index: number;
  interaction_type: string;
  residue_auth_seq_id: number;
  residue_comp_id: string;
  atom_id: string;
  ligand_id: string;
  ligand_name: string;
}

export interface NeighborhoodAnnotation {
  ligand_id: string;
  ligand_name: string;
  ligand_chain: string;
  nearby_residues: number[]; // auth_seq_ids
}