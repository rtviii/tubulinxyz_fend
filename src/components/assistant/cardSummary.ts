// Pure summary builder for the post-navigation toast. Turns a clicked
// ActionCard into a one-line "here's what I did" sentence, entirely from fields
// the backend already resolved (real rcsb_id/chain + organism selectors). No
// LLM call. Organism names are an optional enrichment — omitted cleanly when the
// tax-name lookup can't resolve an id (e.g. user named a specific PDB id).

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

// Compact per-structure annotation: "(Homo sapiens α)", "(α)", or "".
function annot(orgName: string | undefined, famSym: string | null): string {
  const parts = [orgName, famSym].filter(Boolean);
  return parts.length ? ` (${parts.join(' ')})` : '';
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

export function summarizeCard(card: ActionCard, taxNameOf: TaxNameOf = () => undefined): string {
  const fam = familyLabel(card.family);
  const famSym = fam && fam.includes('-tubulin') ? fam.split('-')[0] : null;

  switch (card.action) {
    case 'open_expert': {
      if (!card.rcsb_id) return card.label;
      const primaryOrg = card.primary_organism_id !== undefined ? taxNameOf(card.primary_organism_id) : undefined;
      const primary = `${card.rcsb_id}:${card.primary_chain ?? '?'}${annot(primaryOrg, famSym)}`;

      const aligned = card.aligned ?? [];
      let s: string;
      if (aligned.length > 0) {
        const alignedIds = card.aligned_organism_ids ?? [];
        const alignedStrs = aligned.map((a, i) => {
          const org = alignedIds.length === aligned.length ? taxNameOf(alignedIds[i]) : undefined;
          return `${a.rcsb_id}:${a.auth_asym_id}${annot(org, famSym)}`;
        });
        s = `Aligned ${primary} with ${joinList(alignedStrs)}`;
      } else {
        s = `Opened ${primary} in expert mode`;
      }
      if (card.focus_range) s += `; focused residues ${card.focus_range.start}-${card.focus_range.end}`;
      return s + '.';
    }

    case 'open_structure': {
      if (!card.rcsb_id) return card.label;
      const bits: string[] = [];
      if (card.focus_chains?.length) bits.push(`chain ${card.focus_chains.join(', ')}`);
      if (card.focus_ligands?.length) bits.push(card.focus_ligands.join(', '));
      return `Opened ${card.rcsb_id}${bits.length ? ` — ${bits.join('; ')}` : ''}.`;
    }

    case 'inspect_ligand': {
      if (!card.chemical_id) return card.label;
      let s = `Showing the ${card.chemical_id} binding site`;
      if (card.rcsb_id) s += ` in ${card.rcsb_id}${card.suggested_chain ? `:${card.suggested_chain}` : ''}`;
      return s + '.';
    }

    case 'view_variants': {
      let s = `Showing ${fam ?? 'tubulin'} variants`;
      if (card.position_min !== undefined && card.position_max !== undefined) {
        s += ` at positions ${card.position_min}-${card.position_max}`;
      }
      return s + '.';
    }

    case 'open_catalogue':
      return `Showing structures: ${card.label}`;

    default:
      return card.label;
  }
}
