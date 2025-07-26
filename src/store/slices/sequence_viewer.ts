// src/store/slices/sequence_viewer.ts
import { createSlice, PayloadAction, createSelector } from '@reduxjs/toolkit';
import { RootState } from '../store';

export interface SequenceData {
  chainId: string;
  pdbId: string;
  sequence: string;
  name?: string;
  chainType?: 'polymer' | 'ligand'; // though ligands won't have sequences
}

interface SequenceViewerState {
  selectedForSequence: SequenceData | null;
  isVisible: boolean;
}

const initialState: SequenceViewerState = {
  selectedForSequence: null,
  isVisible: false,
};

export const sequenceViewerSlice = createSlice({
  name: 'sequenceViewer',
  initialState,
  reducers: {
    setSelectedSequence: (state, action: PayloadAction<SequenceData>) => {
      state.selectedForSequence = action.payload;
      state.isVisible = true;
    },
    clearSelectedSequence: (state) => {
      state.selectedForSequence = null;
      state.isVisible = false;
    },
    toggleSequenceViewer: (state) => {
      state.isVisible = !state.isVisible;
    },
    setSequenceViewerVisibility: (state, action: PayloadAction<boolean>) => {
      state.isVisible = action.payload;
    }
  },
});

export const {
  setSelectedSequence,
  clearSelectedSequence,
  toggleSequenceViewer,
  setSequenceViewerVisibility
} = sequenceViewerSlice.actions;

// Selectors
export const selectSelectedSequence = (state: RootState) => state.sequenceViewer.selectedForSequence;
export const selectIsSequenceViewerVisible = (state: RootState) => state.sequenceViewer.isVisible;

export default sequenceViewerSlice.reducer;