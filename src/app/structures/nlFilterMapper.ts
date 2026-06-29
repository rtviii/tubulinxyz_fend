// Maps backend StructureFilters JSON (as returned by POST /nl_query/filters)
// into the UiFilters shape used by the structures catalogue page.
//
// Keep this in sync with the backend `StructureFilters` model in
// neo4j_tubxz/models.py and with `UiFilters` in ./StructureFiltersPanel.tsx.

import type { UiFilters } from "./StructureFiltersPanel";
import type { AssistantConfirmItem } from "@/components/assistant/AssistantTargetContext";

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
  has_any_map?: boolean;
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

  if (bf.has_any_map !== undefined) out.hasAnyMap = bf.has_any_map;
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

// Helpers for the NL confirmation panel.

function joinList(xs: string[] | number[], cap = 5): string {
  const arr = (xs as Array<string | number>).map(String);
  if (arr.length <= cap) return arr.join(", ");
  return `${arr.slice(0, cap).join(", ")} +${arr.length - cap} more`;
}

function rangeStr(
  min: number | undefined,
  max: number | undefined,
  unit = "",
): string {
  if (min !== undefined && max !== undefined) return `${min}–${max}${unit}`;
  if (max !== undefined) return `≤ ${max}${unit}`;
  if (min !== undefined) return `≥ ${min}${unit}`;
  return "";
}

// Render a Partial<UiFilters> as a flat list of label/value rows for the
// confirm panel. One row per logical group (resolution/year are merged across
// min/max). Pure, no async lookups — organism / uniprot IDs are rendered as
// raw IDs since the LLM summary already carries human context.
export function humanizeUiFilters(parsed: Partial<UiFilters>): AssistantConfirmItem[] {
  const out: AssistantConfirmItem[] = [];

  if (parsed.search) out.push({ label: "Text search", value: parsed.search });
  if (parsed.ids?.length) out.push({ label: "PDB IDs", value: joinList(parsed.ids) });

  const resolution = rangeStr(parsed.resMin, parsed.resMax, " Å");
  if (resolution) out.push({ label: "Resolution", value: resolution });

  const year = rangeStr(parsed.yearMin, parsed.yearMax);
  if (year) out.push({ label: "Year", value: year });

  if (parsed.expMethod?.length) out.push({ label: "Exp method", value: joinList(parsed.expMethod) });
  if (parsed.polyState?.length) out.push({ label: "Polymerization", value: joinList(parsed.polyState) });
  if (parsed.family?.length) out.push({ label: "Family", value: joinList(parsed.family) });
  if (parsed.isotype?.length) out.push({ label: "Isotype", value: joinList(parsed.isotype) });
  if (parsed.ligands?.length) out.push({ label: "Has ligand", value: joinList(parsed.ligands) });
  if (parsed.uniprot?.length) out.push({ label: "UniProt", value: joinList(parsed.uniprot) });
  if (parsed.sourceTaxa?.length) out.push({ label: "Source organism IDs", value: joinList(parsed.sourceTaxa) });
  if (parsed.hostTaxa?.length) out.push({ label: "Host organism IDs", value: joinList(parsed.hostTaxa) });

  if (parsed.hasAnyMap) out.push({ label: "Contains MAP", value: "yes" });
  if (parsed.hasVariants !== undefined) {
    out.push({ label: "Has variants", value: parsed.hasVariants ? "yes" : "no" });
  }
  if (parsed.variantFamily) out.push({ label: "Variant family", value: parsed.variantFamily });
  if (parsed.variantType) out.push({ label: "Variant type", value: parsed.variantType });
  const variantPos = rangeStr(parsed.variantPosMin, parsed.variantPosMax);
  if (variantPos) out.push({ label: "Variant position", value: variantPos });
  if (parsed.variantWildType) out.push({ label: "Wild-type residue", value: parsed.variantWildType });
  if (parsed.variantObserved) out.push({ label: "Observed residue", value: parsed.variantObserved });
  if (parsed.variantSource) out.push({ label: "Variant source", value: parsed.variantSource });

  return out;
}
