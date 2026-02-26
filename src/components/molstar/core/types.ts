import { Color } from 'molstar/lib/mol-util/color';

// ============================================================
// Instance Types
// ============================================================

// export type MolstarInstanceId = 'structure' | 'monomer' | 'msalite';
// ...
export type MolstarInstanceId = 'structure' | 'monomer' | 'msalite' | 'landing_1jff' | 'landing_9f3b';


// ============================================================
// View Mode
// ============================================================

export type ViewMode = 'structure' | 'monomer';

// ============================================================
// Component Types
// ============================================================

export interface PolymerComponent {
  type: 'polymer';
  pdbId: string;
  ref: string;
  chainId: string;
}

export interface LigandComponent {
  type: 'ligand';
  pdbId: string;
  ref: string;
  uniqueKey: string;
  compId: string;
  authAsymId: string;
  authSeqId: number;
}

export type Component = PolymerComponent | LigandComponent;

export function isPolymerComponent(c: Component): c is PolymerComponent {
  return c.type === 'polymer';
}

export function isLigandComponent(c: Component): c is LigandComponent {
  return c.type === 'ligand';
}

// ============================================================
// UI State Types
// ============================================================

export interface ComponentUIState {
  visible: boolean;
  hovered: boolean;
}

// ============================================================
// Aligned Structure Types
// ============================================================

export interface AlignedStructure {
  id: string;                  // unique key, e.g. "1TUB_A_aligned_to_B"
  sourcePdbId: string;         // e.g. "1TUB"
  sourceChainId: string;       // e.g. "A"
  targetChainId: string;       // which monomer chain this is aligned to
  parentRef: string;           // ref to full structure (for cleanup)
  chainComponentRef: string;   // ref to chain component (for visibility/transform)
  visible: boolean;
  rmsd: number | null;         // alignment quality
  family?: string;          // <-- add this
}

export interface MonomerChainState {
  alignedStructures: Record<string, AlignedStructure>;
  // Future: annotation visibility, custom colorings, etc.
}

// ============================================================
// Colorscheme Types
// ============================================================

export interface ResidueColoring {
  chainId: string;
  authSeqId: number;
  color: Color;
}

export interface ColorschemeSpec {
  id: string;
  name: string;
  description?: string;
  baseColor?: Color;
}

export type AnnotationType = 'mutations' | 'interactions' | 'neighborhoods';

export interface AnnotationData {
  type: AnnotationType;
  positions: number[];
  metadata?: Record<string, unknown>;
}

// ============================================================
// Classification Types
// ============================================================

export type TubulinClassification = Record<string, string>;

// ============================================================
// Sequence Types
// ============================================================

export interface ObservedSequenceData {
  sequence: string;
  authSeqIds: number[];
}

export interface SequenceData {
  chainId: string;
  pdbId: string;
  sequence: string;
  name: string;
  chainType: string;
}