// Types shared by the assistant chat UI and the page-provided dispatchers.
//
// Viewer action types mirror the Pydantic models in
// `tubulinxyz/api/nl_translator/viewer_actions.py`. Keep the two in sync
// manually — the surface is small (~12 action kinds), codegen is overkill
// for the MVP.

import type { FilterSpec } from '@/store/slices/annotationTracksSlice';

export type { FilterSpec } from '@/store/slices/annotationTracksSlice';

// ---------------------------------------------------------------------------
// Viewer actions
// ---------------------------------------------------------------------------

export type ViewerAction =
  | { type: 'FocusChain'; args: { auth_asym_id: string } }
  | { type: 'FocusResidue'; args: { auth_asym_id: string; auth_seq_id: number } }
  | { type: 'FocusResidueRange'; args: { auth_asym_id: string; start: number; end: number } }
  | { type: 'ClearFocus'; args: Record<string, never> }
  | { type: 'SetChainVisibility'; args: { auth_asym_id: string; visible: boolean } }
  | { type: 'IsolateChain'; args: { auth_asym_id: string; keep_ligands: boolean } }
  | { type: 'HighlightChain'; args: { auth_asym_id: string } }
  | { type: 'HighlightResidueRange'; args: { auth_asym_id: string; start: number; end: number } }
  | { type: 'ClearHighlight'; args: Record<string, never> }
  // Add another organism's chain to the current expert-mode alignment. The
  // backend resolves organism_id -> a real (rcsb_id, auth_asym_id); the
  // dispatcher reads those two and runs the in-place align flow.
  | { type: 'AlignChain'; args: { rcsb_id: string; auth_asym_id: string; organism_id?: number | null; family?: string | null } }
  // Chain-independent MSA aux row, family-scoped, painted from a typed FilterSpec.
  // The dispatcher reads (label, spec, color) and dispatches addTrack with
  // source: 'ai' so the UI can badge it. Auto-resolved by useResolveTracks.
  | { type: 'AddAnnotationTrack'; args: { label: string; spec: FilterSpec; color: string; description?: string | null } }
  // Substring-matches against existing track labels (case-insensitive).
  | { type: 'RemoveAnnotationTrack'; args: { label_match: string } }
  // Focus 3D camera + draw binding-site representation for a named ligand on a
  // loaded chain. Reuses already-fetched per-chain contact data (no fetch).
  // auth_asym_id defaults to the active monomer chain when null/undefined.
  | { type: 'FocusBindingSite'; args: { chemical_id: string; auth_asym_id?: string | null } };

export type ViewerActionType = ViewerAction['type'];

// ---------------------------------------------------------------------------
// Backend response envelopes
// ---------------------------------------------------------------------------

import type { ActionCard, EntityRef } from './globalTypes';

export interface ViewerResponseActions {
  kind: 'viewer_actions';
  actions: ViewerAction[];
  // Entities surfaced via the MentionEntities tool; rendered as interactive
  // pills with bidirectional sync to molstar.
  entities?: EntityRef[];
  summary: string;
  clarification?: null;
}

export interface ViewerResponseClarify {
  kind: 'clarify';
  actions?: never;
  summary?: string;
  clarification: string;
  // Optional companion nav card — backend attaches when the LLM emits both
  // RequestClarification and EmitNavigationCard (e.g. "we can't do that
  // here, but here's a card to do it elsewhere").
  card?: ActionCard;
}

// Emitted via the EmitNavigationCard tool when the user's question is
// catalogue/navigation intent rather than an in-page operation.
export interface ViewerResponseNavCard {
  kind: 'nav_card';
  card: ActionCard;
  summary?: string;
  actions?: never;
}

export type ViewerResponse = ViewerResponseActions | ViewerResponseClarify | ViewerResponseNavCard;

// Filter response — mirrors the existing /nl_query/filters output, kept here
// only so the shared panel can discriminate without importing the filter
// module.
export interface FilterResponse {
  target?: 'structures' | 'polymers' | 'ligands';
  filters?: Record<string, unknown>;
  summary: string;
  clarification?: string;
}

// ---------------------------------------------------------------------------
// Dispatcher report — per-action execution status.
// ---------------------------------------------------------------------------

export interface ActionReport {
  action: ViewerAction;
  ok: boolean;
  error?: string;
}
