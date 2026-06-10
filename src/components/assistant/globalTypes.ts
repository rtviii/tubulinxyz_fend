// TypeScript mirror of the Python schema in
// `tubulinxyz/api/nl_translator/global_actions.py`. Keep manually in sync;
// the surface is small.

// EntityRef matches the flat Pydantic shape. The discriminator is `kind`; the
// payload fields the backend interprets per kind. Frontend pill code reads
// only the fields relevant for the entity's kind.
export type EntityKind =
  | 'structure'
  | 'chain'
  | 'polymer_entity'
  | 'family'
  | 'ligand'
  | 'variant'
  | 'residue_range';

export interface EntityRef {
  kind: EntityKind;
  rcsb_id?: string;
  auth_asym_id?: string;
  entity_id?: string;
  chemical_id?: string;
  auth_seq_id?: number;
  family?: string;
  master_index?: number;
  wild_type?: string;
  observed?: string;
  start?: number;
  end?: number;
}

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

  // Server-assigned stable id (hash of the card's semantic key). Used as the
  // React key and the validation-map key, and to dedupe on render.
  id?: string;

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

  // view_variants (family also reused by open_catalogue)
  family?: string;
  position_min?: number;
  position_max?: number;
  variant_type?: string;

  // open_catalogue direct-filter shortcut (NCBI tax_ids)
  source_organism_ids?: number[];

  // DB-resolution selectors (open_structure / open_expert / inspect_ligand).
  // Backend resolves these to a real (rcsb_id, chain); also kept on the wire so
  // the client can name organisms (e.g. in the post-navigation toast).
  primary_organism_id?: number;
  aligned_organism_ids?: number[];

  // clarify
  question?: string;

  // Grounded viewer actions auto-applied on the destination page after the user
  // clicks this card and the view settles (precompute-on-landing / replay-on-arrival).
  // Stashed in the arrivalActions slice on click; replayed via dispatchViewerActions.
  // Typed locally (not ViewerActionCall) to avoid an import cycle: types.ts imports
  // from this module.
  arrival_actions?: Array<{ type: string; args: Record<string, unknown> }>;
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
