// Types shared by the assistant chat UI and the page-provided dispatchers.
//
// Viewer action types mirror the Pydantic models in
// `tubulinxyz/api/nl_translator/viewer_actions.py`. Keep the two in sync
// manually — the surface is small (~10 action kinds), codegen is overkill
// for the MVP.

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
  | { type: 'ClearHighlight'; args: Record<string, never> };

export type ViewerActionType = ViewerAction['type'];

// ---------------------------------------------------------------------------
// Backend response envelopes
// ---------------------------------------------------------------------------

export interface ViewerResponseActions {
  kind: 'viewer_actions';
  actions: ViewerAction[];
  summary: string;
  clarification?: null;
}

export interface ViewerResponseClarify {
  kind: 'clarify';
  actions?: never;
  summary?: string;
  clarification: string;
}

export type ViewerResponse = ViewerResponseActions | ViewerResponseClarify;

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
