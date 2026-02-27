// src/store/slices/chainFocusSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../store';

interface ChainFocusState {
  hoveredChainKey: string | null;
  selectedChainKey: string | null;
}

const initialState: ChainFocusState = {
  hoveredChainKey: null,
  selectedChainKey: null,
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
    clearFocus: () => initialState,
  },
});

export const {
  setHoveredChain,
  setSelectedChain,
  toggleSelectedChain,
  clearFocus,
} = chainFocusSlice.actions;

export const selectHoveredChainKey = (state: RootState) =>
  state.chainFocus.hoveredChainKey;

export const selectSelectedChainKey = (state: RootState) =>
  state.chainFocus.selectedChainKey;

export default chainFocusSlice.reducer;