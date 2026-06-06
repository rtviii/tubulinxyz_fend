'use client';

// Landing-page chat: a clean, centered assistant input that slides up once a
// query is in flight, with suggestions underneath while idle and result cards
// piping in below once the backend responds. Self-contained — POSTs directly
// to /nl_query/global (no AssistantTargetProvider needed here).

import { useCallback, useRef, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { AssistantResultsPanel } from '@/components/assistant/AssistantResultsPanel';
import { ExampleQueries } from '@/components/assistant/ExampleQueries';
import type { GlobalNLResponse, NLGlobalResponseBody } from '@/components/assistant/globalTypes';
import { API_BASE_URL } from '@/config';

const EXAMPLES = [
  'Where does taxol bind?',
  // 'What kinds of PTMs are in tubulin?',
  'Compare GTP site in human vs Toxoplasma α-tubulin',
  'Find cryo-EM structures under 3 Å',
];

const PLACEHOLDER = 'Ask about structures, binding sites, ligands, mutations...';

type Note = { kind: 'error' | 'clarify'; message: string } | null;

function ThinkingDots() {
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

export function LandingChatPanel() {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<GlobalNLResponse | null>(null);
  const [note, setNote] = useState<Note>(null);
  const abortRef = useRef<AbortController | null>(null);

  const active = loading || !!response;

  const submit = useCallback(async (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed || loading) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setNote(null);
    try {
      const resp = await fetch(`${API_BASE_URL}/nl_query/global`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: trimmed }),
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (!resp.ok) {
        const body = await resp.text().catch(() => '');
        setNote({ kind: 'error', message: `HTTP ${resp.status}: ${body.slice(0, 200)}` });
        return;
      }
      const data = (await resp.json()) as NLGlobalResponseBody;
      if (data.kind === 'clarify') {
        setResponse(null);
        setNote({ kind: 'clarify', message: data.clarification ?? 'Please clarify.' });
        return;
      }
      if (!data.response) {
        setNote({ kind: 'error', message: 'Empty response.' });
        return;
      }
      setResponse(data.response);
      setText('');
    } catch (e) {
      if (controller.signal.aborted || (e instanceof Error && e.name === 'AbortError')) return;
      setNote({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [loading]);

  const dismiss = useCallback(() => {
    setResponse(null);
    setNote(null);
  }, []);

  const canSend = text.trim().length > 0 && !loading;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Input region: centered when idle, pinned to top once a query runs. */}
      <div
        className={`flex flex-col transition-all duration-300 ease-out
          ${active ? 'flex-none pt-1 pb-3' : 'flex-1 justify-center'}`}
      >
        {!active && (
          <div className="mb-3 text-center">
            <h2 className="text-[15px] font-semibold text-slate-700">Ask the tubulin assistant</h2>
            <p className="mt-0.5 text-[12px] text-slate-400 font-light">
              Find structures, binding sites, ligands and mutations in plain language.
            </p>
          </div>
        )}

        <form
          onSubmit={e => {
            e.preventDefault();
            submit(text);
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
            <ExampleQueries examples={EXAMPLES} onPick={submit} variant="subtle" />
          </div>
        )}
      </div>

      {/* Results region: appears underneath the chat once active. */}
      {active && (
        <div className="flex-1 min-h-0 overflow-y-auto">
          {loading && !response && (
            <div className="flex items-center gap-2 px-1 py-2 text-[12px] text-slate-400">
              <ThinkingDots />
              <span>Thinking…</span>
            </div>
          )}
          {response && (
            <AssistantResultsPanel embedded response={response} onDismiss={dismiss} />
          )}
        </div>
      )}
    </div>
  );
}
