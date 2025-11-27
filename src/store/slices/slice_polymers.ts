import { createSlice, PayloadAction } from '@reduxjs/toolkit';

// Matches Backend Pydantic Model: PolymersFilterParams
export interface PolymerFilters {
  cursor: string | null; 
  limit: number;
  year: [number | null, number | null];
  search: string | null;
  resolution: [number | null, number | null];
  source_taxa: number[];
  host_taxa: number[];
  family: string[];
  uniprot_id: string | null;
  has_motif: string | null;
}

interface PolymersState {
  total_count: number; // Total polymers found
  total_paren_structures_count: number; // Total structures they belong to
  next_cursor: any; // The cursor object returned by backend
  filters: PolymerFilters;
}

const initialState: PolymersState = {
  total_count: 0,
  total_paren_structures_count: 0,
  next_cursor: null,
  filters: {
    cursor: null,
    limit: 20,
    year: [null, null],
    search: null,
    resolution: [null, null],
    source_taxa: [],
    host_taxa: [],
    family: [],
    uniprot_id: null,
    has_motif: null
  },
};

export const polymersSlice = createSlice({
  name: 'polymers_page', 
  initialState,
  reducers: {
    set_polymers_filter: (
      state,
      action: PayloadAction<{ filter_type: keyof PolymerFilters; value: any }>
    ) => {
      // @ts-ignore
      state.filters[action.payload.filter_type] = action.payload.value;
      // Reset pagination when filters change
      state.filters.cursor = null; 
      state.next_cursor = null;
    },
    set_polymers_total_count: (state, action: PayloadAction<number>) => {
      state.total_count = action.payload;
    },
    set_polymers_structure_count: (state, action: PayloadAction<number>) => {
      state.total_paren_structures_count = action.payload;
    },
    set_polymers_next_cursor: (state, action: PayloadAction<any>) => {
      state.next_cursor = action.payload;
    },
    set_polymers_page_cursor: (state, action: PayloadAction<any>) => {
      state.filters.cursor = action.payload;
    }
  },
});

export const {
  set_polymers_filter,
  set_polymers_total_count,
  set_polymers_structure_count,
  set_polymers_next_cursor,
  set_polymers_page_cursor
} = polymersSlice.actions;

export default polymersSlice.reducer;