import { MolstarInstance } from '../services/MolstarInstance';
import { MolstarInstanceId } from '../core/types';

/**
 * Highlight a residue in a Molstar instance by auth_seq_id.
 * This is the main entry point for Nightingale -> Molstar sync.
 */
export function highlightResidueInInstance(
  instance: MolstarInstance | null,
  chainId: string,
  authSeqId: number,
  highlight: boolean
): void {
  if (!instance) return;
  instance.highlightResidue(chainId, authSeqId, highlight);
}

/**
 * Highlight a range of residues.
 */
export function highlightResidueRangeInInstance(
  instance: MolstarInstance | null,
  chainId: string,
  startAuthSeqId: number,
  endAuthSeqId: number,
  highlight: boolean
): void {
  if (!instance) return;
  instance.highlightResidueRange(chainId, startAuthSeqId, endAuthSeqId, highlight);
}

/**
 * Focus camera on a residue.
 */
export function focusResidueInInstance(
  instance: MolstarInstance | null,
  chainId: string,
  authSeqId: number
): void {
  if (!instance) return;
  instance.focusResidue(chainId, authSeqId);
}

/**
 * Clear all highlights in an instance.
 */
export function clearHighlightInInstance(instance: MolstarInstance | null): void {
  if (!instance) return;
  instance.clearHighlight();
}