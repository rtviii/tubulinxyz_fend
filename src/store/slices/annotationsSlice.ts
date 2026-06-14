import { createSlice, PayloadAction, createSelector } from '@reduxjs/toolkit';
import { RootState } from '../store';
import { resolveLigandColor } from '@/lib/colors/annotationPaletteResolve';
import { selectLigandOverrides } from '@/store/slices/colorOverridesSlice';

// ============================================================
// Types
// ============================================================

export type VariantType = 'substitution' | 'insertion' | 'deletion';

export interface LigandSite {
  id: string;
  ligandId: string;
  ligandName: string;
  ligandChain: string;
  ligandAuthSeqId: number;
  drugbankId: string | null;
  residueCount: number;
  masterIndices: number[];
  authSeqIds: number[];
}

export interface Variant {
  type: VariantType;
  masterIndex: number;
  authSeqId: number | null;
  fromResidue: string;
  toResidue: string;
  phenotype: string | null;
  source: string | null;
  uniprotId: string | null;
  // Literature-specific fields (Morisette database)
  species: string | null;
  tubulinType: string | null;
  referenceLink: string | null;
  keywords: string | null;
  notes: string | null;
  utnPosition: number | null;
}

export interface Modification {
  masterIndex: number;
  aminoAcid: string;
  modificationType: string;
  species: string | null;            // source abbreviation, e.g. "H. sapiens"
  taxId: number | null;              // NCBI taxonomy id
  speciesFullName: string | null;    // canonical scientific name
  tubulinType: string | null;
  phenotype: string | null;
  databaseLink: string | null;
  utnPosition: number | null;
}

export interface ChainAnnotationData {
  ligandSites: LigandSite[];
  variants: Variant[];
  modifications: Modification[];
  family: string | null;
  taxId: number | null;              // this chain's source organism (first src_organism_id)
  speciesFullName: string | null;    // canonical scientific name matching taxId
}

export interface ChainVisibility {
  showVariants: boolean;
  showModifications: boolean;
  visibleLigandIds: string[];
  /** Modification types the user has SELECTED -- these materialize as aux rows
   *  when the parent chain is expanded, and contribute to the principal row's
   *  overpaint when the chain is collapsed. Managed via the PTMs+ popup. */
  visibleModificationTypes: string[];
  /** Modification types whose paint is temporarily SILENCED (eye-off on the aux
   *  row). Row still exists; just no color cells. Independent from selection so
   *  toggling the eye doesn't delete the row. */
  mutedModificationTypes: string[];
  /** Which species (NCBI taxids) to include when filtering modifications for this chain.
   *  Seeded to [chain's own taxId] on first data load; user can add/remove via the PTM dropdown.
   *  Empty array = no PTMs surfaced. */
  includedSpeciesTaxIds: number[];
}

export interface ChainAnnotationEntry {
  data: ChainAnnotationData | null;
  visibility: ChainVisibility;
  isLoading: boolean;
  error: string | null;
}

interface AnnotationsState {
  primaryChainKey: string | null;
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
  showVariants: false,
  showModifications: false,
  visibleLigandIds: [],
  visibleModificationTypes: [],
  mutedModificationTypes: [],
  includedSpeciesTaxIds: [],
};

// ============================================================
// Slice
// ============================================================

