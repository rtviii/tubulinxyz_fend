'use client';

// Presentational landing chat input: the search box + example chips. All state
// lives in useLandingAssistant (the page owns it so it can place the reply
// beside the structure). Suggestions show only while idle.

import { ArrowUp } from 'lucide-react';
import { ExampleQueries } from '@/components/assistant/ExampleQueries';
import type { AssistantNote } from './useLandingAssistant';

const EXAMPLES = [
  'Where does taxol bind?',
  'Compare GTP site in human vs Toxoplasma α-tubulin',
  'Find cryo-EM structures under 3 Å',
];

const PLACEHOLDER = 'Ask about structures, binding sites, ligands, mutations…';

export function ThinkingDots() {
  return (
    <span className="inline-flex items-end gap-[3px]" aria-label="Thinking">
      {[0, 140, 280].map(delay => (
        <span
          key={delay}
          className="w-[3px] h-[3px] rounded-full bg-current animate-bounce"
          style={{ animationDelay: `${delay}ms`, animationDuration: '0.9s' }}
        />
      ))}
    </span>
  );
}

// Skeleton shown inside the reply container while the assistant is thinking —
// a "Thinking…" label over shimmering placeholder lines + cards that roughly
// mirror the answer layout that replaces them.
export function ThinkingShimmer() {
  return (
    <div>
      <div className="flex items-center gap-2 text-[12px] text-slate-400 mb-3">
        <ThinkingDots />
        <span>Thinking…</span>
      </div>
      <div className="space-y-2">
        <div className="landing-shimmer h-3 rounded w-[92%]" />
        <div className="landing-shimmer h-3 rounded w-[78%]" />
        <div className="landing-shimmer h-3 rounded w-[88%]" />
        <div className="landing-shimmer h-3 rounded w-[55%]" />
      </div>
      <div className="grid grid-cols-2 gap-2 mt-4">
        <div className="landing-shimmer h-16 rounded-lg" />
        <div className="landing-shimmer h-16 rounded-lg" />
        <div className="landing-shimmer h-16 rounded-lg" />
        <div className="landing-shimmer h-16 rounded-lg" />
      </div>
    </div>
  );
}

type Props = {
  text: string;
  setText: (s: string) => void;
  loading: boolean;
  canSend: boolean;
  note: AssistantNote;
  active: boolean;
  onSubmit: (text: string) => void;
};

export function LandingChatInput({ text, setText, loading, canSend, note, active, onSubmit }: Props) {
  return (
    <div className="w-full">
      <form
        onSubmit={e => {
          e.preventDefault();
          onSubmit(text);
        }}
        className="relative"
      >
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={PLACEHOLDER}
          disabled={loading}
          className="w-full rounded-2xl border border-slate-200 bg-white
                     px-4 py-3 pr-12 text-[13px] text-slate-700 placeholder:text-slate-400
                     shadow-sm outline-none transition-colors
                     focus:border-slate-400 focus:ring-2 focus:ring-slate-100
                     disabled:bg-slate-50"
        />
        <button
          type="submit"
          disabled={!canSend}
          className="absolute right-2 top-1/2 -translate-y-1/2 grid place-items-center
                     w-8 h-8 rounded-full text-slate-400 transition-colors
                     hover:text-slate-700 hover:bg-slate-100
                     disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
          title="Ask"
        >
          {loading ? <ThinkingDots /> : <ArrowUp size={16} />}
        </button>
      </form>

      {note && (
        <div
          className={`mt-2 px-1 text-[12px] ${
            note.kind === 'error' ? 'text-red-500' : 'text-amber-600'
          }`}
        >
          {note.kind === 'error' ? `Error: ${note.message}` : note.message}
        </div>
      )}

      {/* Suggestions: only while idle. */}
      {!active && (
        <div className="mt-3 flex justify-center">
          <ExampleQueries examples={EXAMPLES} onPick={onSubmit} variant="subtle" />
        </div>
      )}
    </div>
  );
}
