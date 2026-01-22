// src/lib/sync/types.ts

import { Color } from 'molstar/lib/mol-util/color';

// ============================================================
// Position Mapping
// ============================================================

export interface PositionMapping {
  [msaPosition: number]: number; // msaPos -> auth_seq_id
}

export interface PositionMapper {
  msaToAuth(msaPosition: number): number | undefined;
  authToMSA(authSeqId: number): number | undefined;
}

/**
 * Creates a bidirectional position mapper from the MSA->auth mapping.
 * 
 * Note: The reverse map is built naively - if multiple MSA positions map 
 * to the same auth_seq_id, only the last one is kept. For production use,
 * consider having the backend provide both directions explicitly.
 */

export function createPositionMapper(msaToAuthMap: PositionMapping | null): PositionMapper {
  const authToMsaMap: Record<number, number> = {};
  
  if (msaToAuthMap) {
    for (const [msaPosStr, authSeqId] of Object.entries(msaToAuthMap)) {
      const msaPos = parseInt(msaPosStr, 10);
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

// ============================================================
// Color Rules
// ============================================================

export interface ColorRule {
  id: string;
  type: 'binding-site' | 'mutation' | 'annotation' | 'custom';
  priority: number; // Higher priority overrides lower
  msaColumns?: number[];
  msaCells?: Array<{ row: number; column: number }>;
  residues?: Array<{ chainId: string; authSeqId: number }>;
  color: string; // Hex color (e.g., '#FF0000')
  label?: string;
}

export interface ColorState {
  rules: ColorRule[];
  defaultColor: string;
}

// ============================================================
// Nightingale Custom Color Config
// ============================================================

export interface NightingaleColorConfig {
  positionColors: Record<number, string>;
  cellColors?: Record<string, string>;
  defaultColor: string;
}

declare global {
  interface Window {
    __nightingaleCustomColors?: NightingaleColorConfig;
  }
}

// ============================================================
// Actions
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
  getCurrentScheme(): string;
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
// Annotation Types (for UI components)
// ============================================================

export interface BindingSite {
  id: string;
  name: string;
  color: string;
  msaRegions: Array<{ start: number; end: number }>;
}

export interface MutationAnnotation {
  masterIndex: number;
  fromResidue: string;
  toResidue: string;
  phenotype?: string;
  source?: string;
}

export interface AnnotationData {
  mutations?: MutationAnnotation[];
  bindingSites?: BindingSite[];
}