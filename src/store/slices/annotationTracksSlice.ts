/**
 * Annotation tracks: chain-independent aux rows that paint master columns
 * matching a typed FilterSpec.
 *
 * Parallel to the existing chain-scoped pipeline in annotationsSlice. Tracks
 * are global (no parentSequenceId), share a single backend resolve endpoint
 * (POST /annotations/track/resolve), and are family-scoped (each track paints
 * one family's master columns).
 *
 * The FilterSpec types mirror the Pydantic models in
 * api/routers/router_annotations.py and are intentionally snake_case to match
 * the wire format — no client-side translation layer.
 */
import { createSlice, PayloadAction, createSelector } from '@reduxjs/toolkit';
import type { RootState } from '../store';

// ============================================================
// FilterSpec — discriminated by `kind`. Mirrors backend Pydantic.
// ============================================================

export type Family = 'tubulin_alpha' | 'tubulin_beta' | 'tubulin_gamma' | string;

export interface VariantFilterSpec {
  kind: 'variants';
  family: Family;
  wild_type_aas?: string[];
  observed_aas?: string[];
  substitution_pairs?: [string, string][];
  indel_present?: boolean;
  sources?: ('structural' | 'literature')[];
  uniprot_ids?: string[];
  species_names?: string[];
  species_tax_ids?: number[];
  position_range?: [number, number];
  positions?: number[];
  co_occurs_with_mod_type?: string[];
  phenotype_contains?: string[];
}

export interface ModificationFilterSpec {
  kind: 'modifications';
  family: Family;
  modification_types?: string[];
  uniprot_ids?: string[];
  species_tax_ids?: number[];
  species_names?: string[];
  position_range?: [number, number];
  positions?: number[];
  co_occurs_with_variant?: boolean;
  evidence_source?: string[];
  phenotype_contains?: string[];
}

export interface BindingContactFilterSpec {
  kind: 'binding_contacts';
  family: Family;
  chemical_ids: string[];
  structure_ids?: string[];
  positions?: number[];
}

export type FilterSpec =
  | VariantFilterSpec
  | ModificationFilterSpec
  | BindingContactFilterSpec;

// ============================================================
// PaintSpec
// ============================================================

export type PaintSpec =
  | { kind: 'flat'; color: string }
  | { kind: 'byField'; field: string; palette: Record<string, string> };

// ============================================================
// Track + state
// ============================================================

export interface AnnotationTrack {
  id: string;        // hash of (family, filters, paint); stable for dedup
  label: string;
  family: Family;
  filters: FilterSpec;
  paint: PaintSpec;
  source: 'user' | 'ai';
}

export interface ResolvedPosition {
  master_index: number;
  match_count: number;
  matched_records: Record<string, any>[];
}

export interface TrackVisibility {
  /** Eye-toggle: row exists either way; this gates whether cells paint. */
  visible: boolean;
}

export interface TrackEntry {
  spec: AnnotationTrack;
  resolved: ResolvedPosition[] | null;  // null = not yet resolved
  isLoading: boolean;
  error: string | null;
  visibility: TrackVisibility;
}

interface AnnotationTracksState {
  tracks: Record<string, TrackEntry>;
  order: string[];  // display order in the aux panel
}

const initialState: AnnotationTracksState = {
  tracks: {},
  order: [],
};

// ============================================================
// Track ID hashing — stable across same (family, filters, paint)
// ============================================================

/** Sort object keys recursively so JSON.stringify is deterministic. */
function canonicalize(v: any): any {
  if (Array.isArray(v)) return v.map(canonicalize);
  if (v && typeof v === 'object') {
    const out: Record<string, any> = {};
    for (const k of Object.keys(v).sort()) out[k] = canonicalize(v[k]);
    return out;
  }
  return v;
}

/** djb2-style string hash, returns base36. */
function hashString(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export function trackIdFor(
  family: Family,
  filters: FilterSpec,
  paint: PaintSpec,
): string {
  return 'track_' + hashString(JSON.stringify(canonicalize({ family, filters, paint })));
}

// ============================================================
// Slice
// ============================================================

export const annotationTracksSlice = createSlice({
  name: 'annotationTracks',
  initialState,
  reducers: {
    /** Add a new track. Idempotent on (family, filters, paint) — same inputs
     *  update the existing track's label rather than creating a duplicate.
     *  source defaults to 'user'; LLM-dispatched tracks pass 'ai'. */
    addTrack: (
      state,
      action: PayloadAction<{
        label: string;
        family: Family;
        filters: FilterSpec;
        paint: PaintSpec;
        source?: 'user' | 'ai';
      }>,
    ) => {
      const { label, family, filters, paint, source = 'user' } = action.payload;
      const id = trackIdFor(family, filters, paint);
      if (state.tracks[id]) {
        state.tracks[id].spec.label = label;
        // Upgrade an existing user track to 'ai' provenance if re-dispatched
        // by AI (rare race); never downgrade ai->user without explicit intent.
        if (source === 'ai') state.tracks[id].spec.source = 'ai';
        return;
      }
      state.tracks[id] = {
        spec: { id, label, family, filters, paint, source },
        resolved: null,
        isLoading: false,
        error: null,
        visibility: { visible: true },
      };
      state.order.push(id);
    },

    setTrackLoading: (state, action: PayloadAction<string>) => {
      const t = state.tracks[action.payload];
      if (t) {
        t.isLoading = true;
        t.error = null;
      }
    },

    setTrackResolved: (
      state,
      action: PayloadAction<{ id: string; positions: ResolvedPosition[] }>,
    ) => {
      const t = state.tracks[action.payload.id];
      if (t) {
        t.resolved = action.payload.positions;
        t.isLoading = false;
        t.error = null;
      }
    },

    setTrackError: (state, action: PayloadAction<{ id: string; error: string }>) => {
      const t = state.tracks[action.payload.id];
      if (t) {
        t.isLoading = false;
        t.error = action.payload.error;
      }
    },

    toggleTrackVisibility: (state, action: PayloadAction<string>) => {
      const t = state.tracks[action.payload];
      if (t) t.visibility.visible = !t.visibility.visible;
    },

    removeTrack: (state, action: PayloadAction<string>) => {
      delete state.tracks[action.payload];
      state.order = state.order.filter(id => id !== action.payload);
    },

    clearAllTracks: () => initialState,
  },
});

export const {
  addTrack,
  setTrackLoading,
  setTrackResolved,
  setTrackError,
  toggleTrackVisibility,
  removeTrack,
  clearAllTracks,
} = annotationTracksSlice.actions;

// ============================================================
// Selectors (memoized — returning fresh arrays from a plain selector
// triggers React-Redux's "selector returned different result" warning
// and unnecessary re-renders downstream).
// ============================================================

const selectTracksMap = (state: RootState) => state.annotationTracks.tracks;
const selectTracksOrder = (state: RootState) => state.annotationTracks.order;

export const selectAllTracks = createSelector(
  [selectTracksMap, selectTracksOrder],
  (tracks, order): TrackEntry[] =>
    order.map(id => tracks[id]).filter(Boolean),
);

export const selectTrack = (state: RootState, id: string): TrackEntry | null =>
  state.annotationTracks.tracks[id] ?? null;

export const selectTracksByFamily = createSelector(
  [selectAllTracks, (_state: RootState, family: Family) => family],
  (allTracks, family): TrackEntry[] =>
    allTracks.filter(t => t.spec.family === family),
);

export default annotationTracksSlice.reducer;
