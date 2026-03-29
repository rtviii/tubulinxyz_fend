// src/components/msa/types.ts
export interface MSAHandle {
  redraw: () => void;
  jumpToRange: (start: number, end: number) => void;
  setColorScheme: (scheme: string) => void;
  setHighlight: (start: number, end: number) => void;
  setCellHighlight: (row: number, column: number) => void;
  setCrosshairHighlight: (row: number, column: number) => void;
  clearHighlight: () => void;
  setSelectionHighlight: (row: number, column: number) => void;
  clearSelectionHighlight: () => void;
  applyPositionColors: (colors: Record<number, string>) => void;
  applyCellColors: (colors: Record<string, string>) => void;
  clearPositionColors: () => void;
  /** Select a structural residue by chainKey and MSA master index */
  selectResidueByChainKey: (chainKey: string, masterIdx: number, authSeqId: number) => void;
}