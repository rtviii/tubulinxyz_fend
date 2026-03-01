import { Color } from 'molstar/lib/mol-util/color';

/** Tint a color toward white by factor (0 = original, 1 = white) */
function tintColor(color: Color, factor: number): Color {
  const r = (color >> 16) & 0xFF;
  const g = (color >> 8) & 0xFF;
  const b = color & 0xFF;
  return Color.fromRgb(
    Math.round(r + (255 - r) * factor),
    Math.round(g + (255 - g) * factor),
    Math.round(b + (255 - b) * factor),
  );
}

/**
 * Interpolate from a light tint of baseColor (at intensity 0)
 * to full baseColor (at intensity 1).
 */
export function heatmapColor(intensity: number, baseColor: Color): Color {
  const t = Math.max(0, Math.min(1, intensity));
  const light = tintColor(baseColor, 0.78);

  const rL = (light >> 16) & 0xFF, gL = (light >> 8) & 0xFF, bL = light & 0xFF;
  const rH = (baseColor >> 16) & 0xFF, gH = (baseColor >> 8) & 0xFF, bH = baseColor & 0xFF;

  return Color.fromRgb(
    Math.round(rL + (rH - rL) * t),
    Math.round(gL + (gH - gL) * t),
    Math.round(bL + (bH - bL) * t),
  );
}

/**
 * Given a map of master_index -> frequency (0-1), a chain's master_to_auth mapping,
 * a chainId, and a base color (typically the ligand's palette color),
 * produce ResidueColoring[] for applyColorscheme().
 */
export function masterFrequenciesToColorings(
  frequencies: Map<number, number>,
  masterToAuth: Record<string, number | null>,
  chainId: string,
  baseColor: Color,
): Array<{ chainId: string; authSeqId: number; color: Color }> {
  const colorings: Array<{ chainId: string; authSeqId: number; color: Color }> = [];

  for (const [masterIdx, freq] of frequencies) {
    const authSeqId = masterToAuth[String(masterIdx)];
    if (authSeqId == null) continue;
    colorings.push({
      chainId,
      authSeqId,
      color: heatmapColor(freq, baseColor),
    });
  }

  return colorings;
}