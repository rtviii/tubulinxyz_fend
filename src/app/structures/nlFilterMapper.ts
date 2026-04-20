// Maps backend StructureFilters JSON (as returned by POST /nl_query/filters)
// into the UiFilters shape used by the structures catalogue page.
//
// Keep this in sync with the backend `StructureFilters` model in
// neo4j_tubxz/models.py and with `UiFilters` in ./StructureFiltersPanel.tsx.

import type { UiFilters } from "./StructureFiltersPanel";

// Backend field names (snake_case). Only listing the ones we map.
type BackendStructureFilters = {
  search?: string;
  rcsb_ids?: string[];
  resolution_min?: number;
  resolution_max?: number;
  year_min?: number;
  year_max?: number;
  exp_method?: string[];
  polymerization_state?: string[];
  source_organism_ids?: number[];
  host_organism_ids?: number[];
  has_ligand_ids?: string[];
  has_polymer_family?: string[];
  has_uniprot?: string[];
  has_isotype?: string[];
  has_variants?: boolean;
  variant_family?: string;
  variant_type?: string;
  variant_position_min?: number;
  variant_position_max?: number;
  variant_wild_type?: string;
  variant_observed?: string;
  variant_source?: string;
};

export function backendFiltersToUi(
  bf: BackendStructureFilters,
): Partial<UiFilters> {
  const out: Partial<UiFilters> = {};

  if (bf.search !== undefined) out.search = bf.search;
  if (bf.rcsb_ids?.length) out.ids = bf.rcsb_ids;
  if (bf.exp_method?.length) out.expMethod = bf.exp_method;
  if (bf.polymerization_state?.length) out.polyState = bf.polymerization_state;
  if (bf.has_polymer_family?.length) out.family = bf.has_polymer_family;
  if (bf.has_isotype?.length) out.isotype = bf.has_isotype;
  if (bf.has_ligand_ids?.length) out.ligands = bf.has_ligand_ids;
  if (bf.has_uniprot?.length) out.uniprot = bf.has_uniprot;
  if (bf.source_organism_ids?.length) out.sourceTaxa = bf.source_organism_ids;
  if (bf.host_organism_ids?.length) out.hostTaxa = bf.host_organism_ids;

  if (bf.resolution_min !== undefined) out.resMin = bf.resolution_min;
  if (bf.resolution_max !== undefined) out.resMax = bf.resolution_max;
  if (bf.year_min !== undefined) out.yearMin = bf.year_min;
  if (bf.year_max !== undefined) out.yearMax = bf.year_max;

  if (bf.has_variants !== undefined) out.hasVariants = bf.has_variants;
  if (bf.variant_family !== undefined) out.variantFamily = bf.variant_family;
  if (bf.variant_type !== undefined) out.variantType = bf.variant_type;
  if (bf.variant_position_min !== undefined) out.variantPosMin = bf.variant_position_min;
  if (bf.variant_position_max !== undefined) out.variantPosMax = bf.variant_position_max;
  if (bf.variant_wild_type !== undefined) out.variantWildType = bf.variant_wild_type;
  if (bf.variant_observed !== undefined) out.variantObserved = bf.variant_observed;
  if (bf.variant_source !== undefined) out.variantSource = bf.variant_source;

  return out;
}

export type NLQueryResponse = {
  target?: "structures" | "polymers" | "ligands";
  filters?: BackendStructureFilters;
  summary: string;
  clarification?: string | null;
};
