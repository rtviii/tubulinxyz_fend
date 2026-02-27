// src/components/explorer/visualization/heatmapColors.ts

import { Color } from 'molstar/lib/mol-util/color';

/**
 * Interpolate between a cold color and a hot color based on a 0-1 intensity value.
 * cold = light blue, hot = deep red
 */
export function heatmapColor(intensity: number): Color {
  const t = Math.max(0, Math.min(1, intensity));

  // Cold: rgb(200, 220, 240)  ->  Hot: rgb(180, 30, 30)
  const r = Math.round(200 + (180 - 200) * t);
  const g = Math.round(220 + (30 - 220) * t);
  const b = Math.round(240 + (30 - 240) * t);

  return Color.fromRgb(r, g, b);
}

/**
 * Given a map of master_index -> frequency (0-1), a chain's master_to_auth_seq_id mapping,
 * and a chainId, produce ResidueColoring[] ready for MolstarInstance.applyColorscheme().
 */
export function masterFrequenciesToColorings(
  frequencies: Map<number, number>,
  masterToAuth: Record<string, number | null>,
  chainId: string,
): Array<{ chainId: string; authSeqId: number; color: Color }> {
  const colorings: Array<{ chainId: string; authSeqId: number; color: Color }> = [];

  for (const [masterIdx, freq] of frequencies) {
    const authSeqId = masterToAuth[String(masterIdx)];
    if (authSeqId == null) continue;
    colorings.push({
      chainId,
      authSeqId,
      color: heatmapColor(freq),
    });
  }

  return colorings;
}