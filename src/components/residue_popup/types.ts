/** Anchor mode: how the popup is positioned */
export type PopupAnchor =
  | { mode: 'anchored'; position3d: [number, number, number] }
  | { mode: 'static'; screenX: number; screenY: number };

/** Universal residue popup target -- works for both structural and non-structural sequences */
export interface ResiduePopupTarget {
  /** Unique key for dedup (e.g. "1JFF:A:120" or "TBB1_HUMAN:130") */
  id: string;
  residueLetter: string;
  /** Display label: "1JFF:A" for structural, "TBB1_HUMAN" for non-structural */
  label: string;
  /** 1-based MSA column position */
  masterIndex: number;
  /** PDB auth_seq_id -- only for structural sequences */
  authSeqId?: number;
  /** PDB chain auth_asym_id -- only for structural sequences */
  chainId?: string;
  anchor: PopupAnchor;
}
