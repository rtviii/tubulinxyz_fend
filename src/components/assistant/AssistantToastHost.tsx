'use client';

// Globally mounted in the root layout so it survives the route change a card
// click triggers (the source panel unmounts on router.push). Reads the last
// clicked ActionCard from the assistantToast slice, builds a one-line summary,
// and shows a transient bottom-center toast that auto-dismisses. No LLM call.

import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sparkles, X } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/store';
import {
  dismissAssistantToast,
  selectAssistantToastCard,
  selectAssistantToastNonce,
} from '@/store/slices/assistantToastSlice';
import { useGetTaxonomyFlatQuery } from '@/store/tubxz_api';
import { summarizeCard } from './cardSummary';

const AUTO_DISMISS_MS = 7000;

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

  // Fade-in + auto-dismiss. nonce restarts the timer on a repeat click.
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!card) {
      setVisible(false);
      return;
    }
    const showId = requestAnimationFrame(() => setVisible(true));
    const hideId = setTimeout(() => dispatch(dismissAssistantToast()), AUTO_DISMISS_MS);
    return () => {
      cancelAnimationFrame(showId);
      clearTimeout(hideId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card, nonce, pathname, dispatch]);

  if (!card) return null;

  const summary = summarizeCard(card, taxNameOf);

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 pointer-events-none w-full max-w-[560px] px-4">
      <div
        role="status"
        className={`
          pointer-events-auto flex items-start gap-2.5 rounded-xl border border-slate-700/60
          bg-slate-900/95 text-slate-100 shadow-xl backdrop-blur-sm px-3.5 py-2.5
          transition-all duration-200 ease-out
          ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}
        `}
      >
        <Sparkles size={14} className="flex-shrink-0 mt-0.5 text-violet-300" />
        <p className="flex-1 text-[12px] leading-snug">{summary}</p>
        <button
          type="button"
          onClick={() => dispatch(dismissAssistantToast())}
          className="flex-shrink-0 -mt-0.5 -mr-1 p-0.5 rounded text-slate-400 hover:text-slate-100 hover:bg-white/10 transition-colors"
          aria-label="Dismiss"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
}
