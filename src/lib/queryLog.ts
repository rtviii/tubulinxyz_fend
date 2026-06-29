// Client-side mirror of every chatbox query. Fires a best-effort beacon to the
// backend write-only sink (POST /assistant/query-log), which appends it to the
// same JSONL as the server-side capture. This records the user's submission even
// if the real assistant request later fails. Never throws; never blocks the query.

import { API_BASE_URL } from '@/config';

export function logQuery(source: string, text: string, context?: Record<string, unknown>) {
  try {
    fetch(`${API_BASE_URL}/assistant/query-log`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ source, text, context }),
      keepalive: true, // survives navigation away from the page
    }).catch(() => {}); // fire-and-forget
  } catch {
    // ignore — logging must never break the real query
  }
}
