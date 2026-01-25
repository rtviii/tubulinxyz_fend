// src/components/msa/types.ts

export interface MSAHandle {
  // Navigation
  jumpToRange: (start: number, end: number) => void;
  
  // Hover highlighting (ephemeral, doesn't persist)
  setHighlight: (start: number, end: number) => void;
  clearHighlight: () => void;
  
  // Color schemes
  setColorScheme: (scheme: string) => void;
  
  // Position-based coloring (for annotations)
  applyPositionColors: (colors: Record<number, string>) => void;
  clearPositionColors: () => void;
  
  // Redraw
  redraw: () => void;
}