export const annotationsSlice = createSlice({
  name: 'annotations',
  initialState,
  reducers: {
    setPrimaryChain: (state, action: PayloadAction<string | null>) => {
      // Note: annotation rows (variants/ligands/PTMs) deliberately stay OFF by
      // default here -- the user opts in explicitly via the aux-row controls.
      // (We used to auto-enable showVariants for the new primary, which made
      // expert mode pop a variants track the user never asked for.)
      state.primaryChainKey = action.payload;
    },

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

    setChainAnnotations: (state, action: PayloadAction<{
      chainKey: string;
      data: ChainAnnotationData;
    }>) => {
      const { chainKey, data } = action.payload;
      const existing = state.chains[chainKey];
      const hadData = existing?.data != null;

      state.chains[chainKey] = {
        data,
        visibility: hadData && existing?.visibility
          ? existing.visibility
          : {
              // All annotations OFF by default — user opts in via the
              // ligand-chip toolbox / aux-row controls.
              showVariants: false,
              showModifications: false,
              visibleLigandIds: [],
              visibleModificationTypes: existing?.visibility?.visibleModificationTypes ?? [],
              mutedModificationTypes: existing?.visibility?.mutedModificationTypes ?? [],
              // First data load ALWAYS seeds with the chain's own species. NOT
              // `?? []` here -- setChainLoading creates the entry with an empty
              // array, so a nullish-coalesce would never seed. We're explicitly
              // entering this branch only when hadData was false (first load), so
              // overwriting is correct.
              includedSpeciesTaxIds: data.taxId != null ? [data.taxId] : [],
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

    setVariantsVisible: (state, action: PayloadAction<{ chainKey: string; visible: boolean }>) => {
      const chain = state.chains[action.payload.chainKey];
      if (chain) {
        chain.visibility.showVariants = action.payload.visible;
      }
    },

    setModificationsVisible: (state, action: PayloadAction<{ chainKey: string; visible: boolean }>) => {
      const chain = state.chains[action.payload.chainKey];
      if (chain) {
        chain.visibility.showModifications = action.payload.visible;
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

    /** Hide all ligand overlays across every chain. Variants remain visible. */
    hideAllVisibility: (state) => {
      for (const chain of Object.values(state.chains)) {
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



    // ── New actions (add inside reducers: { ... }) ──

    toggleAllVariants: (state) => {
      let anyVisible = false;
      for (const entry of Object.values(state.chains)) {
        if (entry.visibility.showVariants) { anyVisible = true; break; }
      }
      for (const entry of Object.values(state.chains)) {
        entry.visibility.showVariants = !anyVisible;
      }
    },

    toggleModificationType: (state, action: PayloadAction<{ chainKey: string; modType: string }>) => {
      const chain = state.chains[action.payload.chainKey];
      if (!chain) return;
      const idx = chain.visibility.visibleModificationTypes.indexOf(action.payload.modType);
      if (idx >= 0) {
        chain.visibility.visibleModificationTypes.splice(idx, 1);
        // Clearing selection also clears the muted flag so a later re-add starts un-muted.
        const m = chain.visibility.mutedModificationTypes.indexOf(action.payload.modType);
        if (m >= 0) chain.visibility.mutedModificationTypes.splice(m, 1);
      } else {
        chain.visibility.visibleModificationTypes.push(action.payload.modType);
      }
    },

    /** Mute/unmute a modification type's overpaint without changing whether the
     *  aux row is materialized. Eye-icon click on a PTM aux row uses this. */
    toggleModificationMuted: (state, action: PayloadAction<{ chainKey: string; modType: string }>) => {
      const chain = state.chains[action.payload.chainKey];
      if (!chain) return;
      const muted = chain.visibility.mutedModificationTypes;
      const idx = muted.indexOf(action.payload.modType);
      if (idx >= 0) muted.splice(idx, 1);
      else muted.push(action.payload.modType);
    },

    /** Set the full list of taxids whose PTMs should surface for this chain.
     *  Used by the PerChainPtmDropdown for both single toggles (add/remove one
     *  species) and bulk operations (apply a group pill like 'Mammals'). */
    setSpeciesForChain: (state, action: PayloadAction<{ chainKey: string; taxIds: number[] }>) => {
      const chain = state.chains[action.payload.chainKey];
      if (!chain) return;
      // De-duplicate while preserving order.
      const seen = new Set<number>();
      const next: number[] = [];
      for (const t of action.payload.taxIds) {
        if (seen.has(t)) continue;
        seen.add(t);
        next.push(t);
      }
      chain.visibility.includedSpeciesTaxIds = next;
    },

    toggleAllLigandsByChemId: (state, action: PayloadAction<string>) => {
      const chemId = action.payload;
      let anyVisible = false;

      for (const entry of Object.values(state.chains)) {
        if (!entry.data) continue;
        for (const site of entry.data.ligandSites) {
          if (site.ligandId === chemId && entry.visibility.visibleLigandIds.includes(site.id)) {
            anyVisible = true;
            break;
          }
        }
        if (anyVisible) break;
      }

      for (const entry of Object.values(state.chains)) {
        if (!entry.data) continue;
        for (const site of entry.data.ligandSites) {
          if (site.ligandId !== chemId) continue;
          const idx = entry.visibility.visibleLigandIds.indexOf(site.id);
          if (anyVisible) {
            if (idx >= 0) entry.visibility.visibleLigandIds.splice(idx, 1);
          } else {
            if (idx < 0) entry.visibility.visibleLigandIds.push(site.id);
          }
        }
      }
    },
  },
});

export const {
  setPrimaryChain,
  setChainLoading,
  setChainAnnotations,
  setChainError,
  setVariantsVisible,
  setModificationsVisible,
  toggleLigandSite,
  showAllLigands,
  hideAllLigands,
  hideAllVisibility,
  clearChain,
  clearAllAnnotations,
  toggleModificationType,
  toggleModificationMuted,
  setSpeciesForChain,
  toggleAllVariants,
  toggleAllLigandsByChemId,
} = annotationsSlice.actions;

// ============================================================
// Selectors
// ============================================================

export const selectAnnotationsState = (state: RootState) => state.annotations;

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

export const selectLoadedChainKeys = createSelector(
  [selectAnnotationsState],
  (annotations): string[] => Object.keys(annotations.chains).filter(
    k => annotations.chains[k].data !== null
  )
);

// ── Global selectors ──

export const selectAnyVariantsVisible = createSelector(
  [selectAnnotationsState],
  (annotations): boolean => {
    for (const entry of Object.values(annotations.chains)) {
      if (entry.visibility.showVariants) return true;
    }
    return false;
  }
);

export interface GlobalLigandInfo {
  chemId: string;
  color: string;
  count: number;
  anyVisible: boolean;
}

export const selectAllUniqueLigandIds = createSelector(
  [selectAnnotationsState, selectLigandOverrides],
  (annotations, overrides): GlobalLigandInfo[] => {
    const map = new Map<string, { count: number; anyVisible: boolean }>();
    for (const entry of Object.values(annotations.chains)) {
      if (!entry.data) continue;
      for (const site of entry.data.ligandSites) {
        const isVisible = entry.visibility.visibleLigandIds.includes(site.id);
        const existing = map.get(site.ligandId);
        if (existing) {
          existing.count++;
          if (isVisible) existing.anyVisible = true;
        } else {
          map.set(site.ligandId, { count: 1, anyVisible: isVisible });
        }
      }
    }
    return Array.from(map.entries())
      .map(([chemId, info]) => ({ chemId, color: resolveLigandColor(overrides, chemId), ...info }))
      .sort((a, b) => b.count - a.count);
  }
);

// ── Detailed ligand info (per-chain or global), used by the ChainAnchorPill
//    toolbox: includes the actual sites + name + drugbank id so the popover
//    can show metadata and the focus button can pick which site to anchor on.

export interface DetailedLigandSite {
  /** The ChainKey this site belongs to. */
  chainKey: string;
  /** Site object verbatim from ChainAnnotationData.ligandSites. */
  site: LigandSite;
  /** Whether the binding-site annotation is currently visible on this chain. */
  annotationVisible: boolean;
}

export interface DetailedLigandInfo {
  chemId: string;
  color: string;
  count: number;
  ligandName: string;
  drugbankId: string | null;
  /** True when any chain has the binding-site annotation on for any site. */
  anyAnnotationVisible: boolean;
  sites: DetailedLigandSite[];
}

function aggregateLigands(
  entries: Array<{ chainKey: string; entry: ChainAnnotationEntry }>,
  ligandOverrides: Record<string, string>,
): DetailedLigandInfo[] {
  const map = new Map<string, DetailedLigandInfo>();
  for (const { chainKey, entry } of entries) {
    if (!entry.data) continue;
    for (const site of entry.data.ligandSites) {
      const visible = entry.visibility.visibleLigandIds.includes(site.id);
      const detailed: DetailedLigandSite = { chainKey, site, annotationVisible: visible };
      const existing = map.get(site.ligandId);
      if (existing) {
        existing.count += 1;
        if (visible) existing.anyAnnotationVisible = true;
        // Backfill name/drugbank from later sites if the first one didn't have them.
        if (!existing.ligandName && site.ligandName) existing.ligandName = site.ligandName;
        if (existing.drugbankId == null && site.drugbankId) existing.drugbankId = site.drugbankId;
        existing.sites.push(detailed);
      } else {
        map.set(site.ligandId, {
          chemId: site.ligandId,
          color: resolveLigandColor(ligandOverrides, site.ligandId),
          count: 1,
          ligandName: site.ligandName ?? '',
          drugbankId: site.drugbankId ?? null,
          anyAnnotationVisible: visible,
          sites: [detailed],
        });
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

/** Detailed ligands for ONE chain (used in expert mode where ligands are scoped to the active chain). */
export const selectLigandsForChain = createSelector(
  [
    (state: RootState, chainKey: string) =>
      state.annotations.chains[chainKey] ?? null,
    selectLigandOverrides,
    (_state: RootState, chainKey: string) => chainKey,
  ],
  (entry, overrides, chainKey): DetailedLigandInfo[] => {
    if (!entry) return [];
    return aggregateLigands([{ chainKey, entry }], overrides);
  }
);

/** Detailed ligands across all chains (used in easy mode for the whole structure). */
export const selectAllLigandsDetailed = createSelector(
  [selectAnnotationsState, selectLigandOverrides],
  (annotations, overrides): DetailedLigandInfo[] => {
    const entries = Object.entries(annotations.chains).map(([chainKey, entry]) => ({
      chainKey,
      entry,
    }));
    return aggregateLigands(entries, overrides);
  }
);
export interface ExportableLigandSite {
  pdbId: string;
  chainId: string;
  ligandId: string;
  ligandName: string;
  ligandChain: string;
  ligandAuthSeqId: number;
  drugbankId: string | null;
  residueCount: number;
  masterIndices: number[];
  authSeqIds: number[];
}

export const selectAllLigandSitesForExport = createSelector(
  [selectAnnotationsState],
  (annotations): ExportableLigandSite[] => {
    const sites: ExportableLigandSite[] = [];
    for (const [chainKey, entry] of Object.entries(annotations.chains)) {
      if (!entry.data) continue;
      const underscore = chainKey.indexOf('_');
      if (underscore < 0) continue;
      const pdbId = chainKey.slice(0, underscore);
      const chainId = chainKey.slice(underscore + 1);
      for (const site of entry.data.ligandSites) {
        sites.push({
          pdbId,
          chainId,
          ligandId: site.ligandId,
          ligandName: site.ligandName,
          ligandChain: site.ligandChain,
          ligandAuthSeqId: site.ligandAuthSeqId,
          drugbankId: site.drugbankId,
          residueCount: site.residueCount,
          masterIndices: site.masterIndices,
          authSeqIds: site.authSeqIds,
        });
      }
    }
    return sites;
  }
);

export default annotationsSlice.reducer;