// src/app/msalite/services/ligandColorService.ts

export interface LigandAnnotation {
  ligandId: string;
  ligandName: string;
  bindingPositions: number[];  // alignment positions, 0-indexed
}

// Color palette - 20 distinct colors
const LIGAND_PALETTE = [
  "#e6194b", "#3cb44b", "#ffe119", "#4363d8", "#f58231",
  "#911eb4", "#46f0f0", "#f032e6", "#bcf60c", "#fabebe",
  "#008080", "#e6beff", "#9a6324", "#fffac8", "#800000",
  "#aaffc3", "#808000", "#ffd8b1", "#000075", "#808080",
];

// ============================================================
// MOCK DATA - Replace with your actual backend fetch
// ============================================================
export function getMockLigands(): LigandAnnotation[] {
  return [
    {
      ligandId: "colchicine",
      ligandName: "Colchicine",
      bindingPositions: [247, 248, 249, 250, 251, 252, 314, 315, 316, 317, 318, 349, 350, 351, 352],
    },
    {
      ligandId: "taxol",
      ligandName: "Paclitaxel (Taxol)",
      bindingPositions: [22, 23, 24, 25, 26, 227, 228, 229, 230, 274, 275, 276, 277, 278, 279, 280, 359, 360, 361],
    },
    {
      ligandId: "vinblastine",
      ligandName: "Vinblastine",
      bindingPositions: [175, 176, 177, 178, 179, 180, 181, 214, 215, 216, 217, 218],
    },
    {
      ligandId: "epothilone",
      ligandName: "Epothilone B",
      bindingPositions: [22, 23, 24, 25, 274, 275, 276, 277, 278, 279, 280, 281, 282],
    },
    {
      ligandId: "gtp",
      ligandName: "GTP",
      bindingPositions: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 140, 141, 142, 143, 144, 145],
    },
    {
      ligandId: "gdp",
      ligandName: "GDP",
      bindingPositions: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 140, 141, 142, 143, 144, 145],
    },
    {
      ligandId: "maytansine",
      ligandName: "Maytansine",
      bindingPositions: [168, 169, 170, 171, 172, 173, 174, 175, 217, 218, 219, 220],
    },
    {
      ligandId: "laulimalide",
      ligandName: "Laulimalide",
      bindingPositions: [290, 291, 292, 293, 294, 295, 296, 297, 298, 335, 336, 337, 338],
    },
    {
      ligandId: "peloruside",
      ligandName: "Peloruside A",
      bindingPositions: [290, 291, 292, 293, 294, 296, 297, 298, 336, 337, 338, 339, 340],
    },
    {
      ligandId: "combretastatin",
      ligandName: "Combretastatin A-4",
      bindingPositions: [247, 248, 249, 250, 251, 316, 317, 318, 350, 351, 352, 353],
    },
  ];
}

// ============================================================
// Color assignment
// ============================================================
export function assignLigandColors(ligands: LigandAnnotation[]): Map<string, string> {
  const colors = new Map<string, string>();
  ligands.forEach((lig, idx) => {
    colors.set(lig.ligandId, LIGAND_PALETTE[idx % LIGAND_PALETTE.length]);
  });
  return colors;
}

// ============================================================
// Build position -> color map from selection
// ============================================================
export function buildPositionColorMap(
  ligands: LigandAnnotation[],
  selectedIds: Set<string>,
  ligandColors: Map<string, string>
): Map<number, string> {
  const positionColors = new Map<number, string>();
  
  for (const ligand of ligands) {
    if (!selectedIds.has(ligand.ligandId)) continue;
    
    const color = ligandColors.get(ligand.ligandId);
    if (!color) continue;
    
    for (const pos of ligand.bindingPositions) {
      positionColors.set(pos, color);
    }
  }
  
  return positionColors;
}

// ============================================================
// Apply to window global (what nightingale reads)
// ============================================================
export function applyLigandColoring(
  ligands: LigandAnnotation[],
  selectedIds: Set<string>,
  ligandColors: Map<string, string>,
  defaultColor = "#f5f5f5"  // light gray so uncolored positions are visible
): void {
  const positionColors = buildPositionColorMap(ligands, selectedIds, ligandColors);
  
  window.__nightingaleCustomColors = {
    positionColors,
    defaultColor,
  };
}

export function clearLigandColoring(): void {
  delete window.__nightingaleCustomColors;
}
// Add to ligandColorService.ts

// For single-row coloring
export function applyRowSpecificColoring(
  rowIndex: number,
  positions: number[],
  color: string,
  defaultColor = "#f5f5f5"
): void {
  const cellColors = new Map<string, string>();
  
  for (const pos of positions) {
    cellColors.set(`${rowIndex}-${pos}`, color);
  }
  
  window.__nightingaleCustomColors = {
    positionColors: new Map(), // empty - no column-wide coloring
    cellColors,
    defaultColor,
  };
}

// Combine both: column-wide ligand coloring + row-specific highlights
export function applyCombinedColoring(
  ligands: LigandAnnotation[],
  selectedLigandIds: Set<string>,
  ligandColors: Map<string, string>,
  rowHighlights?: { rowIndex: number; positions: number[]; color: string }[],
  defaultColor = "#f5f5f5"
): void {
  const positionColors = buildPositionColorMap(ligands, selectedLigandIds, ligandColors);
  
  const cellColors = new Map<string, string>();
  if (rowHighlights) {
    for (const { rowIndex, positions, color } of rowHighlights) {
      for (const pos of positions) {
        cellColors.set(`${rowIndex}-${pos}`, color);
      }
    }
  }
  
  window.__nightingaleCustomColors = {
    positionColors,
    cellColors,
    defaultColor,
  };
}
// Test function - highlight specific positions on a single row
export function applyRowHighlight(
  rowIndex: number,
  positions: number[],
  color: string,
  defaultColor = "#f5f5f5"
): void {
  const cellColors = new Map<string, string>();
  
  for (const pos of positions) {
    cellColors.set(`${rowIndex}-${pos}`, color);
  }
  
  window.__nightingaleCustomColors = {
    positionColors: new Map(),
    cellColors,
    defaultColor,
  };
  
  console.log(`[RowHighlight] Set ${positions.length} positions on row ${rowIndex}`);
}