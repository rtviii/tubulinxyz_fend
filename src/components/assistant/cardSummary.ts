// Builds the per-action lines shown in the post-navigation toast — one line per
// thing the assistant did ("Loaded 6S8L:A", "Aligned 9Y9Z:1A", "Focused residues
// 140-180"), entirely from fields the backend already resolved (real
// rcsb_id/chain + organism selectors). No LLM call. Organism names are an
// optional enrichment, omitted cleanly when the tax-name lookup can't resolve.

import type { ActionCard } from './globalTypes';

type TaxNameOf = (id: number) => string | undefined;

// tubulin_alpha -> "α-tubulin" (mirrors formatFamily in ViewerAssistantPanel).
function familyLabel(f?: string): string | null {
  if (!f) return null;
  if (f.startsWith('tubulin_')) {
    const suffix = f.slice('tubulin_'.length);
    const sym = ({ alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε' } as Record<string, string>)[suffix];
    return sym ? `${sym}-tubulin` : f;
  }
  return f;
}

// " — Homo sapiens α" / " — α" / "".
function tag(org: string | undefined, famSym: string | null): string {
  const parts = [org, famSym].filter(Boolean);
  return parts.length ? ` — ${parts.join(' ')}` : '';
}

export function summarizeCardLines(card: ActionCard, taxNameOf: TaxNameOf = () => undefined): string[] {
  const fam = familyLabel(card.family);
  const famSym = fam && fam.includes('-tubulin') ? fam.split('-')[0] : null;
  const lines: string[] = [];

  switch (card.action) {
    case 'open_expert': {
      if (card.rcsb_id) {
        const org = card.primary_organism_id !== undefined ? taxNameOf(card.primary_organism_id) : undefined;
        lines.push(`Loaded ${card.rcsb_id}:${card.primary_chain ?? '?'}${tag(org, famSym)}`);
      }
      const aligned = card.aligned ?? [];
      const ids = card.aligned_organism_ids ?? [];
      aligned.forEach((a, i) => {
        const org = ids.length === aligned.length ? taxNameOf(ids[i]) : undefined;
        lines.push(`Aligned ${a.rcsb_id}:${a.auth_asym_id}${tag(org, famSym)}`);
      });
      if (card.focus_range) lines.push(`Focused residues ${card.focus_range.start}–${card.focus_range.end}`);
      break;
    }

    case 'open_structure': {
      if (card.rcsb_id) lines.push(`Opened ${card.rcsb_id}${famSym ? ` — ${famSym}` : ''}`);
      if (card.focus_chains?.length) lines.push(`Chain ${card.focus_chains.join(', ')}`);
      if (card.focus_ligands?.length) lines.push(`Ligand ${card.focus_ligands.join(', ')}`);
      break;
    }

    case 'inspect_ligand': {
      if (card.rcsb_id) lines.push(`Opened ${card.rcsb_id}${card.suggested_chain ? `:${card.suggested_chain}` : ''}`);
      if (card.chemical_id) lines.push(`Showing the ${card.chemical_id} binding site`);
      break;
    }

    case 'view_variants': {
      lines.push(`Showing ${fam ?? 'tubulin'} variants`);
      if (card.position_min !== undefined && card.position_max !== undefined) {
        lines.push(`Positions ${card.position_min}–${card.position_max}`);
      }
      break;
    }

    case 'open_catalogue':
      lines.push(`Filtered catalogue: ${card.label}`);
      break;

    default:
      lines.push(card.label);
  }

  return lines.length ? lines : [card.label];
}
