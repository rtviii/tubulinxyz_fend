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
import { X, LayoutGrid, Eye, Microscope, FlaskConical, Dna, HelpCircle, Sparkles } from 'lucide-react';
import { useListStructuresQuery, type ListStructuresApiArg } from '@/store/tubxz_api';
import { getHexForFamily } from '@/components/molstar/colors/palette';
import { API_BASE_URL } from '@/config';
import type { MolstarInstance } from '@/components/molstar/services/MolstarInstance';
import type { ActionCard, ActionKind, EntityRef, QuerySpec } from './globalTypes';
import type { AssistantResult, AssistantSuggestedAction, AssistantViewerActionCall, ViewerAction } from './types';
import { asAssistantTable } from './types';
import { cardToHref } from './globalCommandDispatcher';
import { dispatchViewerActions } from './viewerCommandDispatcher';
import { PillifiedText, inlineEntitiesFromCard } from './PillifiedText';
import { AssistantAnswer } from './AssistantAnswer';
import { AssistantTable } from './AssistantTable';
import { ActionPlanCard, type PlanStep } from './ActionPlanCard';
import { EntityHoverText } from './EntityHoverText';
import { humanizeViewerAction } from './actionHumanizer';
import { summarizeCardLines } from './cardSummary';
import {
  KIND_META,
  applyHighlight,
  applyFocus,
  canGroundOnDemo,
  labelFor,
  toneFor,
  type DemoGrounding,
} from './entityHighlight';
import { useAppDispatch } from '@/store/store';
import { showAssistantToast } from '@/store/slices/assistantToastSlice';
import { setArrivalActions } from '@/store/slices/arrivalActionsSlice';

// Per-action CTA verb + thumbnail eligibility for the landing plan cards.
const ACTION_CTA: Record<ActionKind, string> = {
  open_catalogue: 'Browse catalogue',
  open_structure: 'Open structure',
  open_expert: 'Open in expert mode',
  inspect_ligand: 'Inspect ligand',
  view_variants: 'View variants',
  clarify: 'Clarify',
};

