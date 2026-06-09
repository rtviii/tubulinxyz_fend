'use client';

// Renders the response from /nl_query/global: a short blurb on top + a
// ranked grid of action cards below. Each card is one click → one URL
// navigation (built by globalCommandDispatcher). Validation results from the
// backend dim/disable any card whose primary entity didn't pass hydration.
//
// Card polish (Phase 4):
//  - structure thumbnails on open_structure / open_expert / inspect_ligand
//  - real result counts on open_catalogue (RTK Query, limit:1)
//  - family color stripe on view_variants

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, LayoutGrid, Eye, Microscope, FlaskConical, Dna, HelpCircle } from 'lucide-react';
import { useListStructuresQuery, type ListStructuresApiArg } from '@/store/tubxz_api';
import { getHexForFamily } from '@/components/molstar/colors/palette';
import { API_BASE_URL } from '@/config';
import type { ActionCard, ActionKind, GlobalNLResponse, QuerySpec } from './globalTypes';
import { cardToHref } from './globalCommandDispatcher';
import { PillifiedText, entitiesFromGlobalResponse, inlineEntitiesFromCard } from './PillifiedText';
import { useAppDispatch } from '@/store/store';
import { showAssistantToast } from '@/store/slices/assistantToastSlice';

const ACTION_META: Record<ActionKind, { label: string; Icon: typeof LayoutGrid; tone: string }> = {
  open_catalogue: { label: 'Browse', Icon: LayoutGrid, tone: 'text-slate-500 bg-slate-50 border-slate-200' },
  open_structure: { label: 'Easy mode', Icon: Eye, tone: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  open_expert: { label: 'Expert mode', Icon: Microscope, tone: 'text-violet-600 bg-violet-50 border-violet-200' },
  inspect_ligand: { label: 'Ligand', Icon: FlaskConical, tone: 'text-amber-600 bg-amber-50 border-amber-200' },
  view_variants: { label: 'Variants', Icon: Dna, tone: 'text-rose-600 bg-rose-50 border-rose-200' },
  clarify: { label: 'Clarify', Icon: HelpCircle, tone: 'text-blue-600 bg-blue-50 border-blue-200' },
};

export interface AssistantResultsPanelProps {
  response: GlobalNLResponse;
  onDismiss: () => void;
  // When embedded inside a column (e.g. the landing chat panel) drop the
  // page-width centering so the panel fills its container instead.
  embedded?: boolean;
}

export function AssistantResultsPanel({ response, onDismiss, embedded = false }: AssistantResultsPanelProps) {
  const router = useRouter();
  const dispatch = useAppDispatch();

  // Fade-in on mount.
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    // rAF so the transition has a frame to take effect from the initial state.
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const handleCardClick = (card: ActionCard, ok: boolean) => {
    if (!ok || card.action === 'clarify') return;
    const { href } = cardToHref(card, response.queries);
    if (href && href !== '#') {
      dispatch(showAssistantToast(card));
      router.push(href);
    }
  };

  // Single-clarify shortcut: render just the prompt, no grid.
  const onlyCard = response.cards.length === 1 ? response.cards[0] : null;
  const isClarifyOnly = onlyCard?.action === 'clarify';

  // Inline entities for the blurb — derived from cards so we don't pillify
  // anything that's not real.
  const inlineEntities = entitiesFromGlobalResponse(response);

  return (
    <div
      className={`
        relative w-full ${embedded ? '' : 'max-w-[1400px] mx-auto px-6'}
        transition-all duration-200 ease-out
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'}
      `}
    >
      <div className="rounded-xl border border-slate-200/80 bg-white/95 shadow-sm overflow-hidden">
        {/* Header: blurb + dismiss */}
        <div className="px-4 py-3 flex items-start gap-3 border-b border-slate-100">
          <div className="flex-1 min-w-0">
            {response.blurb ? (
              <PillifiedText
                text={response.blurb}
                entities={inlineEntities}
                className="text-[13px] text-slate-700 leading-snug"
              />
            ) : (
              <p className="text-[11px] text-slate-400 uppercase tracking-wider">
                {isClarifyOnly ? 'Clarification' : `${response.cards.length} suggestion${response.cards.length === 1 ? '' : 's'}`}
              </p>
            )}
          </div>
          <button
            onClick={onDismiss}
            className="flex-shrink-0 p-1 rounded text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Dismiss results"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="p-3">
          {isClarifyOnly && onlyCard?.question ? (
            <p className="text-[13px] text-slate-600 italic px-2 py-2">
              {onlyCard.question}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {response.cards.map((card, i) => {
                const v = response.validation?.[`card_${i}`];
                const ok = v?.ok !== false;
                return (
                  <CardChip
                    key={i}
                    card={card}
                    queries={response.queries}
                    ok={ok}
                    reason={v?.reason}
                    featured={i === 0 && response.cards.length > 1}
                    onClick={() => handleCardClick(card, ok)}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Individual card
// ---------------------------------------------------------------------------

export function CardChip({
  card,
  queries,
  ok,
  reason,
  featured = false,
  onClick,
}: {
  card: ActionCard;
  queries: QuerySpec[];
  ok: boolean;
  reason?: string;
  featured?: boolean;
  onClick: () => void;
}) {
  const meta = ACTION_META[card.action] ?? ACTION_META.open_catalogue;
  const isClickable = ok && card.action !== 'clarify';
  const hasThumb =
    !!card.rcsb_id &&
    (card.action === 'open_structure' || card.action === 'open_expert' || card.action === 'inspect_ligand');
  const isVariants = card.action === 'view_variants';
  const familyHex = isVariants && card.family ? getHexForFamily(card.family) : null;
  const inlineEntities = inlineEntitiesFromCard(card);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!isClickable}
      title={reason}
      className={`
        group relative ${featured ? 'min-w-[280px]' : 'min-w-[240px]'} max-w-[360px] flex-1 text-left rounded-lg border overflow-hidden transition-all
        ${isClickable
          ? `${featured ? 'border-slate-300 shadow-sm' : 'border-slate-200'} bg-white hover:border-slate-400 hover:shadow-md cursor-pointer`
          : 'border-slate-100 bg-slate-50 opacity-60 cursor-not-allowed'
        }
      `}
    >
      <div className="flex">
        {/* Left rail: thumbnail OR family stripe OR icon block */}
        {hasThumb && card.rcsb_id ? (
          <div className="relative flex-shrink-0 w-20 h-20 bg-gradient-to-br from-slate-50 to-slate-100 overflow-hidden">
            <img
              src={`${API_BASE_URL}/structures/${card.rcsb_id}/thumbnail`}
              alt={card.rcsb_id}
              className="w-full h-full object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
            <div className="absolute bottom-0 inset-x-0 bg-black/65 text-white text-[8px] font-mono font-bold px-1 py-px text-center tracking-wider">
              {card.rcsb_id}
            </div>
          </div>
        ) : familyHex ? (
          <div
            className="flex-shrink-0 w-1.5"
            style={{ backgroundColor: familyHex }}
            aria-hidden
          />
        ) : (
          <div className={`flex-shrink-0 w-10 flex items-center justify-center ${meta.tone} border-r border-current/10`}>
            <meta.Icon size={14} />
          </div>
        )}

        {/* Right: content */}
        <div className="flex-1 min-w-0 px-2.5 py-1.5 flex flex-col gap-0.5">
          <div className="flex items-center gap-1 min-w-0">
            <span className={`inline-flex items-center gap-0.5 px-1 py-px text-[8px] uppercase tracking-wider font-medium rounded border flex-shrink-0 ${meta.tone}`}>
              <meta.Icon size={8} />
              {meta.label}
            </span>
            {!ok && reason && (
              <span className="text-[8px] text-amber-500 italic truncate" title={reason}>
                {reason}
              </span>
            )}
          </div>
          <div className={`${featured ? 'text-[12px] font-semibold' : 'text-[12px] font-medium'} text-slate-800 leading-snug line-clamp-1`}>
            {card.label}
          </div>
          {(card.description || card.action === 'open_catalogue') && (
            <div className="text-[10px] text-slate-500 leading-snug flex items-baseline gap-1.5 flex-wrap min-w-0">
              {card.action === 'open_catalogue' && card.query_ref && (
                <CatalogueCount queryRef={card.query_ref} queries={queries} />
              )}
              {card.description && (
                <PillifiedText
                  text={card.description}
                  entities={inlineEntities}
                  interactive={false}
                  className="line-clamp-2"
                />
              )}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Catalogue count — fetches total_count for the referenced query, limit:1
// ---------------------------------------------------------------------------

function CatalogueCount({ queryRef, queries }: { queryRef: string; queries: QuerySpec[] }) {
  const q = queries.find(qq => qq.id === queryRef);
  // Only meaningful for structures-target queries today. Polymers/ligands could
  // be added similarly when their hooks become useful in this UI.
  const apiArg = q?.target === 'structures' && q.filters_structures
    ? backendStructureFiltersToApiArg(q.filters_structures)
    : null;

  // Always-call form: pass `skip` instead of conditionally calling the hook.
  const { data, isFetching, isError } = useListStructuresQuery(apiArg ?? { limit: 1 }, {
    skip: apiArg === null,
  });

  if (apiArg === null) return null;
  if (isError) return <span className="text-[10px] text-slate-300">—</span>;
  if (isFetching && !data) return <span className="text-[10px] text-slate-300">…</span>;
  const n = data?.total_count ?? 0;
  if (n === 0) {
    return (
      <span className="text-[10px] font-mono text-slate-400 italic">
        no matches
      </span>
    );
  }
  return (
    <span className="text-[10px] font-mono text-slate-700 font-medium">
      {n.toLocaleString()} {n === 1 ? 'structure' : 'structures'}
    </span>
  );
}

// Backend StructureFilters (snake_case) -> ListStructuresApiArg (camelCase).
// Mirrors `selectStructureApiArgs` in slice_structures and the queryArgs build
// in /structures/page.tsx. Limits to 1 row since we only need total_count.
function backendStructureFiltersToApiArg(bf: Record<string, unknown>): ListStructuresApiArg {
  const s = (k: string): string | null => (typeof bf[k] === 'string' ? (bf[k] as string) : null);
  const n = (k: string): number | null => (typeof bf[k] === 'number' ? (bf[k] as number) : null);
  const b = (k: string): boolean | null => (typeof bf[k] === 'boolean' ? (bf[k] as boolean) : null);
  const arrS = (k: string): string[] | null => {
    const v = bf[k];
    return Array.isArray(v) && v.every(x => typeof x === 'string') ? (v as string[]) : null;
  };
  const arrNAsS = (k: string): string[] | null => {
    const v = bf[k];
    return Array.isArray(v) && v.every(x => typeof x === 'number')
      ? (v as number[]).map(String)
      : null;
  };
  return {
    cursor: null,
    limit: 1,
    search: s('search')?.trim() || null,
    ids: arrS('rcsb_ids'),
    expMethod: arrS('exp_method'),
    polyState: arrS('polymerization_state'),
    family: arrS('has_polymer_family'),
    isotype: arrS('has_isotype'),
    ligands: arrS('has_ligand_ids'),
    uniprot: arrS('has_uniprot'),
    resMin: n('resolution_min'),
    resMax: n('resolution_max'),
    yearMin: n('year_min'),
    yearMax: n('year_max'),
    sourceTaxa: arrNAsS('source_organism_ids') ?? arrNAsS('sourceTaxa'),
    hostTaxa: arrNAsS('host_organism_ids'),
    hasVariants: b('has_variants'),
    variantFamily: s('variant_family'),
    variantType: s('variant_type'),
    variantPosMin: n('variant_position_min'),
    variantPosMax: n('variant_position_max'),
    variantWildType: s('variant_wild_type'),
    variantObserved: s('variant_observed'),
    variantSource: s('variant_source'),
  };
}
