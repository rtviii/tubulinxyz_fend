// src/lib/types/sync.ts

import { Color } from 'molstar/lib/mol-util/color';

// ============================================================
// Core Types
// ============================================================

export interface PositionMapping {
  [msaPosition: number]: number; // msaPos -> auth_seq_id
}

export interface PositionMapper {
  msaToAuth(msaPosition: number): number | undefined;
  authToMSA(authSeqId: number): number | undefined;
}

/**
 * Creates a position mapper from the MSA->auth mapping.
 * 
 * TODO: Replace with proper backend-provided bidirectional mapping.
 * Currently builds a naive reverse map which may have issues with:
 * - Gaps in the MSA (multiple MSA positions -> same auth or no auth)
 * - Insertions in the structure not present in MSA
 * 
 * The backend should provide both directions explicitly.
 */
export function createPositionMapper(msaToAuthMap: PositionMapping | null): PositionMapper {
  // Build reverse map (naive implementation)
  const authToMsaMap: Record<number, number> = {};
  
  if (msaToAuthMap) {
    for (const [msaPosStr, authSeqId] of Object.entries(msaToAuthMap)) {
      const msaPos = parseInt(msaPosStr, 10);
      // Note: If multiple MSA positions map to same auth_seq_id,
      // this will keep the last one. This is a known limitation.
      authToMsaMap[authSeqId] = msaPos;
    }
  }

  return {
    msaToAuth(msaPosition: number): number | undefined {
      return msaToAuthMap?.[msaPosition];
    },
    authToMSA(authSeqId: number): number | undefined {
      return authToMsaMap[authSeqId];
    },
  };
}

export interface ColorRule {
  id: string;
  type: 'binding-site' | 'mutation' | 'annotation' | 'custom';
  priority: number; // Higher priority overrides lower

  // MSA coloring
  msaColumns?: number[]; // Column-wide coloring (applies to all sequences)
  msaCells?: Array<{ row: number; column: number }>; // Row-specific coloring

  // Molstar coloring
  residues?: Array<{ chainId: string; authSeqId: number }>;

  color: string; // Hex color (e.g., '#FF0000')
  label?: string;
}

export interface ColorState {
  rules: ColorRule[];
  defaultColor: string;
}

// ============================================================
// Action Types
// ============================================================

export type SyncAction =
  | { type: 'ADD_COLOR_RULE'; rule: ColorRule }
  | { type: 'REMOVE_COLOR_RULE'; id: string }
  | { type: 'CLEAR_COLORS' }
  | { type: 'SET_COLOR_SCHEME'; scheme: string }
  | { type: 'HIGHLIGHT_RESIDUE'; chainId: string; authSeqId?: number; msaPosition?: number }
  | { type: 'CLEAR_HIGHLIGHT' }
  | { type: 'FOCUS_RESIDUE'; chainId: string; authSeqId?: number; msaPosition?: number }
  | { type: 'FOCUS_RANGE'; chainId: string; startAuth: number; endAuth: number; msaStart?: number; msaEnd?: number }
  | { type: 'JUMP_TO_RANGE'; start: number; end: number };

// ============================================================
// Controller Interfaces
// ============================================================

export interface IMSAController {
  setColorScheme(scheme: string): void;
  applyColors(rules: ColorRule[], defaultColor: string): void;
  clearColors(): void;
  jumpToRange(start: number, end: number): void;
  redraw(): void;
  highlightPosition(msaPosition: number): void;
  highlightRange(start: number, end: number): void;
  clearHighlight(): void;
}

export interface IStructureController {
  applyColors(rules: ColorRule[]): void;
  restoreDefaultColors(): void;
  highlightResidue(chainId: string, authSeqId: number, highlight: boolean): void;
  clearHighlight(): void;
  focusResidue(chainId: string, authSeqId: number): void;
  focusResidueRange(chainId: string, startAuth: number, endAuth: number): void;
}

// ============================================================
// Annotation Types
// ============================================================

export interface BindingSite {
  id: string;
  name: string;
  color: string;
  msaRegions: Array<{ start: number; end: number }>;
}

export interface Mutation {
  id: string;
  msaPosition: number;
  fromResidue: string;
  toResidue: string;
  color: string;
  label?: string;
}