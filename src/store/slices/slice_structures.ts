// src/store/slices/slice_structures.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ListStructuresStructuresGetApiArg } from '../tubxz_api';

// src/store/slices/slice_structures.ts

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
  ligands: string[];

  // ✅ variants (rename from mutation_*)
  has_variants: boolean | null;
  variant_family: string | null;
  variant_type: "substitution" | "insertion" | "deletion" | null;
  variant_position_min: number | null;
  variant_position_max: number | null;
  variant_wild_type: string | null;
  variant_observed: string | null;
  variant_source: string | null; // if you use it
  variant_phenotype: string | null;
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
    limit: 50, 
    search: null,
    year: [null, null],
    resolution: [null, null],
    source_taxa: [],
    host_taxa: [],
    polymerization_state: [],
    family: [],
    ligands: [],

    has_variants: null,
    variant_family: null,
    variant_type: null,
    variant_position_min: null,
    variant_position_max: null,
    variant_wild_type: null,
    variant_observed: null,
    variant_source: null,
    variant_phenotype: null,
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

// --- SELECTOR: Transform UI jstate → API query args ---
// --- SELECTOR: Transform UI state → API query args ---
export const selectStructureApiArgs = (filters: StructureFilters): ListStructuresStructuresGetApiArg => ({
  cursor: filters.cursor ?? undefined,
  limit: filters.limit,

  search: filters.search ?? undefined,
  yearMin: filters.year[0] ?? undefined,
  yearMax: filters.year[1] ?? undefined,
  resMin: filters.resolution[0] ?? undefined,
  resMax: filters.resolution[1] ?? undefined,

  sourceTaxa: filters.source_taxa.length ? (filters.source_taxa as any) : undefined,
  hostTaxa: filters.host_taxa.length ? (filters.host_taxa as any) : undefined,

  polyState: filters.polymerization_state.length ? (filters.polymerization_state as any) : undefined,
  family: filters.family.length ? filters.family : undefined,
  ligands: filters.ligands.length ? filters.ligands : undefined,

  // ✅ variants: MUST match backend aliases in router_structures.py
  hasVariants: filters.has_variants ?? undefined,
  variantFamily: filters.variant_family ?? undefined,
  variantType: filters.variant_type ?? undefined,
  variantPosMin: filters.variant_position_min ?? undefined,
  variantPosMax: filters.variant_position_max ?? undefined,
  variantWildType: filters.variant_wild_type ?? undefined,
  variantObserved: filters.variant_observed ?? undefined,
  variantSource: filters.variant_source ?? undefined,
  variantPhenotype: filters.variant_phenotype ?? undefined,
});


export const {
  set_structures_filter,
  set_structures_total_count,
  set_structures_next_cursor,
  update_grouped_by_deposition,
  set_structures_page_cursor
} = structuresSlice.actions;

export default structuresSlice.reducer;