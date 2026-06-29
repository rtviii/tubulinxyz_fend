// Translate an ActionCard returned by /nl_query/global into a URL the user
// will be navigated to. Pure function — no React, no router. The call site
// (a list-of-cards UI component) calls router.push(url) on click.
//
// URL construction reuses the helpers in @/lib/url_state so the catalogue
// and structure-detail param contracts stay in one place.

import {
  buildCatalogueUrl,
  buildStructureUrl,
  type StructureViewParams,
} from '@/lib/url_state';
import type { UiFilters } from '@/app/structures/StructureFiltersPanel';
import type { ActionCard, QuerySpec } from './globalTypes';

// Convert the backend's snake_case filter shape to the camelCase UiFilters
// shape the URL helpers expect. Mirrors the inverse of `nlFilterMapper.ts`
// for the keys we serialize into URL params.
function backendStructureFiltersToUi(bf: Record<string, unknown>): Partial<UiFilters> {
  const out: Partial<UiFilters> = {};
  const s = (k: string) => (typeof bf[k] === 'string' ? (bf[k] as string) : undefined);
  const n = (k: string) => (typeof bf[k] === 'number' ? (bf[k] as number) : undefined);
  const b = (k: string) => (typeof bf[k] === 'boolean' ? (bf[k] as boolean) : undefined);
  const arrS = (k: string): string[] | undefined => {
    const v = bf[k];
    return Array.isArray(v) && v.every(x => typeof x === 'string') ? (v as string[]) : undefined;
  };
  const arrN = (k: string): number[] | undefined => {
    const v = bf[k];
    return Array.isArray(v) && v.every(x => typeof x === 'number') ? (v as number[]) : undefined;
  };

  if (s('search') !== undefined) out.search = s('search');
  if (arrS('rcsb_ids')) out.ids = arrS('rcsb_ids');
  if (arrS('exp_method')) out.expMethod = arrS('exp_method');
  if (arrS('polymerization_state')) out.polyState = arrS('polymerization_state');
  if (arrS('has_polymer_family')) out.family = arrS('has_polymer_family');
  if (arrS('has_isotype')) out.isotype = arrS('has_isotype');
  if (arrS('has_ligand_ids')) out.ligands = arrS('has_ligand_ids');
  if (arrS('has_uniprot')) out.uniprot = arrS('has_uniprot');
  // NOTE: StructureFilters.source_organism_ids has the Pydantic alias `sourceTaxa`,
  // and FastAPI serializes responses by_alias — so the wire key is `sourceTaxa`.
  // Accept both so query filters from the assistant/global endpoints round-trip.
  const sourceTaxa = arrN('source_organism_ids') ?? arrN('sourceTaxa');
  if (sourceTaxa) out.sourceTaxa = sourceTaxa;
  if (arrN('host_organism_ids')) out.hostTaxa = arrN('host_organism_ids');

  if (n('resolution_min') !== undefined) out.resMin = n('resolution_min');
  if (n('resolution_max') !== undefined) out.resMax = n('resolution_max');
  if (n('year_min') !== undefined) out.yearMin = n('year_min');
  if (n('year_max') !== undefined) out.yearMax = n('year_max');

  if (b('has_any_map') !== undefined) out.hasAnyMap = b('has_any_map');
  if (b('has_variants') !== undefined) out.hasVariants = b('has_variants');
  if (s('variant_family') !== undefined) out.variantFamily = s('variant_family');
  if (s('variant_type') !== undefined) out.variantType = s('variant_type');
  if (n('variant_position_min') !== undefined) out.variantPosMin = n('variant_position_min');
  if (n('variant_position_max') !== undefined) out.variantPosMax = n('variant_position_max');
  if (s('variant_wild_type') !== undefined) out.variantWildType = s('variant_wild_type');
  if (s('variant_observed') !== undefined) out.variantObserved = s('variant_observed');
  if (s('variant_source') !== undefined) out.variantSource = s('variant_source');

  return out;
}

function viewVariantsToUiFilters(card: ActionCard): Partial<UiFilters> {
  const out: Partial<UiFilters> = { hasVariants: true };
  if (card.family) out.variantFamily = card.family;
  if (card.variant_type) out.variantType = card.variant_type;
  if (card.position_min !== undefined) out.variantPosMin = card.position_min;
  if (card.position_max !== undefined) out.variantPosMax = card.position_max;
  return out;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface CardNavTarget {
  href: string;
  // If true, this card is a clarification — should not navigate, just display.
  isClarify?: boolean;
}

export function cardToHref(card: ActionCard, queries: QuerySpec[]): CardNavTarget {
  switch (card.action) {
    case 'clarify':
      return { href: '#', isClarify: true };

    case 'open_catalogue': {
      // Preferred path: a referenced query (global-endpoint flow).
      const q = queries.find(qq => qq.id === card.query_ref);
      if (q && q.target === 'structures' && q.filters_structures) {
        return { href: buildCatalogueUrl(backendStructureFiltersToUi(q.filters_structures)) };
      }
      // Fallback: LLM may encode filter intent directly on the card (the
      // global endpoint should use queries+query_ref, but the viewer endpoint
      // and fail-loud organism cards can't reference queries).
      const fallback: Partial<UiFilters> = {};
      if (card.focus_ligands?.length) fallback.ligands = card.focus_ligands;
      if (card.family) fallback.family = [card.family];
      if (card.source_organism_ids?.length) fallback.sourceTaxa = card.source_organism_ids;
      if (card.rcsb_id) fallback.ids = [card.rcsb_id];
      return { href: buildCatalogueUrl(fallback) };
    }

    case 'open_structure': {
      if (!card.rcsb_id) return { href: '/structures' };
      const params: StructureViewParams = {
        mode: 'structure',
      };
      if (card.focus_chains?.length) params.chain = card.focus_chains[0];
      if (card.focus_ligands?.length) params.focusLigand = card.focus_ligands[0];
      return { href: buildStructureUrl(card.rcsb_id, params) };
    }

    case 'open_expert': {
      if (!card.rcsb_id) return { href: '/structures' };
      const params: StructureViewParams = { mode: 'monomer' };
      if (card.primary_chain) params.chain = card.primary_chain;
      if (card.aligned?.length) {
        params.align = card.aligned.map(a => ({
          pdbId: a.rcsb_id,
          authAsymId: a.auth_asym_id,
        }));
      }
      if (card.focus_range) params.range = card.focus_range;
      return { href: buildStructureUrl(card.rcsb_id, params) };
    }

    case 'inspect_ligand': {
      // Prefer a deep link into a specific structure; fall back to the
      // catalogue filtered by the ligand id.
      if (card.rcsb_id) {
        const params: StructureViewParams = { mode: 'monomer' };
        if (card.suggested_chain) params.chain = card.suggested_chain;
        if (card.chemical_id) params.focusLigand = card.chemical_id;
        return { href: buildStructureUrl(card.rcsb_id, params) };
      }
      if (card.chemical_id) {
        return { href: buildCatalogueUrl({ ligands: [card.chemical_id] }) };
      }
      return { href: '/structures' };
    }

    case 'view_variants': {
      return { href: buildCatalogueUrl(viewVariantsToUiFilters(card)) };
    }

    default: {
      const _exhaustive: never = card.action;
      void _exhaustive;
      return { href: '/structures' };
    }
  }
}
