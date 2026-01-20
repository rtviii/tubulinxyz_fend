// src/app/msalite/examples/coloringExamples.ts

/**
 * Example/demo coloring functions for testing.
 * These are NOT for production use - they demonstrate patterns
 * that will be replaced by real API data.
 */

import {
  applyColumnColors,
  applyColumnHighlights,
  applyRowHighlights,
  applyCombinedColoring,
  applyAnnotationColoring,
  assignAnnotationColors,
  RowHighlight,
  ColumnHighlight,
  BindingSiteAnnotation,
} from '../services/msaColorService';

// ============================================================
// Whole-MSA column coloring examples
// ============================================================

export function exampleGradient(maxLength: number): void {
  const colors = new Map<number, string>();
  for (let i = 0; i < maxLength; i++) {
    const ratio = i / maxLength;
    const r = Math.floor(ratio * 255);
    const b = Math.floor((1 - ratio) * 255);
    colors.set(i, `rgb(${r}, 100, ${b})`);
  }
  applyColumnColors(colors);
}

export function exampleBands(maxLength: number, bandSize = 20): void {
  const colors = new Map<number, string>();
  const palette = ['#FFE4E1', '#E1FFE4', '#E1E4FF', '#FFF4E1'];
  for (let i = 0; i < maxLength; i++) {
    colors.set(i, palette[Math.floor(i / bandSize) % palette.length]);
  }
  applyColumnColors(colors);
}

export function exampleConservedRegions(maxLength: number): void {
  // Mock "conserved" regions - in real use, compute from alignment
  const regions: ColumnHighlight[] = [
    { start: 10, end: 30, color: '#ff9999', label: 'N-terminus' },
    { start: 80, end: 120, color: '#99ff99', label: 'Loop 1' },
    { start: 200, end: 250, color: '#9999ff', label: 'Helix' },
    { start: 300, end: 340, color: '#ffff99', label: 'Beta sheet' },
    { start: 400, end: 430, color: '#ff99ff', label: 'C-terminus' },
  ];
  applyColumnHighlights(regions, maxLength);
}

// ============================================================
// Per-sequence row coloring examples
// ============================================================

export function exampleSingleRow(
  rowIndex: number,
  start: number,
  end: number,
  color: string
): void {
  applyRowHighlights([{ rowIndex, start, end, color }]);
}

export function exampleMultipleRows(sequenceCount: number): void {
  const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7'];
  const highlights: RowHighlight[] = [];
  
  for (let i = 0; i < Math.min(sequenceCount, 5); i++) {
    highlights.push({
      rowIndex: i,
      start: 20 + i * 60,
      end: 80 + i * 60,
      color: colors[i],
    });
  }
  applyRowHighlights(highlights);
}

export function exampleRandomHighlights(
  sequenceCount: number,
  maxLength: number,
  count = 5
): RowHighlight[] {
  const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#fd79a8'];
  const highlights: RowHighlight[] = [];

  for (let i = 0; i < count; i++) {
    const rowIndex = Math.floor(Math.random() * sequenceCount);
    const start = Math.floor(Math.random() * (maxLength - 50));
    const length = 20 + Math.floor(Math.random() * 30);
    highlights.push({
      rowIndex,
      start,
      end: Math.min(start + length, maxLength - 1),
      color: colors[i % colors.length],
    });
  }
  
  applyRowHighlights(highlights);
  return highlights; // return for logging
}

// ============================================================
// Combined examples
// ============================================================

export function exampleCombined(maxLength: number): void {
  // Base: bands
  const columnColors = new Map<number, string>();
  const palette = ['#FFE4E1', '#E1FFE4', '#E1E4FF'];
  for (let i = 0; i < maxLength; i++) {
    columnColors.set(i, palette[Math.floor(i / 20) % palette.length]);
  }

  // Overrides: specific rows
  const rowHighlights: RowHighlight[] = [
    { rowIndex: 1, start: 50, end: 100, color: '#ff0000' },
    { rowIndex: 3, start: 200, end: 250, color: '#00ff00' },
  ];

  applyCombinedColoring(columnColors, rowHighlights);
}

// ============================================================
// Mock annotation data (simulates API response)
// ============================================================

export const MOCK_BINDING_SITES: BindingSiteAnnotation[] = [
  {
    id: 'colchicine',
    name: 'Colchicine',
    positions: [247, 248, 249, 250, 251, 252, 314, 315, 316, 317, 318],
  },
  {
    id: 'taxol',
    name: 'Paclitaxel',
    positions: [22, 23, 24, 25, 26, 227, 228, 229, 230, 274, 275, 276, 277],
  },
  {
    id: 'vinblastine',
    name: 'Vinblastine',
    positions: [175, 176, 177, 178, 179, 180, 181, 214, 215, 216, 217],
  },
  {
    id: 'gtp',
    name: 'GTP',
    positions: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 140, 141, 142, 143, 144, 145],
  },
];

export function exampleBindingSites(): void {
  const colors = assignAnnotationColors(MOCK_BINDING_SITES);
  const allIds = new Set(MOCK_BINDING_SITES.map(s => s.id));
  applyAnnotationColoring(MOCK_BINDING_SITES, allIds, colors);
}

// ============================================================
// Preset configurations (for quick testing)
// ============================================================

export const EXAMPLE_PRESETS = {
  gradient: exampleGradient,
  bands: exampleBands,
  conserved: exampleConservedRegions,
  bindingSites: exampleBindingSites,
  combined: exampleCombined,
  multiRow: exampleMultipleRows,
} as const;

export type ExamplePreset = keyof typeof EXAMPLE_PRESETS;