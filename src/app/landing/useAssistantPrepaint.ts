'use client';

// Pre-paints the landing demo's β/α chains by category when an assistant answer
// arrives, so the answer reads like a colored figure: binding residues amber,
// PTMs indigo, variants orange. Persistent overpaint via the same path the
// manual demos use (applyColorscheme -> setStructureOverpaint), restored to the
// base ghost coloring when the answer is dismissed.
//
// Mutual exclusion with manual demos: `enabled` is false whenever a demo owns
// the overpaint layer (or we're on the lattice tab), and we never restore while
// disabled — so a demo taking over is never clobbered (its own applyColorscheme
// clears our layer as it paints). Spin/camera are untouched by this path.

import { useEffect, useRef } from 'react';
import { Color } from 'molstar/lib/mol-util/color';
import type { MolstarInstance } from '@/components/molstar/services/MolstarInstance';
import type { ResidueColoring } from '@/components/molstar/coloring/types';
import type { AssistantResult } from '@/components/assistant/types';
import type { EntityRef } from '@/components/assistant/globalTypes';
import { CATEGORY_PAINT } from '@/lib/colors/annotationPalette';

const CATEGORY_COLOR: Record<string, Color> = Object.fromEntries(
  Object.entries(CATEGORY_PAINT).map(([k, hex]) => [k, Color(parseInt(hex.slice(1), 16))]),
);

function buildCategoryColorings(
  response: AssistantResult | null,
  chainIds: string[],
): ResidueColoring[] {
  const entities = response?.entities;
  if (!entities?.length) return [];
  const allowed = new Set(chainIds);
  const seen = new Set<string>();
  const out: ResidueColoring[] = [];
  const add = (chainId: string | undefined, authSeqId: number, category?: string) => {
    if (!chainId || !category || !allowed.has(chainId)) return;
    const color = CATEGORY_COLOR[category];
    if (!color) return;
    const key = `${chainId}:${authSeqId}`;
    if (seen.has(key)) return; // first category wins for a residue
    seen.add(key);
    out.push({ chainId, authSeqId, color });
  };
  for (const e of entities as EntityRef[]) {
    if (e.kind === 'residue_range' && e.start !== undefined && e.end !== undefined) {
      for (let a = e.start; a <= e.end; a++) add(e.auth_asym_id, a, e.category);
    } else if ((e.kind === 'residue_set' || e.kind === 'region') && e.positions?.length) {
      for (const a of e.positions) add(e.auth_asym_id, a, e.category);
    }
  }
  return out;
}

async function restoreBase(instance: MolstarInstance) {
  try {
    await instance.restoreDefaultColors();
    await instance.setStructureGhostColors(true);
  } catch { /* viewer may be mid-rebuild */ }
}

export function useAssistantPrepaint(
  instance: MolstarInstance | null,
  response: AssistantResult | null,
  opts: { chainIds: string[]; enabled: boolean },
): void {
  const { chainIds, enabled } = opts;
  const paintedRef = useRef(false);

  useEffect(() => {
    if (!instance || !enabled) return; // a demo owns the layer, or wrong tab
    const colorings = buildCategoryColorings(response, chainIds);
    (async () => {
      try {
        if (colorings.length === 0) {
          if (paintedRef.current) {
            await restoreBase(instance);
            paintedRef.current = false;
          }
        } else {
          await instance.applyColorscheme('assistant-category', colorings);
          paintedRef.current = true;
        }
      } catch { /* viewer busy */ }
    })();
  }, [instance, response, enabled, chainIds]);
}
