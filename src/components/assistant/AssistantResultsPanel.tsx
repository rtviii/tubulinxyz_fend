'use client';

// Renders the response from /nl_query/global: a short blurb on top + a
// ranked grid of action cards below. Each card is one click → one URL
// navigation (built by globalCommandDispatcher). Validation results from the
// backend dim/disable any card whose primary entity didn't pass hydration.

import { useRouter } from 'next/navigation';
import { X, LayoutGrid, Eye, Microscope, FlaskConical, Dna, HelpCircle } from 'lucide-react';
import type { ActionCard, ActionKind, GlobalNLResponse } from './globalTypes';
import { cardToHref } from './globalCommandDispatcher';

const ACTION_META: Record<ActionKind, { label: string; Icon: typeof LayoutGrid; tone: string }> = {
  open_catalogue: { label: 'Browse', Icon: LayoutGrid, tone: 'text-slate-500 bg-slate-50 border-slate-200' },
  open_structure: { label: 'Structure', Icon: Eye, tone: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  open_expert: { label: 'Expert mode', Icon: Microscope, tone: 'text-violet-600 bg-violet-50 border-violet-200' },
  inspect_ligand: { label: 'Ligand', Icon: FlaskConical, tone: 'text-amber-600 bg-amber-50 border-amber-200' },
  view_variants: { label: 'Variants', Icon: Dna, tone: 'text-rose-600 bg-rose-50 border-rose-200' },
  clarify: { label: 'Clarify', Icon: HelpCircle, tone: 'text-blue-600 bg-blue-50 border-blue-200' },
};

export interface AssistantResultsPanelProps {
  response: GlobalNLResponse;
  onDismiss: () => void;
}

export function AssistantResultsPanel({ response, onDismiss }: AssistantResultsPanelProps) {
  const router = useRouter();

  const handleCardClick = (card: ActionCard, ok: boolean) => {
    if (!ok || card.action === 'clarify') return;
    const { href } = cardToHref(card, response.queries);
    if (href && href !== '#') router.push(href);
  };

  // If the LLM produced a single clarify card, render just the prompt and
  // skip the chip grid.
  const onlyCard = response.cards.length === 1 ? response.cards[0] : null;
  const isClarifyOnly = onlyCard?.action === 'clarify';

  return (
    <div className="relative w-full max-w-[1400px] mx-auto px-6">
      <div className="rounded-xl border border-slate-200/80 bg-white/95 shadow-sm overflow-hidden">
        {/* Header: blurb + dismiss */}
        <div className="px-4 py-3 flex items-start gap-3 border-b border-slate-100">
          <div className="flex-1 min-w-0">
            {response.blurb ? (
              <p className="text-[13px] text-slate-700 leading-snug">{response.blurb}</p>
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

        {/* Body: cards or clarify message */}
        <div className="p-3">
          {isClarifyOnly && onlyCard?.question ? (
            <p className="text-[13px] text-slate-600 italic px-2 py-2">
              {onlyCard.question}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {response.cards.map((card, i) => {
                const meta = ACTION_META[card.action] ?? ACTION_META.open_catalogue;
                const v = response.validation?.[`card_${i}`];
                const ok = v?.ok !== false;
                const isClickable = ok && card.action !== 'clarify';
                const reason = v?.reason;

                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleCardClick(card, ok)}
                    disabled={!isClickable}
                    title={reason}
                    className={`
                      group min-w-[180px] max-w-[320px] flex-1 text-left rounded-lg border transition-all
                      ${isClickable
                        ? 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm cursor-pointer'
                        : 'border-slate-100 bg-slate-50 opacity-60 cursor-not-allowed'
                      }
                    `}
                  >
                    <div className="px-3 pt-2 flex items-center gap-1.5">
                      <span className={`inline-flex items-center gap-1 px-1.5 py-px text-[8px] uppercase tracking-wider font-medium rounded border ${meta.tone}`}>
                        <meta.Icon size={9} />
                        {meta.label}
                      </span>
                      {!ok && reason && (
                        <span className="text-[8px] text-amber-500 italic truncate" title={reason}>
                          {reason}
                        </span>
                      )}
                    </div>
                    <div className="px-3 pb-2.5 pt-1">
                      <div className="text-[12px] font-medium text-slate-800 leading-snug">
                        {card.label}
                      </div>
                      {card.description && (
                        <div className="mt-0.5 text-[10px] text-slate-500 leading-snug line-clamp-2">
                          {card.description}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
