// Turn a raw viewer action ({type, args}) into a legible step row for the
// ActionPlanCard: an icon + a short label + an optional muted detail. Used for
// both a card's arrival_actions (what happens after you navigate) and a landing
// suggested_action (what clicking the chip does). Never throws — an unknown type
// falls back to a generic row so a new backend verb degrades gracefully.

import {
  Layers, MapPin, Eye, EyeOff, Crosshair, FlaskConical, Tag, Dna, GitCompare,
  Eraser, Sparkles, type LucideIcon,
} from 'lucide-react';
import type { AssistantViewerActionCall } from './types';

export interface HumanStep {
  icon: LucideIcon;
  label: string;
  detail?: string;
}

function familySym(f?: unknown): string | null {
  if (typeof f !== 'string') return null;
  if (f.startsWith('tubulin_')) {
    const sym = ({ alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε' } as Record<string, string>)[
      f.slice('tubulin_'.length)
    ];
    return sym ? `${sym}-tubulin` : f;
  }
  return f;
}

const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
const num = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined);

export function humanizeViewerAction(call: AssistantViewerActionCall): HumanStep {
  const a = (call.args ?? {}) as Record<string, unknown>;
  const chain = str(a.auth_asym_id);

  switch (call.type) {
    case 'FocusChain':
      return { icon: Crosshair, label: 'Focus chain', detail: chain };
    case 'HighlightChain':
      return { icon: Layers, label: 'Highlight chain', detail: chain };
    case 'SetChainVisibility':
      return {
        icon: a.visible === false ? EyeOff : Eye,
        label: a.visible === false ? 'Hide chain' : 'Show chain',
        detail: chain,
      };
    case 'IsolateChain':
      return { icon: Eye, label: 'Isolate chain', detail: chain };
    case 'FocusResidue':
      return { icon: MapPin, label: 'Focus residue', detail: chain && num(a.auth_seq_id) !== undefined ? `${chain}:${num(a.auth_seq_id)}` : chain };
    case 'FocusResidueRange':
      return { icon: MapPin, label: 'Focus residues', detail: chain ? `${chain}:${num(a.start)}–${num(a.end)}` : undefined };
    case 'HighlightResidueRange':
      return { icon: MapPin, label: 'Highlight residues', detail: chain ? `${chain}:${num(a.start)}–${num(a.end)}` : undefined };
    case 'ClearFocus':
      return { icon: Eraser, label: 'Reset camera' };
    case 'ClearHighlight':
      return { icon: Eraser, label: 'Clear highlights' };
    case 'AlignChain': {
      const rcsb = str(a.rcsb_id);
      const detail = rcsb ? `${rcsb}${chain ? `:${chain}` : ''}` : familySym(a.family) ?? undefined;
      return { icon: GitCompare, label: 'Add to alignment', detail };
    }
    case 'AddAnnotationTrack': {
      const spec = (a.spec ?? {}) as Record<string, unknown>;
      const kind = str(spec.kind);
      const fam = familySym(spec.family);
      const label = str(a.label);
      if (kind === 'binding_contacts') {
        const ligs = Array.isArray(spec.chemical_ids) ? (spec.chemical_ids as unknown[]).map(String).join(', ') : undefined;
        return { icon: FlaskConical, label: label || 'Paint binding site', detail: [ligs, fam].filter(Boolean).join(' · ') || undefined };
      }
      if (kind === 'modifications') {
        return { icon: Tag, label: label || 'Paint modifications', detail: fam ?? undefined };
      }
      if (kind === 'variants') {
        return { icon: Dna, label: label || 'Paint variants', detail: fam ?? undefined };
      }
      return { icon: Tag, label: label || 'Add annotation track', detail: fam ?? undefined };
    }
    case 'RemoveAnnotationTrack':
      return { icon: Eraser, label: 'Remove track', detail: str(a.label_match) };
    case 'FocusBindingSite':
      return { icon: FlaskConical, label: 'Focus binding site', detail: [str(a.chemical_id), chain].filter(Boolean).join(' on ') || undefined };
    default:
      return { icon: Sparkles, label: call.type };
  }
}
