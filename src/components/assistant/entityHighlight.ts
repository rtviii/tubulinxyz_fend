// Shared entity → Molstar helpers, extracted from ViewerAssistantPanel so both
// the structure-page pills and the landing-page inline hover text drive the
// SAME ephemeral, non-destructive highlight layer
// (instance.highlight* → viewer.highlightLoci → managers.interactivity.lociHighlights).
// Highlights clear on mouse-out and never mutate the persistent representation,
// so they're safe to fire on a spinning demo or over expert-mode state.

import { Eye, Layers, FlaskConical, MapPin, HelpCircle, Target, type LucideIcon } from 'lucide-react';
import { Color } from 'molstar/lib/mol-util/color';
import type { MolstarInstance } from '@/components/molstar/services/MolstarInstance';
import { CATEGORY_PAINT } from '@/lib/colors/annotationPalette';
import type { EntityKind, EntityRef } from './globalTypes';

export interface EntityKindMeta {
  Icon: LucideIcon;
  tone: string;
  label: string;
}

export const KIND_META: Record<EntityKind, EntityKindMeta> = {
  chain: { Icon: Layers, tone: 'text-violet-600 bg-violet-50 border-violet-200', label: 'Chain' },
  residue_range: { Icon: MapPin, tone: 'text-emerald-600 bg-emerald-50 border-emerald-200', label: 'Residue' },
  residue_set: { Icon: Target, tone: 'text-amber-700 bg-amber-50 border-amber-200', label: 'Pocket' },
  region: { Icon: Target, tone: 'text-sky-700 bg-sky-50 border-sky-200', label: 'Region' },
  ligand: { Icon: FlaskConical, tone: 'text-amber-600 bg-amber-50 border-amber-200', label: 'Ligand' },
  structure: { Icon: Eye, tone: 'text-slate-600 bg-slate-50 border-slate-200', label: 'Structure' },
  polymer_entity: { Icon: Layers, tone: 'text-violet-600 bg-violet-50 border-violet-200', label: 'Entity' },
  family: { Icon: Layers, tone: 'text-rose-600 bg-rose-50 border-rose-200', label: 'Family' },
  variant: { Icon: HelpCircle, tone: 'text-rose-600 bg-rose-50 border-rose-200', label: 'Variant' },
};

// Per-category tint, so binding / PTM / variant / interface residues read
// differently at a glance. Falls back to the kind's tone when an entity carries
// no category.
const CATEGORY_TONE: Record<string, string> = {
  binding: 'text-amber-700 bg-amber-50 border-amber-200',
  modification: 'text-indigo-700 bg-indigo-50 border-indigo-200',
  variant: 'text-orange-700 bg-orange-50 border-orange-200',
  interface: 'text-emerald-700 bg-emerald-50 border-emerald-200',
};

export function toneFor(e: EntityRef): string {
  if (e.category && CATEGORY_TONE[e.category]) return CATEGORY_TONE[e.category];
  return KIND_META[e.kind]?.tone ?? '';
}

// ---------------------------------------------------------------------------
// Demo honesty gate (landing page)
// ---------------------------------------------------------------------------

export interface DemoGrounding {
  // auth_asym_ids that actually exist in the loaded demo structure.
  chainIds: Set<string>;
  // Residue-level highlighting is only enabled on the clean dimer tab; the
  // backend has already grounded residue entities' start/end to real
  // auth_seq_ids on these chains, so this is a secondary sanity gate.
  allowResidues: boolean;
}

