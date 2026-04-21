// src/store/slices/chainFocusSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../store';

interface ChainFocusState {
  hoveredChainKey: string | null;
  selectedChainKey: string | null;
  // Set while the user hovers an "expert-mode" action icon in the sidebar so
  // the pill's Expert Mode button can highlight in sympathy.
  expertHintActive: boolean;
}

const initialState: ChainFocusState = {
  hoveredChainKey: null,
  selectedChainKey: null,
  expertHintActive: false,
};

export const chainFocusSlice = createSlice({
  name: 'chainFocus',
  initialState,
  reducers: {
    setHoveredChain: (state, action: PayloadAction<string | null>) => {
      state.hoveredChainKey = action.payload;
    },
    setSelectedChain: (state, action: PayloadAction<string | null>) => {
      state.selectedChainKey = action.payload;
    },
    toggleSelectedChain: (state, action: PayloadAction<string>) => {
      state.selectedChainKey =
        state.selectedChainKey === action.payload ? null : action.payload;
    },
    setExpertHintActive: (state, action: PayloadAction<boolean>) => {
      state.expertHintActive = action.payload;
    },
    clearFocus: () => initialState,
  },
});

export const {
  setHoveredChain,
  setSelectedChain,
  toggleSelectedChain,
  setExpertHintActive,
  clearFocus,
} = chainFocusSlice.actions;

export const selectHoveredChainKey = (state: RootState) =>
  state.chainFocus.hoveredChainKey;

export const selectSelectedChainKey = (state: RootState) =>
  state.chainFocus.selectedChainKey;

export const selectExpertHintActive = (state: RootState) =>
  state.chainFocus.expertHintActive;

export default chainFocusSlice.reducer;