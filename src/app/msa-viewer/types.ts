// src/app/msa-viewer/types.ts

/** * 0-based index referring to the observed residue array (from Molstar/CIF). 
 * Used for array indexing in JavaScript.
 */
export type ObservedIndex = number;

/** * 0-based index referring to the Master Alignment column.
 * We enforce 0-based indexing everywhere in the React logic.
 * The translation to 1-based happens ONLY inside MSADisplay.tsx.
 */
export type MsaIndex = number;

/** * The identifier used in the CIF/PDB file (e.g., 10, 100, -5).
 * Usually a number, but can be a string in some CIF contexts.
 */
export type AuthSeqId = number | string;

export interface AlignmentRequest {
  sequence: string;
  sequence_id: string;
  /** * The list of auth_seq_ids corresponding 1:1 with the characters in `sequence`.
   * This ensures we can map back to the structure after alignment.
   */
  auth_seq_ids: AuthSeqId[]; 
}

export interface AlignmentResponse {
  aligned_sequence: string;
  /** * Array where index is the 0-based MSA position.
   * Value is the AuthSeqId from the original structure, or -1 (or "-1") if it's a gap.
   */
  mapping: (AuthSeqId)[]; 
}

/**
 * A fast lookup map for the UI.
 * Key: 0-based MSA Position (aligned with App logic)
 * Value: The PDB AuthSeqId to highlight in Molstar
 */
export interface MsaToStructureMapping {
  [msaPosition: number]: AuthSeqId;
}