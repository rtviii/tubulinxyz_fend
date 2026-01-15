// Helper to set custom color data via window global
export interface CustomColorData {
  positionColors: Map<number, string>;
  defaultColor: string;
}

export function setCustomColorData(data: CustomColorData) {
  (window as any).__nightingaleCustomColors = data;
  console.log(`[CustomScheme] Set ${data.positionColors.size} position colors`);
}

export function clearCustomColorData() {
  delete (window as any).__nightingaleCustomColors;
}

// Helpers to create color data
export function createGradientColors(maxLength: number): CustomColorData {
  const colors = new Map<number, string>();
  for (let i = 0; i < maxLength; i++) {
    const ratio = i / maxLength;
    const r = Math.floor(ratio * 255);
    const b = Math.floor((1 - ratio) * 255);
    colors.set(i, `rgb(${r}, 100, ${b})`);
  }
  return { positionColors: colors, defaultColor: '#ffffff' };
}

export function createAlternatingColors(maxLength: number): CustomColorData {
  const colors = new Map<number, string>();
  const bandColors = ['#FFE4E1', '#E1FFE4', '#E1E4FF'];
  for (let i = 0; i < maxLength; i++) {
    const band = Math.floor(i / 10) % 3;
    colors.set(i, bandColors[band]);
  }
  return { positionColors: colors, defaultColor: '#ffffff' };
}

export function createBindingSiteColors(positions: number[]): CustomColorData {
  const colors = new Map<number, string>();
  positions.forEach(pos => colors.set(pos, '#FF4444'));
  return { positionColors: colors, defaultColor: '#cccccc' };
}