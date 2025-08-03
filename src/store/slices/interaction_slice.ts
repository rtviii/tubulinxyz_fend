// src/store/slices/interactionSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../store';

interface InteractionState {
  activeInteractionComponentRef: string | null;
}

const initialState: InteractionState = {
  activeInteractionComponentRef: null,
};

export const interactionSlice = createSlice({
  name: 'interaction',
  initialState,
  reducers: {
    setActiveInteractionComponentRef: (state, action: PayloadAction<string>) => {
      state.activeInteractionComponentRef = action.payload;
    },
    clearActiveInteractionComponentRef: (state) => {
      state.activeInteractionComponentRef = null;
    },
  },
});

export const {
  setActiveInteractionComponentRef,
  clearActiveInteractionComponentRef,
} = interactionSlice.actions;

export const selectActiveInteractionComponentRef = (state: RootState) => state.interaction.activeInteractionComponentRef;

export default interactionSlice.reducer;