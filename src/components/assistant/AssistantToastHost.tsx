'use client';

// Globally mounted in the root layout so it survives the route change a card
// click triggers (the source panel unmounts on router.push). Reads the last
// clicked ActionCard from the assistantToast slice and shows a transient
// bottom-right panel listing what the assistant did. No LLM call.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sparkles, Check, X } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/store';
import {
  dismissAssistantToast,
  selectAssistantToastCard,
  selectAssistantToastNonce,
} from '@/store/slices/assistantToastSlice';
import { useGetTaxonomyFlatQuery } from '@/store/tubxz_api';
import { summarizeCardLines } from './cardSummary';

const AUTO_DISMISS_MS = 15000;

export function AssistantToastHost() {
  const dispatch = useAppDispatch();
  const card = useAppSelector(selectAssistantToastCard);
  const nonce = useAppSelector(selectAssistantToastNonce);
  // The card is dispatched on the *source* page just before router.push, so the
  // dismiss timer must restart when we land on the destination route — otherwise
  // it expires under the destination's loading overlay before the user sees it.
  const pathname = usePathname();

  // Source-organism tax id -> name. Cached by RTK Query; one fetch per session.
  const { data: taxa } = useGetTaxonomyFlatQuery({ taxType: 'source' });
  const taxNameOf = useMemo(() => {
    const map = new Map<number, string>();
    for (const t of taxa ?? []) map.set(t.tax_id, t.name);
    return (id: number) => map.get(id);
  }, [taxa]);

  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    timerRef.current = setTimeout(() => dispatch(dismissAssistantToast()), AUTO_DISMISS_MS);
  }, [dispatch, stopTimer]);

  useEffect(() => {
    if (!card) {
      setVisible(false);
      stopTimer();
      return;
    }
    const showId = requestAnimationFrame(() => setVisible(true));
    startTimer();
    return () => {
      cancelAnimationFrame(showId);
      stopTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card, nonce, pathname]);

  if (!card) return null;

  const lines = summarizeCardLines(card, taxNameOf);

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[300px] max-w-[calc(100vw-2rem)] pointer-events-none">
      <div
        role="status"
        onMouseEnter={stopTimer}
        onMouseLeave={startTimer}
        className={`
          pointer-events-auto rounded-xl border border-slate-200/80 bg-white/95 backdrop-blur-sm
          shadow-lg overflow-hidden transition-all duration-200 ease-out
          ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}
        `}
      >
        <div className="px-3 py-1.5 flex items-center gap-1.5 border-b border-slate-100">
          <Sparkles size={11} className="text-violet-500" />
          <span className="flex-1 text-[9px] font-semibold uppercase tracking-wider text-slate-400">
            Assistant
          </span>
          <button
            type="button"
            onClick={() => dispatch(dismissAssistantToast())}
            className="-mr-1 p-0.5 rounded text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Dismiss"
          >
            <X size={12} />
          </button>
        </div>
        <ul className="px-3 py-2 space-y-1">
          {lines.map((line, i) => (
            <li key={i} className="flex items-start gap-1.5 text-[11px] text-slate-700 leading-snug">
              <Check size={11} className="flex-shrink-0 mt-[2px] text-emerald-500" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