// Can this entity be HONESTLY highlighted on the current demo instance? Only
// true when the entity addresses a chain that exists in the demo (and, for
// residues, the coordinate is present). Everything else renders as plain text /
// navigation — never a fake highlight that lands on the wrong residue.
export function canGroundOnDemo(e: EntityRef, g: DemoGrounding | null): boolean {
  if (!g) return false;
  if (e.kind === 'chain') return !!e.auth_asym_id && g.chainIds.has(e.auth_asym_id);
  if (e.kind === 'residue_range') {
    return (
      g.allowResidues &&
      !!e.auth_asym_id &&
      g.chainIds.has(e.auth_asym_id) &&
      e.start !== undefined &&
      e.end !== undefined
    );
  }
  if (e.kind === 'residue_set' || e.kind === 'region') {
    return g.allowResidues && !!e.auth_asym_id && g.chainIds.has(e.auth_asym_id) && !!e.positions?.length;
  }
  if (e.kind === 'ligand') {
    return !!e.auth_asym_id && g.chainIds.has(e.auth_asym_id) && e.auth_seq_id !== undefined;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Per-entity dispatch (ephemeral highlight / camera focus)
// ---------------------------------------------------------------------------

export function isInteractive(e: EntityRef): boolean {
  if (e.kind === 'chain') return !!e.auth_asym_id;
  if (e.kind === 'residue_range') return !!e.auth_asym_id && e.start !== undefined && e.end !== undefined;
  if (e.kind === 'residue_set' || e.kind === 'region') return !!e.auth_asym_id && !!e.positions?.length;
  if (e.kind === 'ligand') return !!e.auth_asym_id && e.auth_seq_id !== undefined;
  return false;
}

// Does a molstar hover (chainId + authSeqId) land inside this entity?
export function matchesHover(e: EntityRef, chainId: string, authSeqId: number): boolean {
  if (e.kind === 'chain') {
    return e.auth_asym_id === chainId;
  }
  if (e.kind === 'residue_range') {
    return (
      e.auth_asym_id === chainId &&
      e.start !== undefined &&
      e.end !== undefined &&
      authSeqId >= e.start &&
      authSeqId <= e.end
    );
  }
  if (e.kind === 'residue_set' || e.kind === 'region') {
    return e.auth_asym_id === chainId && !!e.positions?.includes(authSeqId);
  }
  if (e.kind === 'ligand') {
    return e.auth_asym_id === chainId && e.auth_seq_id === authSeqId;
  }
  return false;
}

export function formatFamily(f: string): string {
  if (f.startsWith('tubulin_')) {
    const suffix = f.slice('tubulin_'.length);
    const sym = ({ alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε' } as Record<string, string>)[suffix];
    return sym ? `${sym}-tubulin` : f;
  }
  return f;
}

export function labelFor(e: EntityRef): string {
  switch (e.kind) {
    case 'chain':
      return e.auth_asym_id ?? '?';
    case 'residue_range':
      if (e.auth_asym_id && e.start !== undefined && e.end !== undefined) {
        return e.start === e.end ? `${e.auth_asym_id}:${e.start}` : `${e.auth_asym_id}:${e.start}-${e.end}`;
      }
      return 'range';
    case 'residue_set': {
      const n = e.positions?.length ?? 0;
      const lig = e.chemical_id ? `${e.chemical_id} ` : '';
      return `${lig}pocket (${n})`;
    }
    case 'region': {
      const n = e.positions?.length ?? 0;
      return `${e.label ?? 'region'} (${n})`;
    }
    case 'ligand':
      if (e.chemical_id && e.auth_asym_id && e.auth_seq_id !== undefined) {
        return `${e.chemical_id} @ ${e.auth_asym_id}:${e.auth_seq_id}`;
      }
      return e.chemical_id ?? 'ligand';
    case 'structure':
      return e.rcsb_id ?? 'structure';
    case 'polymer_entity':
      return e.rcsb_id && e.entity_id ? `${e.rcsb_id}:${e.entity_id}` : 'entity';
    case 'family':
      return formatFamily(e.family ?? '');
    case 'variant':
      return e.wild_type && e.master_index !== undefined && e.observed
        ? `${e.wild_type}${e.master_index}${e.observed}`
        : 'variant';
    default:
      return '?';
  }
}

// Accent color for the hover label — the residue's category (binding/PTM/variant)
// so a glance at the label tells you what it is; falls back to molstar's default.
function labelAccent(e: EntityRef): Color | undefined {
  const hex = e.category ? CATEGORY_PAINT[e.category] : undefined;
  return hex ? Color(parseInt(hex.slice(1), 16)) : undefined;
}

// Show a transient 3D label for the entity being hovered (region name, pocket,
// "B:272", chain family) — the same label style the manual demos use.
function showEntityLabel(instance: MolstarInstance, e: EntityRef): void {
  const text = labelFor(e);
  const color = labelAccent(e);
  if (e.kind === 'chain' && e.auth_asym_id) {
    void instance.showComponentLabel(e.auth_asym_id);
  } else if (e.kind === 'residue_range' && e.auth_asym_id && e.start !== undefined && e.end !== undefined) {
    const ids: number[] = [];
    for (let a = e.start; a <= e.end; a++) ids.push(a);
    void instance.showResiduesLabel(e.auth_asym_id, ids, text, color);
  } else if ((e.kind === 'residue_set' || e.kind === 'region') && e.auth_asym_id && e.positions?.length) {
    void instance.showResiduesLabel(e.auth_asym_id, e.positions, text, color);
  } else if (e.kind === 'ligand' && e.auth_asym_id && e.auth_seq_id !== undefined) {
    void instance.showResiduesLabel(e.auth_asym_id, [e.auth_seq_id], text, color);
  }
}

export function applyHighlight(instance: MolstarInstance | null, e: EntityRef, on: boolean): void {
  if (!instance) return;
  try {
    if (e.kind === 'chain' && e.auth_asym_id) {
      instance.highlightChain(e.auth_asym_id, on);
    } else if (e.kind === 'residue_range' && e.auth_asym_id && e.start !== undefined && e.end !== undefined) {
      instance.highlightResidueRange(e.auth_asym_id, e.start, e.end, on);
    } else if ((e.kind === 'residue_set' || e.kind === 'region') && e.auth_asym_id && e.positions?.length) {
      instance.highlightResidues(e.auth_asym_id, e.positions, on);
    } else if (e.kind === 'ligand' && e.auth_asym_id && e.auth_seq_id !== undefined) {
      // Ligands are single residues in molstar terms.
      instance.highlightResidueRange(e.auth_asym_id, e.auth_seq_id, e.auth_seq_id, on);
    }
    // Transient label travels with the highlight: show on hover-in, clear on out.
    if (on) showEntityLabel(instance, e);
    else instance.hideHoverLabel();
  } catch { /* swallow — molstar can throw if state changed underneath */ }
}

export function applyFocus(instance: MolstarInstance | null, e: EntityRef): void {
  if (!instance) return;
  try {
    if (e.kind === 'chain' && e.auth_asym_id) {
      instance.focusChain(e.auth_asym_id);
    } else if (e.kind === 'residue_range' && e.auth_asym_id && e.start !== undefined && e.end !== undefined) {
      instance.focusResidueRange(e.auth_asym_id, e.start, e.end);
    } else if ((e.kind === 'residue_set' || e.kind === 'region') && e.auth_asym_id && e.positions?.length) {
      instance.focusResidues(e.auth_asym_id, e.positions);
    } else if (e.kind === 'ligand' && e.auth_asym_id && e.auth_seq_id !== undefined) {
      instance.focusResidue(e.auth_asym_id, e.auth_seq_id);
    }
  } catch { /* swallow */ }
}
