// src/store/slices/annotationsSlice.ts
import { createSlice, PayloadAction, createSelector } from '@reduxjs/toolkit';
import { RootState } from '../store';

// ============================================================
// Types
// ============================================================

export interface LigandSite {
  id: string;                    // "GTP_A_501" format
  ligandId: string;
  ligandName: string;
  ligandChain: string;
  ligandAuthSeqId: number;
  color: string;
  neighborhoodAuthSeqIds: number[];
}

export interface Mutation {
  masterIndex: number;
  authSeqId: number | null;      // Resolved from mapping
  fromResidue: string;
  toResidue: string;
  phenotype: string | null;
}

export interface ChainAnnotationData {
  ligandSites: LigandSite[];
  mutations: Mutation[];
  family: string | null;
}

export interface ChainVisibility {
  showMutations: boolean;
  visibleLigandIds: string[];    // Array for Redux serialization
}

export interface ChainAnnotationEntry {
  data: ChainAnnotationData | null;
  visibility: ChainVisibility;
  isLoading: boolean;
  error: string | null;
}

interface AnnotationsState {
  // Primary chain being viewed (drives which annotations are "active")
  primaryChainKey: string | null;

  // Per-chain storage, keyed by `${RCSB_ID}_${authAsymId}`
  chains: Record<string, ChainAnnotationEntry>;
}

// ============================================================
// Initial State
// ============================================================

const initialState: AnnotationsState = {
  primaryChainKey: null,
  chains: {},
};

const DEFAULT_VISIBILITY: ChainVisibility = {
  showMutations: true,
  visibleLigandIds: [],
};

// ============================================================
// Slice
// ============================================================

export const annotationsSlice = createSlice({
  name: 'annotations',
  initialState,
  reducers: {
    setPrimaryChain: (state, action: PayloadAction<string | null>) => {
      state.primaryChainKey = action.payload;
    },

    // Called when starting to fetch annotations
    setChainLoading: (state, action: PayloadAction<string>) => {
      const key = action.payload;
      if (!state.chains[key]) {
        state.chains[key] = {
          data: null,
          visibility: { ...DEFAULT_VISIBILITY },
          isLoading: true,
          error: null,
        };
      } else {
        state.chains[key].isLoading = true;
        state.chains[key].error = null;
      }
    },

    // Called when annotations are fetched successfully
    setChainAnnotations: (state, action: PayloadAction<{
      chainKey: string;
      data: ChainAnnotationData;
    }>) => {
      const { chainKey, data } = action.payload;
      const existing = state.chains[chainKey];

      state.chains[chainKey] = {
        data,
        visibility: existing?.visibility ?? {
          showMutations: true,
          visibleLigandIds: data.ligandSites.map(s => s.id), // Show all by default
        },
        isLoading: false,
        error: null,
      };
    },

    setChainError: (state, action: PayloadAction<{ chainKey: string; error: string }>) => {
      const { chainKey, error } = action.payload;
      if (state.chains[chainKey]) {
        state.chains[chainKey].isLoading = false;
        state.chains[chainKey].error = error;
      }
    },

    // Visibility toggles
    setMutationsVisible: (state, action: PayloadAction<{ chainKey: string; visible: boolean }>) => {
      const chain = state.chains[action.payload.chainKey];
      if (chain) {
        chain.visibility.showMutations = action.payload.visible;
      }
    },

    toggleLigandSite: (state, action: PayloadAction<{ chainKey: string; siteId: string }>) => {
      const chain = state.chains[action.payload.chainKey];
      if (!chain) return;

      const idx = chain.visibility.visibleLigandIds.indexOf(action.payload.siteId);
      if (idx >= 0) {
        chain.visibility.visibleLigandIds.splice(idx, 1);
      } else {
        chain.visibility.visibleLigandIds.push(action.payload.siteId);
      }
    },

    showAllLigands: (state, action: PayloadAction<string>) => {
      const chain = state.chains[action.payload];
      if (chain?.data) {
        chain.visibility.visibleLigandIds = chain.data.ligandSites.map(s => s.id);
      }
    },

    hideAllLigands: (state, action: PayloadAction<string>) => {
      const chain = state.chains[action.payload];
      if (chain) {
        chain.visibility.visibleLigandIds = [];
      }
    },

    clearChain: (state, action: PayloadAction<string>) => {
      delete state.chains[action.payload];
      if (state.primaryChainKey === action.payload) {
        state.primaryChainKey = null;
      }
    },

    clearAllAnnotations: () => initialState,
  },
});

export const {
  setPrimaryChain,
  setChainLoading,
  setChainAnnotations,
  setChainError,
  setMutationsVisible,
  toggleLigandSite,
  showAllLigands,
  hideAllLigands,
  clearChain,
  clearAllAnnotations,
} = annotationsSlice.actions;

// ============================================================
// Selectors
// ============================================================

const selectAnnotationsState = (state: RootState) => state.annotations;

export const selectPrimaryChainKey = (state: RootState) =>
  state.annotations.primaryChainKey;

export const selectChainEntry = (state: RootState, chainKey: string): ChainAnnotationEntry | null =>
  state.annotations.chains[chainKey] ?? null;

export const selectChainData = (state: RootState, chainKey: string): ChainAnnotationData | null =>
  state.annotations.chains[chainKey]?.data ?? null;

export const selectChainVisibility = (state: RootState, chainKey: string): ChainVisibility | null =>
  state.annotations.chains[chainKey]?.visibility ?? null;

export const selectChainIsLoading = (state: RootState, chainKey: string): boolean =>
  state.annotations.chains[chainKey]?.isLoading ?? false;

// All chain keys that have been loaded (for multi-chain scenarios)
export const selectLoadedChainKeys = createSelector(
  [selectAnnotationsState],
  (annotations): string[] => Object.keys(annotations.chains).filter(
    k => annotations.chains[k].data !== null
  )
);

export default annotationsSlice.reducer;