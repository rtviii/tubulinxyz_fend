'use client';

// A row of clickable example questions that fire the current assistant
// handler directly (no input pre-fill). Skips the chat input entirely — one
// click → query in flight → results panel renders.
//
// Lives below the pill bar on the landing page. Hidden when no
// AssistantTargetProvider is mounted (e.g. on pages without a global
// assistant wired up).

import { useState } from 'react';
import { useAssistantTarget } from './AssistantTargetContext';

export interface ExampleQueriesProps {
  examples: string[];
  className?: string;
  // When provided, clicking a chip forwards the text to the parent instead of
  // firing the assistant target directly. The parent then owns loading state
  // (used by the landing chat panel). No AssistantTargetProvider required.
  onPick?: (text: string) => void;
  // 'subtle' renders quieter chips for use under a chat input.
  variant?: 'default' | 'subtle';
}

export function ExampleQueries({ examples, className, onPick, variant = 'default' }: ExampleQueriesProps) {
  const target = useAssistantTarget();
  const [busyIdx, setBusyIdx] = useState<number | null>(null);

  if ((!target && !onPick) || examples.length === 0) return null;

  const run = async (text: string, i: number) => {
    if (onPick) {
      onPick(text);
      return;
    }
    if (busyIdx !== null) return;
    setBusyIdx(i);
    try {
      const controller = new AbortController();
      await target!.handle(text, controller.signal);
    } finally {
      setBusyIdx(null);
    }
  };

  const subtle = variant === 'subtle';

  return (
    <div className={`flex flex-wrap items-center gap-1.5 text-[10px] ${className ?? ''}`}>
      <span className="text-slate-400 uppercase tracking-wider font-medium">Try:</span>
      {examples.map((ex, i) => {
        const isBusy = busyIdx === i;
        const isDimmed = busyIdx !== null && !isBusy;
        return (
          <button
            key={i}
            type="button"
            disabled={busyIdx !== null}
            onClick={() => run(ex, i)}
            className={`
              px-2 py-0.5 rounded-full border transition-colors
              ${isBusy
                ? 'bg-slate-100 text-slate-500 border-slate-300 cursor-wait'
                : subtle
                  ? 'bg-slate-50 text-slate-500 border-slate-100 hover:bg-slate-100 hover:text-slate-700 cursor-pointer'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400 hover:bg-slate-50 cursor-pointer'
              }
              ${isDimmed ? 'opacity-40' : ''}
            `}
          >
            {isBusy ? 'asking…' : ex}
          </button>
        );
      })}
    </div>
  );
}
