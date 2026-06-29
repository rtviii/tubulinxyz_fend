// Carries the full landing→structure (or in-page→structure) assistant handoff
// across the router.push: the question the user typed, the clicked card, and the
// raw /assistant/query exchange (trace + data + queries). The destination
// structure page mounts AssistantHandoffPanel, which reads this and shows a
// persistent, closeable summary — question on top, the actions taken, and the
// llm/database exchange as openable JSON. Replaces the old auto-dismiss toast.
//
// Refresh-safe by construction: the store resets on a hard reload, so a refreshed
// structure URL shows nothing. The panel's close button clears this.

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { ActionCard } from '@/components/assistant/globalTypes';
import type { AssistantResult } from '@/components/assistant/types';
import type { RootState } from '../store';

interface AssistantHandoffState {
  // The question the user actually typed into the assistant box (null when the
  // navigation originated somewhere without a captured prompt).
  question: string | null;
  // The card the user clicked — drives the "actions taken" summary.
  card: ActionCard | null;
  // The structure this handoff targets. The panel only renders on the matching
  // structure page, so a stale handoff for a different structure stays hidden.
  rcsbId: string | null;
  // The full grounded response, so the page can render the raw llm/database
  // exchange (trace, data, queries) as openable JSON. May be null for in-page
  // navigations that don't carry the whole envelope.
  result: AssistantResult | null;
  // Bumped on every set so a re-show of the same card still re-opens the panel.
  nonce: number;
}

const initialState: AssistantHandoffState = {
  question: null,
  card: null,
  rcsbId: null,
  result: null,
  nonce: 0,
};

const assistantHandoffSlice = createSlice({
  name: 'assistantHandoff',
  initialState,
  reducers: {
    setAssistantHandoff: (
      state,
      action: PayloadAction<{ question: string | null; card: ActionCard; result: AssistantResult | null }>,
    ) => {
      state.question = action.payload.question;
      state.card = action.payload.card;
      state.rcsbId = action.payload.card.rcsb_id ?? null;
      state.result = action.payload.result;
      state.nonce += 1;
    },
    clearAssistantHandoff: (state) => {
      state.question = null;
      state.card = null;
      state.rcsbId = null;
      state.result = null;
    },
  },
});

export const { setAssistantHandoff, clearAssistantHandoff } = assistantHandoffSlice.actions;

export const selectAssistantHandoff = (s: RootState) => s.assistantHandoff;

export default assistantHandoffSlice.reducer;
