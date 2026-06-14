'use client';

// Renders a run of answer text where tokens that correspond to a GROUNDED demo
// entity (a binding residue's position, a demo chain, a demo-bound ligand)
// become hover-to-highlight spans wired to the landing demo's Molstar instance.
// Hover → ephemeral 3D highlight; mouse-out → clear. Nothing here mutates
// persistent viewer state.
//
// Honesty contract (same spirit as PillifiedText): only entities that pass
// canGroundOnDemo become interactive — we never regex-invent a clickable number.
// A residue's DISPLAYED number is its master/canonical position (what the prose
// says); the HIGHLIGHT uses the backend-grounded auth_seq_id in start/end, so
// the 3D lands on the right residue even when the two numbering spaces differ.

import { useMemo, type ReactNode } from 'react';
import type { MolstarInstance } from '@/components/molstar/services/MolstarInstance';
import type { EntityRef } from './globalTypes';
import {
  applyHighlight,
  applyFocus,
  canGroundOnDemo,
  formatFamily,
  toneFor,
  type DemoGrounding,
} from './entityHighlight';

interface Match {
  text: string;          // the literal token to find in the prose
  entity: EntityRef;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Common ligand trivial names so hovering "taxol" (not just "TA1") lights the
// pocket. Mirrors the LIGAND NAMING line in the orchestrator prompt.
const CHEM_TRIVIAL: Record<string, string[]> = {
  TA1: ['taxol', 'paclitaxel'],
  LOC: ['colchicine'],
  VLB: ['vinblastine'],
  MYT: ['maytansine'],
  GTP: ['GTP'],
  GDP: ['GDP'],
};

// Build the literal strings that should become interactive for a grounded
// entity. Residues match on their master position (what the prose prints);
// chains match a family label and/or "chain X"; ligands/pockets match the chem
// id and common trivial names (so the ligand word lights the whole pocket).
function matchStringsFor(e: EntityRef): string[] {
  if (e.kind === 'residue_range') {
    // Prose prints MASTER positions; master_index anchors the run's start. For a
    // collapsed span, also match the master span "a-b"/"a–b" AND each interior
    // number, so the model writing "423-444" OR "423, 424, …" both light the run.
    const ms = e.master_index ?? e.start;
    if (ms === undefined) return [];
    if (e.start !== undefined && e.end !== undefined && e.end > e.start) {
      const me = ms + (e.end - e.start);
      const out = [`${ms}-${me}`, `${ms}–${me}`];
      for (let n = ms; n <= me; n++) out.push(String(n));
      return out;
    }
    return [String(ms)];
  }
  if (e.kind === 'region') {
    // The named region's label as a hover target ("C-terminal tail"). Skip the
    // span-fallback labels ("region 270-288") and too-short labels — they won't
    // appear verbatim in prose and shouldn't grab common words.
    const l = e.label ?? '';
    if (!l || l.startsWith('region ') || l.length < 4) return [];
    return [l];
  }
  if (e.kind === 'chain') {
    const out: string[] = [];
    if (e.family) out.push(formatFamily(e.family));
    if (e.auth_asym_id) out.push(`chain ${e.auth_asym_id}`);
    return out;
  }
  if (e.kind === 'ligand' || e.kind === 'residue_set') {
    if (!e.chemical_id) return [];
    return [e.chemical_id, ...(CHEM_TRIVIAL[e.chemical_id.toUpperCase()] ?? [])];
  }
  return [];
}

export interface EntityHoverTextProps {
  text: string;
  entities: EntityRef[];
  instance: MolstarInstance | null;
  grounding: DemoGrounding | null;
}

export function EntityHoverText({ text, entities, instance, grounding }: EntityHoverTextProps) {
  const { matches, regex } = useMemo(() => {
    const list: Match[] = [];
    for (const e of entities) {
      if (!canGroundOnDemo(e, grounding)) continue;
      for (const m of matchStringsFor(e)) list.push({ text: m, entity: e });
    }
    if (list.length === 0) return { matches: list, regex: null as RegExp | null };
    // Longest first so "chain A" wins over "A"; word-boundary so "224" doesn't
    // match inside "1224".
    const sorted = [...list].sort((a, b) => b.text.length - a.text.length);
    const re = new RegExp(`\\b(${sorted.map((m) => escapeRegex(m.text)).join('|')})\\b`, 'gi');
    return { matches: sorted, regex: re };
  }, [entities, grounding]);

  if (!regex || matches.length === 0) return <>{text}</>;

  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  regex.lastIndex = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) out.push(<span key={key++}>{text.slice(last, m.index)}</span>);
    const matched = m[1];
    const entry = matches.find((x) => x.text.toLowerCase() === matched.toLowerCase());
    if (entry) {
      const tone = toneFor(entry.entity);
      out.push(
        <span
          key={key++}
          className={`rounded px-0.5 -mx-0.5 border-b border-dotted cursor-pointer transition-colors ${tone}`}
          onMouseEnter={() => applyHighlight(instance, entry.entity, true)}
          onMouseLeave={() => applyHighlight(instance, entry.entity, false)}
          onClick={() => applyFocus(instance, entry.entity)}
          title="Hover to highlight in the 3D viewer"
        >
          {matched}
        </span>,
      );
    } else {
      out.push(<span key={key++}>{matched}</span>);
    }
    last = m.index + matched.length;
  }
  if (last < text.length) out.push(<span key={key++}>{text.slice(last)}</span>);
  return <>{out}</>;
}
