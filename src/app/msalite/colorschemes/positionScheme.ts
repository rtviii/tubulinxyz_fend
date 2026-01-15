// Custom position-based color scheme for nightingale-msa
// This needs to be injected into nightingale's scheme registry

export interface PositionColorData {
  // Map of MSA position (0-indexed) -> hex color
  positionColors: Map<number, string>;
  // Map of (sequenceIndex, position) -> hex color for per-cell coloring
  cellColors?: Map<string, string>;
  // Default color when no specific color is set
  defaultColor?: string;
}

// We'll store the current coloring data here so the scheme can access it
let currentColorData: PositionColorData = {
  positionColors: new Map(),
  defaultColor: '#ffffff'
};

export function setPositionColorData(data: PositionColorData) {
  currentColorData = data;
}

export function getPositionColorData(): PositionColorData {
  return currentColorData;
}

// The scheme definition that matches nightingale's DynSchemeClass interface
export const positionColorScheme = {
  type: 'dyn' as const,
  getColor: function(residue: string, position: number, _conservation?: any): string {
    // Check for position-specific color
    const posColor = currentColorData.positionColors.get(position);
    if (posColor) return posColor;
    
    // Return default or white
    return currentColorData.defaultColor || '#ffffff';
  }
};

// Helper to generate gradient colors
export function generateGradientColors(maxLength: number): Map<number, string> {
  const colors = new Map<number, string>();
  for (let i = 0; i < maxLength; i++) {
    const ratio = i / maxLength;
    const r = Math.floor(ratio * 255);
    const b = Math.floor((1 - ratio) * 255);
    colors.set(i, `rgb(${r}, 100, ${b})`);
  }
  return colors;
}

// Helper to generate band colors
export function generateBandColors(maxLength: number): Map<number, string> {
  const colors = new Map<number, string>();
  const bandColors = ['#FFE4E1', '#E1FFE4', '#E1E4FF'];
  for (let i = 0; i < maxLength; i++) {
    const band = Math.floor(i / 10) % 3;
    colors.set(i, bandColors[band]);
  }
  return colors;
}

// Helper to generate random highlight colors
export function generateRandomHighlights(maxLength: number): Map<number, string> {
  const colors = new Map<number, string>();
  const palette = ['#FFDDC1', '#FFABAB', '#FFC3A0', '#D5AAFF', '#85E3FF', '#B9FBC0'];
  for (let i = 0; i < maxLength; i++) {
    if (Math.random() > 0.7) {
      colors.set(i, palette[Math.floor(Math.random() * palette.length)]);
    }
  }
  return colors;
}