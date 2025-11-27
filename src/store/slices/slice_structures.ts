import { createSlice, PayloadAction } from '@reduxjs/toolkit';

// Matches your Backend Pydantic Model: StructureFilterParams
export interface StructureFilters {
  cursor: string | null;
  limit: number;
  year: [number | null, number | null]; // [start, end]
  search: string | null;
  resolution: [number | null, number | null]; // [min, max]
  source_taxa: number[];
  host_taxa: number[];
  polymerization_state: string[]; // ['monomer', 'dimer', etc.]
  family: string[]; // ['alpha', 'beta', etc.] (optional if shared)
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
  grouped_by_deposition: true, // UI toggle state
  filters: {
    cursor: null,
    limit: 20,
    year: [null, null],
    search: null,
    resolution: [null, null],
    source_taxa: [],
    host_taxa: [],
    polymerization_state: [],
    family: []
  },
};

export const structuresSlice = createSlice({
  name: 'structures_page',
  initialState,
  reducers: {
    // 1. Generic Filter Updater (Handles any field in StructureFilters)
    set_structures_filter: (
      state,
      action: PayloadAction<{ filter_type: keyof StructureFilters; value: any }>
    ) => {
      // @ts-ignore - Dynamic assignment is safe here due to payload typing
      state.filters[action.payload.filter_type] = action.payload.value;
      
      // Reset cursor when filters change so we start from page 1
      state.filters.cursor = null; 
      state.next_cursor = null;
    },

    // 2. Metadata Updaters (Called when API returns data)
    set_structures_total_count: (state, action: PayloadAction<number>) => {
      state.total_count = action.payload;
    },
    set_structures_next_cursor: (state, action: PayloadAction<string | null>) => {
      state.next_cursor = action.payload;
    },
    
    // 3. UI Toggle
    update_grouped_by_deposition: (state, action: PayloadAction<boolean>) => {
      state.grouped_by_deposition = action.payload;
    },
    
    // 4. Pagination
    set_structures_page_cursor: (state, action: PayloadAction<string | null>) => {
      state.filters.cursor = action.payload;
    }
  },
});

export const {
  set_structures_filter,
  set_structures_total_count,
  set_structures_next_cursor,
  update_grouped_by_deposition,
  set_structures_page_cursor
} = structuresSlice.actions;

export default structuresSlice.reducer;