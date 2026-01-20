import { Color } from 'molstar/lib/mol-util/color';

// ============================================================
// Instance Types
// ============================================================

export type MolstarInstanceId = 'structure' | 'monomer';

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