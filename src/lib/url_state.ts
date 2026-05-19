// Bidirectional (de)serialization between URL search params and app state.
//
// Param names mirror `UiFilters` keys (camelCase) and the existing
// `ListStructuresApiArg` field names so the mapping stays mechanical and
// matches what the backend already understands.
//
// Used by the catalogue page (/structures) and the structure detail page
// (/structures/[rcsb_id]) for deep-linking. Also consumed by the LLM
// action-card layer to construct routable URLs from EntityRefs.

import type { UiFilters } from "@/app/structures/StructureFiltersPanel";

// Accept anything with a URLSearchParams-shaped `.get`. Next's
// `ReadonlyURLSearchParams` (from useSearchParams) and the standard
// `URLSearchParams` both satisfy this.
type SearchParamsLike = { get(name: string): string | null };

// ────────────────────────────────────────────────────────────────────────────
// Catalogue filters (/structures)
// ────────────────────────────────────────────────────────────────────────────

const STRING_LIST_KEYS = [
  "ids", "expMethod", "polyState", "family", "isotype", "ligands", "uniprot",
] as const;

const NUMBER_LIST_KEYS = ["sourceTaxa", "hostTaxa"] as const;

const NUMBER_KEYS = [
  "resMin", "resMax", "yearMin", "yearMax", "variantPosMin", "variantPosMax",
] as const;

const STRING_KEYS = [
  "search", "variantFamily", "variantType", "variantWildType",
  "variantObserved", "variantSource",
] as const;

const BOOLEAN_KEYS = ["hasVariants"] as const;

export function uiFiltersToSearchParams(filters: Partial<UiFilters>): URLSearchParams {
  const sp = new URLSearchParams();
  for (const k of STRING_KEYS) {
    const v = filters[k];
    if (typeof v === "string" && v) sp.set(k, v);
  }
  for (const k of NUMBER_KEYS) {
    const v = filters[k];
    if (typeof v === "number" && Number.isFinite(v)) sp.set(k, String(v));
  }
  for (const k of BOOLEAN_KEYS) {
    const v = filters[k];
    if (typeof v === "boolean") sp.set(k, v ? "true" : "false");
  }
  for (const k of STRING_LIST_KEYS) {
    const v = filters[k] as string[] | undefined;
    if (v && v.length) sp.set(k, v.join(","));
  }
  for (const k of NUMBER_LIST_KEYS) {
    const v = filters[k] as number[] | undefined;
    if (v && v.length) sp.set(k, v.map(String).join(","));
  }
  return sp;
}

export function searchParamsToUiFilters(
  sp: SearchParamsLike | null,
): Partial<UiFilters> {
  if (!sp) return {};
  const out: any = {};

  for (const k of STRING_KEYS) {
    const v = sp.get(k);
    if (v !== null && v !== "") out[k] = v;
  }
  for (const k of NUMBER_KEYS) {
    const v = sp.get(k);
    if (v !== null && v !== "") {
      const n = Number(v);
      if (Number.isFinite(n)) out[k] = n;
    }
  }
  for (const k of BOOLEAN_KEYS) {
    const v = sp.get(k);
    if (v === "true") out[k] = true;
    else if (v === "false") out[k] = false;
  }
  for (const k of STRING_LIST_KEYS) {
    const v = sp.get(k);
    if (v) out[k] = v.split(",").map((s) => s.trim()).filter(Boolean);
  }
  for (const k of NUMBER_LIST_KEYS) {
    const v = sp.get(k);
    if (v) {
      out[k] = v.split(",").map((s) => Number(s.trim())).filter(Number.isFinite);
    }
  }
  return out as Partial<UiFilters>;
}

export function buildCatalogueUrl(filters: Partial<UiFilters>): string {
  const sp = uiFiltersToSearchParams(filters);
  const qs = sp.toString();
  return qs ? `/structures?${qs}` : "/structures";
}

// ────────────────────────────────────────────────────────────────────────────
// Structure detail (/structures/[rcsb_id])
// ────────────────────────────────────────────────────────────────────────────

export type ViewMode = "structure" | "monomer";

export type AlignedChainRef = {
  pdbId: string;
  authAsymId: string;
};

export type StructureViewParams = {
  mode?: ViewMode;
  chain?: string;
  align?: AlignedChainRef[];
  range?: { start: number; end: number };
  focusLigand?: string;
};

export function structureViewParamsToSearchParams(
  p: StructureViewParams,
): URLSearchParams {
  const sp = new URLSearchParams();
  if (p.mode === "monomer") sp.set("mode", "monomer");
  if (p.chain) sp.set("chain", p.chain);
  if (p.align && p.align.length) {
    sp.set("align", p.align.map((a) => `${a.pdbId}:${a.authAsymId}`).join(","));
  }
  if (p.range) sp.set("range", `${p.range.start}-${p.range.end}`);
  if (p.focusLigand) sp.set("focus_ligand", p.focusLigand);
  return sp;
}

export function searchParamsToStructureView(
  sp: SearchParamsLike | null,
): StructureViewParams {
  if (!sp) return {};
  const out: StructureViewParams = {};

  const mode = sp.get("mode");
  if (mode === "monomer" || mode === "structure") out.mode = mode;

  const chain = sp.get("chain");
  if (chain) out.chain = chain;

  const align = sp.get("align");
  if (align) {
    const refs = align
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        const [pdbId, authAsymId] = s.split(":");
        return pdbId && authAsymId
          ? { pdbId: pdbId.toUpperCase(), authAsymId }
          : null;
      })
      .filter((x): x is AlignedChainRef => x !== null);
    if (refs.length) out.align = refs;
  }

  const range = sp.get("range");
  if (range) {
    const m = range.match(/^(\d+)-(\d+)$/);
    if (m) {
      const start = Number(m[1]);
      const end = Number(m[2]);
      if (Number.isFinite(start) && Number.isFinite(end) && start <= end) {
        out.range = { start, end };
      }
    }
  }

  const focusLigand = sp.get("focus_ligand");
  if (focusLigand) out.focusLigand = focusLigand;

  return out;
}

export function buildStructureUrl(
  rcsbId: string,
  p: StructureViewParams = {},
): string {
  const sp = structureViewParamsToSearchParams(p);
  const qs = sp.toString();
  const id = rcsbId.toUpperCase();
  return qs ? `/structures/${id}?${qs}` : `/structures/${id}`;
}
