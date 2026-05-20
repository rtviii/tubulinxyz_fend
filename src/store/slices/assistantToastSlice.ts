// Holds the most recently clicked assistant ActionCard so a globally-mounted
// toast host (root layout) can summarize what the assistant did *after* the
// card's navigation completes. The source panel unmounts on router.push, so the
// card lives here instead. No LLM call — the summary is built from card fields.

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { ActionCard } from '@/components/assistant/globalTypes';
import type { RootState } from '../store';

interface AssistantToastState {
  card: ActionCard | null;
  // Bumped on every show so the host can restart its auto-dismiss timer even
  // when the same card object is clicked twice in a row.
  nonce: number;
}

const initialState: AssistantToastState = { card: null, nonce: 0 };

const assistantToastSlice = createSlice({
  name: 'assistantToast',
  initialState,
  reducers: {
    showAssistantToast: (state, action: PayloadAction<ActionCard>) => {
      state.card = action.payload;
      state.nonce += 1;
    },
    dismissAssistantToast: (state) => {
      state.card = null;
    },
  },
});

export const { showAssistantToast, dismissAssistantToast } = assistantToastSlice.actions;

export const selectAssistantToastCard = (s: RootState) => s.assistantToast.card;
export const selectAssistantToastNonce = (s: RootState) => s.assistantToast.nonce;

export default assistantToastSlice.reducer;
