import { createSlice, PayloadAction, createSelector } from '@reduxjs/toolkit';
import { RootState } from '../store';
import { tubxz_api } from '../tubxz_api';
import type {
  ChainAnnotations,
  LigandSite,
  MutationAnnotation,
  DisplayableLigandSite,
  DisplayableMutation,
  PositionAnnotations,
} from '@/lib/types/annotations';
import { selectPositionMapping } from './sequence_registry';

const EMPTY_LIGANDS: DisplayableLigandSite[] = [];
const EMPTY_MUTATIONS: DisplayableMutation[] = [];

const LIGAND_COLORS: Record<string, string> = {
  'GTP': '#4363d8',
  'GDP': '#FFD700',
  'TAX': '#3cb44b',
  'TXL': '#3cb44b',
  'EPO': '#f58231',
  'VLB': '#e6194b',
  'COL': '#911eb4',
  'MG': '#42d4f4',
  'CA': '#f032e6',
  'ZN': '#bfef45',
};

function getLigandColor(ligandId: string): string {
  if (!ligandId) return '#cccccc';
  if (LIGAND_COLORS[ligandId]) return LIGAND_COLORS[ligandId];
  let hash = 0;
  for (let i = 0; i < ligandId.length; i++) {
    hash = ligandId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 70%, 50%)`;
}

function makeLigandSiteKey(site: LigandSite): string {
  return `${site.ligandId}_${site.ligandChain}_${site.ligandAuthSeqId}`;
}

interface AnnotationsState {
  byChain: Record<string, ChainAnnotations>;
  displayState: Record<string, {
    showMutations: boolean;
    visibleLigandSites: string[];
  }>;
  loadingChains: string[];
  exploration: {
    family: string;
    position: number;
    data: PositionAnnotations | null;
    loading: boolean;
    error: string | null;
  } | null;
}

const initialState: AnnotationsState = {
  byChain: {},
  displayState: {},
  loadingChains: [],
  exploration: null,
};

export const annotationsSlice = createSlice({
  name: 'annotations',
  initialState,
  reducers: {
    setChainAnnotations: (state, action: PayloadAction<ChainAnnotations>) => {
      const key = `${action.payload.rcsbId.toUpperCase()}_${action.payload.authAsymId}`;
      state.byChain[key] = action.payload;

      // Auto-enable all fetched ligands by default
      const allLigandKeys = action.payload.ligandSites.map(makeLigandSiteKey);
      state.displayState[key] = {
        showMutations: true,
        visibleLigandSites: allLigandKeys,
      };
    },

    setMutationsVisible: (state, action: PayloadAction<{ chainKey: string; visible: boolean }>) => {
      const key = action.payload.chainKey.toUpperCase();
      if (state.displayState[key]) {
        state.displayState[key].showMutations = action.payload.visible;
      }
    },

    toggleLigandSite: (state, action: PayloadAction<{ chainKey: string; siteKey: string }>) => {
      const key = action.payload.chainKey.toUpperCase();
      const display = state.displayState[key];
      if (!display) return;

      const idx = display.visibleLigandSites.indexOf(action.payload.siteKey);
      if (idx >= 0) {
        display.visibleLigandSites.splice(idx, 1);
      } else {
        display.visibleLigandSites.push(action.payload.siteKey);
      }
    },

    showAllLigands: (state, action: PayloadAction<string>) => {
      const key = action.payload.toUpperCase();
      const annotations = state.byChain[key];
      if (annotations && state.displayState[key]) {
        state.displayState[key].visibleLigandSites =
          annotations.ligandSites.map(makeLigandSiteKey);
      }
    },

    hideAllLigands: (state, action: PayloadAction<string>) => {
      const key = action.payload.toUpperCase();
      if (state.displayState[key]) {
        state.displayState[key].visibleLigandSites = [];
      }
    },

    clearChainAnnotations: (state, action: PayloadAction<string>) => {
      const key = action.payload.toUpperCase();
      delete state.byChain[key];
      delete state.displayState[key];
    },
  },
});

export const {
  setChainAnnotations,
  setMutationsVisible,
  toggleLigandSite,
  showAllLigands,
  hideAllLigands,
  clearChainAnnotations,
} = annotationsSlice.actions;

const selectAnnotationsState = (state: RootState) => state.annotations;

export const selectChainAnnotations = createSelector(
  [selectAnnotationsState, (_: RootState, chainKey: string) => chainKey.toUpperCase()],
  (annotations, key): ChainAnnotations | null => annotations.byChain[key] ?? null
);

export const selectChainDisplayState = createSelector(
  [selectAnnotationsState, (_: RootState, chainKey: string) => chainKey.toUpperCase()],
  (annotations, key) => annotations.displayState[key] ?? null
);

export const selectDisplayableLigandSites = createSelector(
  [
    selectChainAnnotations,
    (state: RootState, chainKey: string) => selectPositionMapping(state, chainKey),
  ],
  (annotations, positionMapping): DisplayableLigandSite[] => {
    if (!annotations) return EMPTY_LIGANDS;

    // Build the reverse map (authSeqId -> masterIndex)
    const authToMaster: Record<number, number> = {};
    if (positionMapping) {
      Object.entries(positionMapping).forEach(([masterStr, authSeqId]) => {
        authToMaster[Number(authSeqId)] = parseInt(masterStr, 10);
      });
    }

    return annotations.ligandSites.map((site): DisplayableLigandSite => {
      const siteKey = makeLigandSiteKey(site);
      const masterSet = new Set<number>();

      // Use the neighborhood residues provided by the backend
      for (const authSeqId of (site.neighborhoodAuthSeqIds ?? [])) {
        const master = authToMaster[Number(authSeqId)];
        if (master !== undefined) masterSet.add(master);
      }

      // Also include master indices explicitly mentioned in interactions
      for (const ix of site.interactions) {
        if (ix.masterIndex !== null) masterSet.add(ix.masterIndex);
      }

      return {
        id: siteKey,
        ligandId: site.ligandId,
        ligandName: site.ligandName,
        ligandChain: site.ligandChain,
        color: getLigandColor(site.ligandId),
        masterIndices: Array.from(masterSet).sort((a, b) => a - b),
        authSeqIds: site.neighborhoodAuthSeqIds,
        interactionCount: site.interactions.length,
      };
    });
  }
);

export const selectVisibleLigandSites = createSelector(
  [selectDisplayableLigandSites, selectChainDisplayState],
  (allSites, displayState): DisplayableLigandSite[] => {
    if (!displayState) return allSites;
    const visibleSet = new Set(displayState.visibleLigandSites);
    return allSites.filter(site => visibleSet.has(site.id));
  }
);

export const selectDisplayableMutations = createSelector(
  [selectChainAnnotations, selectChainDisplayState],
  (annotations, displayState): DisplayableMutation[] => {
    if (!annotations || !displayState?.showMutations) return EMPTY_MUTATIONS;

    return annotations.mutations.map((m): DisplayableMutation => ({
      masterIndex: m.masterIndex,
      fromResidue: m.fromResidue,
      toResidue: m.toResidue,
      phenotype: m.phenotype,
      label: `${m.fromResidue}${m.masterIndex}${m.toResidue}`,
    }));
  }
);

export default annotationsSlice.reducer;