const ACTION_META: Record<ActionKind, { label: string; Icon: typeof LayoutGrid; tone: string }> = {
  open_catalogue: { label: 'Browse', Icon: LayoutGrid, tone: 'text-slate-500 bg-slate-50 border-slate-200' },
  open_structure: { label: 'Easy mode', Icon: Eye, tone: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  open_expert: { label: 'Expert mode', Icon: Microscope, tone: 'text-violet-600 bg-violet-50 border-violet-200' },
  inspect_ligand: { label: 'Ligand', Icon: FlaskConical, tone: 'text-amber-600 bg-amber-50 border-amber-200' },
  view_variants: { label: 'Variants', Icon: Dna, tone: 'text-rose-600 bg-rose-50 border-rose-200' },
  clarify: { label: 'Clarify', Icon: HelpCircle, tone: 'text-blue-600 bg-blue-50 border-blue-200' },
};

// Defensive dedup: the backend already collapses true duplicates and assigns a
// stable `id`, but we dedup again on render so a duplicate can never reach the
// grid (the user's top annoyance). Falls back to a semantic key when `id` is
// absent (e.g. an un-hydrated response).
function dedupeCards(cards: ActionCard[]): ActionCard[] {
  const seen = new Set<string>();
  const out: ActionCard[] = [];
  for (const c of cards) {
    const key =
      c.id ??
      [c.action, c.rcsb_id, c.query_ref, c.primary_organism_id, c.family, c.chemical_id].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

export interface AssistantResultsPanelProps {
  response: AssistantResult;
  onDismiss: () => void;
  // When embedded inside a column (e.g. the landing chat panel) drop the
  // page-width centering so the panel fills its container instead.
  embedded?: boolean;
  // When the host already provides a close affordance (e.g. the landing reply
  // container's sticky header), hide this panel's own dismiss button.
  hideDismiss?: boolean;
  // The live demo Molstar instance beside the chat (landing page). Suggested
  // actions run against it; surfaced entities hover-highlight on it.
  instance?: MolstarInstance | null;
  // The demo structure's identity + chains, so the honesty gate knows what can
  // actually be shown on the demo viewer. Omit to disable demo highlighting.
  demo?: { rcsbId: string; chainIds: string[] } | null;
}

export function AssistantResultsPanel({ response, onDismiss, embedded = false, hideDismiss = false, instance = null, demo = null }: AssistantResultsPanelProps) {
  const router = useRouter();
  const dispatch = useAppDispatch();

  // Fade-in on mount.
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    // rAF so the transition has a frame to take effect from the initial state.
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Inline note when a demo action can't run (honesty over silent no-op).
  const [actionNote, setActionNote] = useState<string | null>(null);

  const handleCardClick = (card: ActionCard, ok: boolean) => {
    if (!ok || card.action === 'clarify') return;
    const { href } = cardToHref(card, response.queries ?? []);
    if (href && href !== '#') {
      // Precompute -> replay: stash the card's grounded arrival actions so the
      // destination page can replay them once the view settles (see the replay
      // effect in the structure page). Must dispatch BEFORE navigating.
      if (card.arrival_actions?.length) {
        dispatch(setArrivalActions({ rcsbId: card.rcsb_id ?? null, actions: card.arrival_actions }));
      }
      dispatch(showAssistantToast(card));
      router.push(href);
    }
  };

  // Run a single demo-safe viewer action against the live demo instance. The
  // backend already restricted landing actions to whole-chain ops, but we guard
  // again and surface failures inline rather than no-op silently.
  const runSuggestedAction = async (action: AssistantViewerActionCall) => {
    setActionNote(null);
    if (!instance) {
      setActionNote('No demo viewer is loaded to show that on.');
      return;
    }
    try {
      const reports = await dispatchViewerActions(instance, [action as unknown as ViewerAction], { viewMode: 'structure' });
      const failed = reports.find((r) => !r.ok);
      if (failed) setActionNote(`Couldn't show that here: ${failed.error}`);
    } catch (e) {
      setActionNote(`Couldn't show that here: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  // Dedup defensively before anything reads the card list.
  const cards = dedupeCards(response.cards ?? []);
  const entities: EntityRef[] = response.entities ?? [];

  // Offer demo-viewer actions as clickable plan cards — NEVER auto-apply on the
  // landing demo. The model may place a demo action in either channel
  // (suggested_actions or viewer_actions); merge both and dedupe so it surfaces
  // either way and never twice.
  const suggested: AssistantSuggestedAction[] = (() => {
    const merged: AssistantSuggestedAction[] = [
      ...(response.suggested_actions ?? []),
      ...(response.viewer_actions ?? []).map((a) => ({ label: humanizeViewerAction(a).label, action: a })),
    ];
    const seen = new Set<string>();
    return merged.filter((s) => {
      const key = `${s.action.type}:${JSON.stringify(s.action.args ?? {})}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  })();

  // Honesty gate input for the demo viewer (residues only on the clean dimer).
  const grounding: DemoGrounding | null = demo
    ? { chainIds: new Set(demo.chainIds), allowResidues: true }
    : null;
  const groundableEntities = entities.filter((e) => canGroundOnDemo(e, grounding));
  // Residues live as inline hover targets in the prose; the pill row shows only
  // the "named" targets (chains, ligands) so it doesn't balloon to 40 chips.
  const pillEntities = groundableEntities.filter((e) => e.kind !== 'residue_range');

  // Single-clarify shortcut: render just the prompt, no offers.
  const onlyCard = cards.length === 1 ? cards[0] : null;
  const isClarifyOnly = onlyCard?.action === 'clarify';

  // Grounded answer prose via AssistantAnswer; the structured table via
  // AssistantTable. On the landing page, wrap plain-text runs in EntityHoverText
  // so positions/chains the model surfaced hover-highlight on the demo.
  const answerMarkdown = response.answer_markdown ?? response.summary ?? '';
  const table = asAssistantTable((response.data as Record<string, unknown> | null)?.table);
  const renderText =
    instance && grounding && groundableEntities.length
      ? (t: string) => (
          <EntityHoverText text={t} entities={entities} instance={instance} grounding={grounding} />
        )
      : undefined;

  const hasOffers = suggested.length > 0 || cards.length > 0;

  return (
    <div
      className={`
        relative w-full ${embedded ? '' : 'max-w-[1400px] mx-auto px-6'}
        transition-all duration-200 ease-out
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'}
      `}
    >
      <div className="rounded-xl border border-slate-200/80 bg-white/95 shadow-sm overflow-hidden">
        {/* Header: answer + table + dismiss */}
        <div className="px-4 py-3 flex items-start gap-3 border-b border-slate-100">
          <div className="flex-1 min-w-0">
            {answerMarkdown ? (
              <AssistantAnswer markdown={answerMarkdown} renderText={renderText} />
            ) : (
              <p className="text-[11px] text-slate-400 uppercase tracking-wider">
                {isClarifyOnly ? 'Clarification' : `${cards.length} suggestion${cards.length === 1 ? '' : 's'}`}
              </p>
            )}
            {table && <AssistantTable table={table} className="mt-2" />}

            {/* Quick hover targets: named entities we can show on the demo
                (chains/ligands). Residues are inline in the prose above. */}
            {pillEntities.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {pillEntities.map((e, i) => {
                  const meta = KIND_META[e.kind];
                  return (
                    <span
                      key={i}
                      className={`group inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] font-medium cursor-pointer transition-all hover:shadow-sm hover:scale-[1.02] ${toneFor(e)}`}
                      onMouseEnter={() => applyHighlight(instance, e, true)}
                      onMouseLeave={() => applyHighlight(instance, e, false)}
                      onClick={() => applyFocus(instance, e)}
                      title="Hover to highlight in the 3D viewer, click to focus"
                    >
                      <meta.Icon size={9} />
                      <span className="font-mono">{labelFor(e)}</span>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
          {!hideDismiss && (
            <button
              onClick={onDismiss}
              className="flex-shrink-0 p-1 rounded text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              aria-label="Dismiss results"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Body: offers */}
        {isClarifyOnly && onlyCard?.question ? (
          <p className="text-[13px] text-slate-600 italic px-4 py-3">{onlyCard.question}</p>
        ) : hasOffers ? (
          <div className="p-3 space-y-2">
            {/* Demo-viewer offers (act on the structure beside the chat) */}
            {suggested.map((s, i) => {
              const step = humanizeViewerAction(s.action);
              return (
                <ActionPlanCard
                  key={`s-${i}`}
                  title={s.label}
                  steps={[{ icon: step.icon, label: step.label, detail: step.detail }]}
                  cta="Show in viewer"
                  tag={{ label: 'This demo', tone: 'text-sky-600 bg-sky-50 border-sky-200', Icon: Sparkles }}
                  onRun={() => runSuggestedAction(s.action)}
                />
              );
            })}

            {/* Navigation offers (each a legible chain of steps) */}
            {cards.map((card, i) => {
              const v = response.validation?.[card.id ?? `card_${i}`];
              const ok = v?.ok !== false;
              return (
                <ActionPlanCard
                  key={card.id ?? i}
                  title={card.label}
                  subtitle={card.description}
                  steps={buildCardSteps(card)}
                  cta={ACTION_CTA[card.action] ?? 'Open'}
                  tag={cardTag(card.action)}
                  thumbnailRcsbId={cardThumbnail(card)}
                  extra={
                    card.action === 'open_catalogue' && card.query_ref ? (
                      <CatalogueCount queryRef={card.query_ref} queries={response.queries ?? []} />
                    ) : undefined
                  }
                  disabled={!ok}
                  reason={v?.reason}
                  onRun={() => handleCardClick(card, ok)}
                />
              );
            })}
          </div>
        ) : null}

        {actionNote && (
          <p className="px-4 py-2 text-[11px] text-amber-600 bg-amber-50/60 border-t border-amber-100">
            {actionNote}
          </p>
        )}
      </div>
    </div>
  );
}

// Steps shown inside a navigation offer: a humanized line per resolved field
// (Loaded/Aligned/Focused…) plus each arrival action (what auto-applies after
// you land). open_catalogue is title + count, so it needs no steps.
function buildCardSteps(card: ActionCard): PlanStep[] {
  const meta = ACTION_META[card.action] ?? ACTION_META.open_catalogue;
  const steps: PlanStep[] =
    card.action === 'open_catalogue'
      ? []
      : summarizeCardLines(card).map((line) => ({ icon: meta.Icon, label: line }));
  for (const a of card.arrival_actions ?? []) {
    const h = humanizeViewerAction({ type: a.type, args: a.args });
    steps.push({ icon: h.icon, label: h.label, detail: h.detail });
  }
  return steps;
}

function cardTag(action: ActionKind): { label: string; tone: string; Icon: typeof LayoutGrid } {
  const meta = ACTION_META[action] ?? ACTION_META.open_catalogue;
  return { label: meta.label, tone: meta.tone, Icon: meta.Icon };
}

function cardThumbnail(card: ActionCard): string | undefined {
  if (!card.rcsb_id) return undefined;
  return card.action === 'open_structure' || card.action === 'open_expert' || card.action === 'inspect_ligand'
    ? card.rcsb_id
    : undefined;
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
