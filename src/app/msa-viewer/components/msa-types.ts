// src/app/msa-viewer/components/msa-types.ts

export interface SequenceData {
  id: string;
  name: string;
  sequence: string;
}

export interface AddedSequenceGroup {
  title: string;
  sequences: SequenceData[];
}

// State types for highlighting
export interface MsaHighlight {
  seqId: string;
}

export interface MsaHover extends MsaHighlight {
  position0: number; // 0-based index from App
}

// Handler definitions
export type LabelClickHandler = (label: string, seqId: string) => void;
export type ResidueClickHandler = (seqId: string, position0: number) => void;
export type ResidueHoverHandler = (seqId: string, position0: number) => void;
export type ResidueLeaveHandler = () => void;