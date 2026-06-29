// Carries a card's precomputed `arrival_actions` across the landing -> structure
// navigation so the structure page can REPLAY them (paint annotation tracks,
// focus the binding site) once the view has settled. Mirrors assistantHandoffSlice:
// the source panel unmounts on router.push, so the payload lives here instead.
//
// Refresh-safe by construction: the store resets on a hard reload, so a refreshed
// structure URL replays nothing. The structure page clears this after applying.

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { AssistantViewerActionCall } from '@/components/assistant/types';
import type { RootState } from '../store';

interface ArrivalActionsState {
  // The structure these actions target. The replay effect only fires when the
  // loaded structure matches, so a stale handoff for a different structure is
  // ignored.
  rcsbId: string | null;
  actions: AssistantViewerActionCall[];
  // Bumped on every set so the replay effect can one-shot per arrival (compare
  // against the last-applied nonce) even if the same card is clicked twice.
  nonce: number;
}

const initialState: ArrivalActionsState = { rcsbId: null, actions: [], nonce: 0 };

const arrivalActionsSlice = createSlice({
  name: 'arrivalActions',
  initialState,
  reducers: {
    setArrivalActions: (
      state,
      action: PayloadAction<{ rcsbId: string | null; actions: AssistantViewerActionCall[] }>,
    ) => {
      state.rcsbId = action.payload.rcsbId;
      state.actions = action.payload.actions;
      state.nonce += 1;
    },
    clearArrivalActions: (state) => {
      state.rcsbId = null;
      state.actions = [];
    },
  },
});

export const { setArrivalActions, clearArrivalActions } = arrivalActionsSlice.actions;

export const selectArrivalActions = (s: RootState) => s.arrivalActions;

export default arrivalActionsSlice.reducer;
