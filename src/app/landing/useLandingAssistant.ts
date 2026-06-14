'use client';

// Landing assistant state, lifted out of the chat panel so the page can render
// the input and the reply in separate places (the reply slides in beside the
// structure). POSTs directly to the grounded /assistant/query loop
// (page_context.page='landing').

import { useCallback, useRef, useState } from 'react';
import type { AssistantResult } from '@/components/assistant/types';
import { API_BASE_URL } from '@/config';

export type AssistantNote = { kind: 'error' | 'clarify'; message: string } | null;

export function useLandingAssistant() {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<AssistantResult | null>(null);
  const [note, setNote] = useState<AssistantNote>(null);
  const abortRef = useRef<AbortController | null>(null);

  // `active` drives the page's side-by-side reflow: true while a query is in
  // flight or a response is showing.
  const active = loading || !!response;

  const submit = useCallback(async (raw: string, pageContextExtra?: Record<string, unknown>) => {
    const trimmed = raw.trim();
    if (!trimmed || loading) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setNote(null);
    try {
      const resp = await fetch(`${API_BASE_URL}/assistant/query`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        // The demo viewer's identity + chains travel in page_context so the
        // backend can ground residues onto the demo and offer demo-safe actions.
        body: JSON.stringify({ text: trimmed, page_context: { page: 'landing', ...pageContextExtra } }),
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (!resp.ok) {
        const body = await resp.text().catch(() => '');
        setNote({ kind: 'error', message: `HTTP ${resp.status}: ${body.slice(0, 200)}` });
        return;
      }
      const data = (await resp.json()) as AssistantResult;
      if (data.kind === 'clarify') {
        setResponse(null);
        setNote({ kind: 'clarify', message: data.clarification ?? 'Please clarify.' });
        return;
      }
      if (data.kind === 'cannot') {
        // Honest soft decline (amber, not a red error).
        setResponse(null);
        setNote({ kind: 'clarify', message: data.reason ?? "I can't answer that." });
        return;
      }
      setResponse(data);
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

  return { text, setText, loading, response, note, active, canSend, submit, dismiss };
}
