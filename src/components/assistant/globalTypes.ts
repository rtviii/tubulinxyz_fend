// TypeScript mirror of the Python schema in
// `tubulinxyz/api/nl_translator/global_actions.py`. Keep manually in sync;
// the surface is small.

export type ActionKind =
  | 'open_catalogue'
  | 'open_structure'
  | 'open_expert'
  | 'inspect_ligand'
  | 'view_variants'
  | 'clarify';

export interface AlignedRef {
  rcsb_id: string;
  auth_asym_id: string;
}

export interface RangeRef {
  start: number;
  end: number;
}

export interface ActionCard {
  action: ActionKind;
  label: string;
  description?: string;

  // open_catalogue
  query_ref?: string;

  // open_structure / open_expert / inspect_ligand
  rcsb_id?: string;
  focus_chains?: string[];
  focus_ligands?: string[];

  // open_expert
  primary_chain?: string;
  aligned?: AlignedRef[];
  focus_range?: RangeRef;

  // inspect_ligand
  chemical_id?: string;
  suggested_chain?: string;

  // view_variants
  family?: string;
  position_min?: number;
  position_max?: number;
  variant_type?: string;

  // clarify
  question?: string;
}

export type QueryTarget = 'structures' | 'polymers' | 'ligands';

export interface QuerySpec {
  id: string;
  target: QueryTarget;
  filters_structures?: Record<string, unknown>;
  filters_polymers?: Record<string, unknown>;
  filters_ligands?: Record<string, unknown>;
}

export interface GlobalNLResponse {
  blurb: string;
  queries: QuerySpec[];
  cards: ActionCard[];
  validation: Record<string, { ok: boolean; reason?: string }>;
}

export interface NLGlobalResponseBody {
  kind: 'global' | 'clarify';
  response?: GlobalNLResponse;
  clarification?: string;
}
