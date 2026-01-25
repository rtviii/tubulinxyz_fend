// src/lib/types/annotations.ts

/**
 * Frontend types mirroring backend ChainAnnotationsResponse.
 * These are the "raw" API response shapes.
 */

export interface ResidueInteraction {
  authSeqId: number;
  masterIndex: number | null;
  interactionType: string;
  residueCompId: string;
  residueAtomId: string;
}

export interface LigandSite {
  ligandId: string;
  ligandName: string;
  ligandChain: string;
  ligandAuthSeqId: number;
  drugbankId: string | null;
  smiles: string | null;
  neighborhoodAuthSeqIds: number[];
  interactions: ResidueInteraction[];
}

export interface MutationAnnotation {
  masterIndex: number;
  fromResidue: string;
  toResidue: string;
  uniprotId: string | null;
  species: string | null;
  tubulinType: string | null;
  phenotype: string | null;
  keywords: string | null;
  databaseSource: string | null;
  referenceLink: string | null;
}

export interface ChainAnnotations {
  rcsbId: string;
  authAsymId: string;
  entityId: string;
  family: string | null;
  mutations: MutationAnnotation[];
  ligandSites: LigandSite[];
  mutationCount: number;
  ligandCount: number;
  uniqueLigandTypes: string[];
}

// --- Position exploration (for hover popover) ---

export interface MutationWithSource extends MutationAnnotation {
  rcsbId: string;
  authAsymId: string;
}

export interface LigandContactWithSource {
  masterIndex: number;
  interactionType: string;
  residueCompId: string;
  ligandId: string;
  ligandName: string;
  rcsbId: string;
  authAsymId: string;
  ligandChain: string;
}

export interface PositionAnnotations {
  position: number;
  family: string;
  mutations: MutationWithSource[];
  ligandContacts: LigandContactWithSource[];
  totalStructures: number;
  structuresWithMutations: number;
  structuresWithLigandContacts: number;
  uniqueLigandTypes: string[];
}

// --- Display state ---

export interface AnnotationDisplayState {
  showMutations: boolean;
  visibleLigandSites: Set<string>; // Keys like "GTP_A_501" (ligandId_chain_authSeqId)
}

// --- Derived types for UI components ---

export interface DisplayableLigandSite {
  id: string; // Unique key: "ligandId_chain_authSeqId"
  ligandId: string;
  ligandName: string;
  ligandChain: string;
  color: string;
  masterIndices: number[]; // For MSA features
  authSeqIds: number[]; // For structure highlighting
  interactionCount: number;
}

export interface DisplayableMutation {
  masterIndex: number;
  fromResidue: string;
  toResidue: string;
  phenotype: string | null;
  label: string; // "S250F"
}