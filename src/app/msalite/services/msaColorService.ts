// src/app/msalite/services/msaColorService.ts

/**
 * Core MSA coloring service.
 * Manages the window.__nightingaleCustomColors config for custom-position scheme.
 */

// ============================================================
// Types
// ============================================================

export interface CustomColorConfig {
  positionColors: Map<number, string>;
  cellColors?: Map<string, string>;  // key: "rowIndex-position"
  defaultColor: string;
}

export interface RowHighlight {
  rowIndex: number;
  start: number;
  end: number;
  color: string;
  label?: string;
}

export interface ColumnHighlight {
  start: number;
  end: number;
  color: string;
  label?: string;
}

export interface BindingSiteAnnotation {
  id: string;
  name: string;
  positions: number[];        // alignment positions (0-indexed)
  sequenceIndex?: number;     // if specific to one sequence, otherwise column-wide
  color?: string;             // optional pre-assigned color
}

declare global {
  interface Window {
    __nightingaleCustomColors?: CustomColorConfig;
  }
}

// ============================================================
// Core: Config management
// ============================================================

export function applyColorConfig(config: CustomColorConfig): void {
  window.__nightingaleCustomColors = config;
}

export function clearColorConfig(): void {
  delete window.__nightingaleCustomColors;
}

export function getColorConfig(): CustomColorConfig | undefined {
  return window.__nightingaleCustomColors;
}

// ============================================================
// Column-based coloring (whole MSA)
// ============================================================

export function applyColumnColors(
  positionColors: Map<number, string>,
  defaultColor = '#ffffff'
): void {
  applyColorConfig({ positionColors, defaultColor });
}

export function applyColumnHighlights(
  highlights: ColumnHighlight[],
  maxLength: number,
  defaultColor = '#f5f5f5'
): void {
  const colors = new Map<number, string>();
  for (const { start, end, color } of highlights) {
    for (let i = start; i <= end && i < maxLength; i++) {
      colors.set(i, color);
    }
  }
  applyColorConfig({ positionColors: colors, defaultColor });
}

// ============================================================
// Row-based coloring (per-sequence)
// ============================================================

export function applyRowHighlights(
  highlights: RowHighlight[],
  defaultColor = '#e8e8e8'
): void {
  const cellColors = new Map<string, string>();
  for (const { rowIndex, start, end, color } of highlights) {
    for (let pos = start; pos <= end; pos++) {
      cellColors.set(`${rowIndex}-${pos}`, color);
    }
  }
  applyColorConfig({
    positionColors: new Map(),
    cellColors,
    defaultColor,
  });
}

export function applySingleRowHighlight(
  rowIndex: number,
  start: number,
  end: number,
  color: string,
  defaultColor = '#e8e8e8'
): void {
  applyRowHighlights([{ rowIndex, start, end, color }], defaultColor);
}

// ============================================================
// Combined: column base + row overrides
// ============================================================

export function applyCombinedColoring(
  columnColors: Map<number, string>,
  rowHighlights: RowHighlight[],
  defaultColor = '#ffffff'
): void {
  const cellColors = new Map<string, string>();
  for (const { rowIndex, start, end, color } of rowHighlights) {
    for (let pos = start; pos <= end; pos++) {
      cellColors.set(`${rowIndex}-${pos}`, color);
    }
  }
  applyColorConfig({
    positionColors: columnColors,
    cellColors: cellColors.size > 0 ? cellColors : undefined,
    defaultColor,
  });
}

// ============================================================
// Annotation-based coloring (for real API data)
// ============================================================

const DEFAULT_PALETTE = [
  '#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231',
  '#911eb4', '#46f0f0', '#f032e6', '#bcf60c', '#fabebe',
  '#008080', '#e6beff', '#9a6324', '#fffac8', '#800000',
  '#aaffc3', '#808000', '#ffd8b1', '#000075', '#808080',
];

export function assignAnnotationColors(
  annotations: BindingSiteAnnotation[]
): Map<string, string> {
  const colors = new Map<string, string>();
  annotations.forEach((ann, idx) => {
    colors.set(ann.id, ann.color ?? DEFAULT_PALETTE[idx % DEFAULT_PALETTE.length]);
  });
  return colors;
}

export function applyAnnotationColoring(
  annotations: BindingSiteAnnotation[],
  selectedIds: Set<string>,
  colorMap: Map<string, string>,
  defaultColor = '#f5f5f5'
): void {
  const positionColors = new Map<number, string>();
  const cellColors = new Map<string, string>();

  for (const ann of annotations) {
    if (!selectedIds.has(ann.id)) continue;
    const color = colorMap.get(ann.id);
    if (!color) continue;

    for (const pos of ann.positions) {
      if (ann.sequenceIndex !== undefined) {
        cellColors.set(`${ann.sequenceIndex}-${pos}`, color);
      } else {
        positionColors.set(pos, color);
      }
    }
  }

  applyColorConfig({
    positionColors,
    cellColors: cellColors.size > 0 ? cellColors : undefined,
    defaultColor,
  });
}