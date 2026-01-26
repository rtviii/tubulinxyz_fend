// src/components/msa/types.ts
export interface MSAHandle {
  redraw: () => void;
  jumpToRange: (start: number, end: number) => void;
  setColorScheme: (scheme: string) => void;
  setHighlight: (start: number, end: number) => void;
  clearHighlight: () => void;
  applyPositionColors: (colors: Record<number, string>) => void;
  applyCellColors: (colors: Record<string, string>) => void;
  clearPositionColors: () => void;
}