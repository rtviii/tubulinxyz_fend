// src/app/msalite/services/msaColorService.ts

/**
 * Unified MSA coloring service.
 * Works with the custom-position color scheme in nightingale-msa.
 */

// ============================================================
// Types
// ============================================================

export interface CustomColorConfig {
    positionColors: Map<number, string>;  // column-wide coloring
    cellColors?: Map<string, string>;      // per-cell: "rowIndex-position" -> color
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

// Extend window type
declare global {
    interface Window {
        __nightingaleCustomColors?: CustomColorConfig;
    }
}

// ============================================================
// Core: Apply/Clear
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
// Whole-MSA Column Coloring
// ============================================================

export function applyColumnColors(
    positionColors: Map<number, string>,
    defaultColor = '#ffffff'
): void {
    applyColorConfig({
        positionColors,
        defaultColor,
    });
}

export function applyGradient(maxLength: number): void {
    const colors = new Map<number, string>();
    for (let i = 0; i < maxLength; i++) {
        const ratio = i / maxLength;
        const r = Math.floor(ratio * 255);
        const b = Math.floor((1 - ratio) * 255);
        colors.set(i, `rgb(${r}, 100, ${b})`);
    }
    applyColumnColors(colors);
}

export function applyBands(maxLength: number, bandSize = 20): void {
    const colors = new Map<number, string>();
    const palette = ['#FFE4E1', '#E1FFE4', '#E1E4FF', '#FFF4E1'];
    for (let i = 0; i < maxLength; i++) {
        const band = Math.floor(i / bandSize) % palette.length;
        colors.set(i, palette[band]);
    }
    applyColumnColors(colors);
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
    applyColorConfig({
        positionColors: colors,
        defaultColor,
    });
}

// ============================================================
// Per-Row (Sequence) Coloring
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
// Combined: Column base + Row overrides
// ============================================================

export type BaseScheme = 'gradient' | 'bands' | 'none';

export function applyCombined(
    maxLength: number,
    baseScheme: BaseScheme,
    rowHighlights: RowHighlight[],
    defaultColor = '#f0f0f0'
): void {
    const positionColors = new Map<number, string>();

    if (baseScheme === 'gradient') {
        for (let i = 0; i < maxLength; i++) {
            const ratio = i / maxLength;
            const r = Math.floor(ratio * 200 + 55);
            const b = Math.floor((1 - ratio) * 200 + 55);
            positionColors.set(i, `rgb(${r}, 180, ${b})`);
        }
    } else if (baseScheme === 'bands') {
        const palette = ['#FFE4E1', '#E1FFE4', '#E1E4FF'];
        for (let i = 0; i < maxLength; i++) {
            positionColors.set(i, palette[Math.floor(i / 20) % palette.length]);
        }
    }

    const cellColors = new Map<string, string>();
    for (const { rowIndex, start, end, color } of rowHighlights) {
        for (let pos = start; pos <= end; pos++) {
            cellColors.set(`${rowIndex}-${pos}`, color);
        }
    }

    applyColorConfig({
        positionColors,
        cellColors,
        defaultColor: baseScheme === 'none' ? defaultColor : '#ffffff',
    });
}

// ============================================================
// Annotation-based coloring (for real data)
// ============================================================

export interface BindingSiteAnnotation {
    id: string;
    name: string;
    positions: number[];       // alignment positions (0-indexed)
    sequenceIndex?: number;    // if specific to one sequence
    color?: string;            // optional pre-assigned color
}

const DEFAULT_PALETTE = [
    '#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231',
    '#911eb4', '#46f0f0', '#f032e6', '#bcf60c', '#fabebe',
    '#008080', '#e6beff', '#9a6324', '#fffac8', '#800000',
    '#aaffc3', '#808000', '#ffd8b1', '#000075', '#808080',
];

export function assignColors(annotations: BindingSiteAnnotation[]): Map<string, string> {
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
                // Per-sequence annotation
                cellColors.set(`${ann.sequenceIndex}-${pos}`, color);
            } else {
                // Column-wide annotation
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

// ============================================================
// Test data generators
// ============================================================

export function generateRandomRowHighlights(
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
            label: `Random ${i + 1}`,
        });
    }

    return highlights;
}

export function getMockBindingSites(): BindingSiteAnnotation[] {
    return [
        { id: 'colchicine', name: 'Colchicine', positions: [247, 248, 249, 250, 251, 252, 314, 315, 316, 317, 318] },
        { id: 'taxol', name: 'Paclitaxel', positions: [22, 23, 24, 25, 26, 227, 228, 229, 230, 274, 275, 276, 277] },
        { id: 'vinblastine', name: 'Vinblastine', positions: [175, 176, 177, 178, 179, 180, 181, 214, 215, 216, 217] },
        { id: 'gtp', name: 'GTP', positions: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 140, 141, 142, 143, 144, 145] },
    ];
}

// ============================================================
// Preset configurations
// ============================================================

export const PRESETS = {
    conservedRegions: (maxLength: number) => {
        const regions: ColumnHighlight[] = [
            { start: 10, end: 30, color: '#ff9999', label: 'N-terminus' },
            { start: 80, end: 120, color: '#99ff99', label: 'Loop 1' },
            { start: 200, end: 250, color: '#9999ff', label: 'Helix' },
            { start: 300, end: 340, color: '#ffff99', label: 'Beta sheet' },
            { start: 400, end: 430, color: '#ff99ff', label: 'C-terminus' },
        ];
        applyColumnHighlights(regions, maxLength);
    },

    bindingSites: () => {
        const sites = getMockBindingSites();
        const colors = assignColors(sites);
        applyAnnotationColoring(sites, new Set(sites.map(s => s.id)), colors);
    },

    perSequenceDemo: (sequenceCount: number) => {
        const highlights: RowHighlight[] = [];
        const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7'];
        for (let i = 0; i < Math.min(sequenceCount, 5); i++) {
            highlights.push({
                rowIndex: i,
                start: 50 + i * 60,
                end: 100 + i * 60,
                color: colors[i],
                label: `Seq ${i}`,
            });
        }
        applyRowHighlights(highlights);
    },
};