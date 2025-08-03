// src/store/slices/sequence_structure_sync.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface ResidueSelection {
  pdbId: string;
  chainId: string;
  startResidue: number; // 1-based residue numbering
  endResidue: number;
  source: 'sequence' | 'structure'; // Which viewer initiated the selection
}

export interface ResidueHover {
  pdbId: string;
  chainId: string;
  residueNumber: number; // 1-based
  source: 'sequence' | 'structure';
}

interface SequenceStructureSyncState {
  currentSelection: ResidueSelection | null;
  currentHover: ResidueHover | null;
  isSelectionSyncEnabled: boolean;
  isHoverSyncEnabled: boolean;
}

const initialState: SequenceStructureSyncState = {
  currentSelection: null,
  currentHover: null,
  isSelectionSyncEnabled: true,
  isHoverSyncEnabled: true,
};

export const sequenceStructureSyncSlice = createSlice({
  name: 'sequenceStructureSync',
  initialState,
  reducers: {
    setResidueSelection: (state, action: PayloadAction<ResidueSelection | null>) => {
      state.currentSelection = action.payload;
    },
    setResidueHover: (state, action: PayloadAction<ResidueHover | null>) => {
      state.currentHover = action.payload;
    },
    clearSelection: (state) => {
      state.currentSelection = null;
    },
    clearHover: (state) => {
      state.currentHover = null;
    },
    toggleSelectionSync: (state) => {
      state.isSelectionSyncEnabled = !state.isSelectionSyncEnabled;
    },
    toggleHoverSync: (state) => {
      state.isHoverSyncEnabled = !state.isHoverSyncEnabled;
    },
    setSelectionSyncEnabled: (state, action: PayloadAction<boolean>) => {
      state.isSelectionSyncEnabled = action.payload;
    },
    setHoverSyncEnabled: (state, action: PayloadAction<boolean>) => {
      state.isHoverSyncEnabled = action.payload;
    }
  },
});

export const {
  setResidueSelection,
  setResidueHover,
  clearSelection,
  clearHover,
  toggleSelectionSync,
  toggleHoverSync,
  setSelectionSyncEnabled,
  setHoverSyncEnabled
} = sequenceStructureSyncSlice.actions;

export default sequenceStructureSyncSlice.reducer;