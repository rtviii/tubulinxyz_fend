// src/store/slices/slice_structures.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ListStructuresStructuresGetApiArg } from '../tubxz_api';

// Keep your nice readable filter shape for UI state
export interface StructureFilters {
  cursor: string | null;
  limit: number;
  search: string | null;
  year: [number | null, number | null];
  resolution: [number | null, number | null];
  source_taxa: number[];
  host_taxa: number[];
  polymerization_state: string[];
  family: string[];
  ligands: string[];  // <-- Add this
}

interface StructuresState {
  total_count: number;
  next_cursor: string | null;
  grouped_by_deposition: boolean;
  filters: StructureFilters;
}

const initialState: StructuresState = {
  total_count: 0,
  next_cursor: null,
  grouped_by_deposition: true,
  filters: {
    cursor: null,
    limit: 100,
    search: null,
    year: [null, null],
    resolution: [null, null],
    source_taxa: [],
    host_taxa: [],
    polymerization_state: [],
    family: [],
    ligands: []


  },
};

export const structuresSlice = createSlice({
  name: 'structures_page',
  initialState,
  reducers: {
    set_structures_filter: (
      state,
      action: PayloadAction<{ filter_type: keyof StructureFilters; value: any }>
    ) => {
      (state.filters as any)[action.payload.filter_type] = action.payload.value;
      state.filters.cursor = null;
      state.next_cursor = null;
    },
    set_structures_total_count: (state, action: PayloadAction<number>) => {
      state.total_count = action.payload;
    },
    set_structures_next_cursor: (state, action: PayloadAction<string | null>) => {
      state.next_cursor = action.payload;
    },
    update_grouped_by_deposition: (state, action: PayloadAction<boolean>) => {
      state.grouped_by_deposition = action.payload;
    },
    set_structures_page_cursor: (state, action: PayloadAction<string | null>) => {
      state.filters.cursor = action.payload;
    }
  },
});

// --- SELECTOR: Transform UI state → API query args ---
export const selectStructureApiArgs = (filters: StructureFilters): ListStructuresStructuresGetApiArg => ({
  cursor: filters.cursor ?? undefined,
  limit: filters.limit,
  search: filters.search ?? undefined,
  yearMin: filters.year[0] ?? undefined,
  yearMax: filters.year[1] ?? undefined,
  resMin: filters.resolution[0] ?? undefined,
  resMax: filters.resolution[1] ?? undefined,
  sourceTaxa: filters.source_taxa.length > 0 ? filters.source_taxa : undefined,
  hostTaxa: filters.host_taxa.length > 0 ? filters.host_taxa : undefined,
  polyState: filters.polymerization_state.length > 0 
    ? filters.polymerization_state as any 
    : undefined,
  family: filters.family.length > 0 ? filters.family : undefined,
 ligands: filters.ligands.length ? filters.ligands : undefined,  // <-- Add this

});

export const {
  set_structures_filter,
  set_structures_total_count,
  set_structures_next_cursor,
  update_grouped_by_deposition,
  set_structures_page_cursor
} = structuresSlice.actions;

export default structuresSlice.reducer;