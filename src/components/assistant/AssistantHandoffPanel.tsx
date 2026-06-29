'use client';

// Persistent, closeable summary of the assistant handoff that brought the user
// to this structure page. Replaces the old auto-dismiss toast: it prefaces the
// question the user typed, lists the actions that were taken, and exposes the
// raw llm/database exchange (tool trace + data + queries) as openable JSON.
//
// Reads the assistantHandoff slice (set just before router.push on the source
// page) and only renders when the handoff targets the currently loaded
// structure. No LLM call — everything is built from the captured response.

import { useEffect, useMemo, useState } from 'react';
import { Sparkles, Check, X, ChevronRight, Copy } from 'lucide-react';
import { useAppSelector } from '@/store/store';
import { selectAssistantHandoff } from '@/store/slices/assistantHandoffSlice';
import { summarizeCardLines } from './cardSummary';
import { humanizeViewerAction } from './actionHumanizer';

function eqId(a?: string | null, b?: string | null): boolean {
  return !!a && !!b && a.toUpperCase() === b.toUpperCase();
}

export function AssistantHandoffPanel({
  loadedStructure,
  yieldToLiveResponse = false,
}: {
  loadedStructure: string | null;
  // When a live in-page assistant response is showing, collapse to the dot so
  // the two don't compete for the bottom-right corner.
  yieldToLiveResponse?: boolean;
}) {
  const handoff = useAppSelector(selectAssistantHandoff);
  const [showJson, setShowJson] = useState(false);
  const [copied, setCopied] = useState(false);
  // Closing collapses to a small dot rather than disappearing — re-openable.
  const [collapsed, setCollapsed] = useState(false);
  // Re-expand whenever a fresh handoff arrives.
  useEffect(() => { setCollapsed(false); }, [handoff.nonce]);

  const card = handoff.card;

  // Actions taken: humanized lines from the card fields + one line per arrival
  // action (what auto-applied on landing). Same source the viewer replays from,
  // so the panel can't over-promise.
  const actionLines = useMemo(() => {
    if (!card) return [];
    return [
      ...summarizeCardLines(card),
      ...(card.arrival_actions ?? []).map((a) => {
        const h = humanizeViewerAction({ type: a.type, args: a.args });
        return h.detail ? `${h.label} ${h.detail}` : h.label;
      }),
    ];
  }, [card]);

  // The raw exchange to expose as JSON: only what the llm/database round-trip
  // produced (per-tool trace, structured data, the catalogue queries it built,
  // the entities it surfaced). Empty sections are omitted.
  const exchange = useMemo(() => {
    const r = handoff.result;
    if (!r) return null;
    const out: Record<string, unknown> = {};
    if (r.trace?.length) out.tools = r.trace;
    if (r.data && Object.keys(r.data).length) out.data = r.data;
    if (r.queries?.length) out.queries = r.queries;
    if (r.entities?.length) out.entities = r.entities;
    return Object.keys(out).length ? out : null;
  }, [handoff.result]);

  const exchangeText = useMemo(
    () => (exchange ? JSON.stringify(exchange, null, 2) : ''),
    [exchange],
  );

  // Only surface on the structure this handoff was built for. Cards without an
  // rcsb_id (e.g. open_catalogue) don't land on a structure page, so they never
  // show this panel.
  if (!card) return null;
  if (!eqId(handoff.rcsbId, loadedStructure)) return null;

  // Collapsed (by the user, or yielding to a live response): a small re-openable
  // dot instead of vanishing. While yielding, clicking can't expand it — the
  // live response owns the corner until dismissed.
  if (collapsed || yieldToLiveResponse) {
    return (
      <button
        type="button"
        onClick={() => { if (!yieldToLiveResponse) setCollapsed(false); }}
        title="Show assistant summary"
        aria-label="Show assistant summary"
        className="grid place-items-center w-8 h-8 rounded-full
                   bg-white/80 backdrop-blur border border-slate-200/60 shadow-lg
                   text-violet-500 hover:text-violet-600 hover:bg-white transition-colors pointer-events-auto"
      >
        <Sparkles size={14} />
      </button>
    );
  }

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(exchangeText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard blocked — no-op */
    }
  };

  return (
    <div className="w-[340px] max-w-[calc(100vw-1.5rem)] pointer-events-auto">
      <div className="rounded-xl border border-slate-200/80 bg-white/95 backdrop-blur-sm shadow-lg overflow-hidden">
        {/* Header */}
        <div className="px-3 py-1.5 flex items-center gap-1.5 border-b border-slate-100">
          <Sparkles size={11} className="text-violet-500" />
          <span className="flex-1 text-[9px] font-semibold uppercase tracking-wider text-slate-400">
            Assistant
          </span>
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="-mr-1 p-0.5 rounded text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Minimize"
            title="Minimize"
          >
            <X size={12} />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {/* The question the user actually typed. */}
          {handoff.question && (
            <div className="px-3 pt-2 pb-1.5">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">You asked</p>
              <p className="mt-0.5 text-[12px] text-slate-700 leading-snug italic">
                &ldquo;{handoff.question}&rdquo;
              </p>
            </div>
          )}

          {/* Actions taken. */}
          {actionLines.length > 0 && (
            <div className="px-3 py-1.5 border-t border-slate-100">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                What I did
              </p>
              <ul className="space-y-1">
                {actionLines.map((line, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-1.5 text-[11px] text-slate-700 leading-snug"
                  >
                    <Check size={11} className="flex-shrink-0 mt-[2px] text-emerald-500" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Raw llm/database exchange as openable JSON. */}
          {exchange && (
            <div className="border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowJson((v) => !v)}
                className="w-full px-3 py-1.5 flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-600 transition-colors"
              >
                <ChevronRight
                  size={11}
                  className={`transition-transform ${showJson ? 'rotate-90' : ''}`}
                />
                Data used
              </button>
              {showJson && (
                <div className="px-3 pb-2">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={copyJson}
                      className="absolute top-1 right-1 z-10 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white/80 border border-slate-200 text-[9px] text-slate-400 hover:text-slate-700 transition-colors"
                      title="Copy JSON"
                    >
                      <Copy size={9} />
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                    <pre className="max-h-[34vh] overflow-auto rounded-md bg-slate-50 border border-slate-100 p-2 text-[10px] leading-snug font-mono text-slate-600 whitespace-pre">
                      {exchangeText}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
