"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Eye, ArrowRight } from "lucide-react";
import {
  useGetStructureFacetsQuery,
  useGetTaxonomyTreeQuery,
  useListStructuresQuery,
  type ListStructuresApiArg,
  type StructureSummary,
} from "@/store/tubxz_api";

import { StructureFiltersPanel, type UiFilters } from "./StructureFiltersPanel";
import { API_BASE_URL } from "@/config";
import { LIGAND_IGNORE_IDS } from "@/components/molstar/colors/palette";

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

const DEFAULT_LIMIT = 100;

// ── Structure Card ──

const StructureCard = ({ structure }: { structure: StructureSummary }) => {
  const organism = structure.src_organism_names?.[0] || "Unknown";
  const imageUrl = `${API_BASE_URL}/structures/${structure.rcsb_id}/thumbnail`;

  const formatOrganism = (name: string) => {
    if (!name || name === "Unknown") return { genus: "Unknown", species: "" };
    const parts = name.split(" ");
    return { genus: parts[0], species: parts.slice(1).join(" ") };
  };
  const { genus, species } = formatOrganism(organism);

  const allLigandIds = structure.ligand_ids ?? [];
  const meaningfulLigands = allLigandIds.filter(id => !LIGAND_IGNORE_IDS.has(id));
  const authors = structure.citation_rcsb_authors ?? [];
  const authorLine = authors.length === 0 ? null
    : authors.length <= 2 ? authors.join(", ")
    : `${authors[0]} et al.`;

  return (
    <a href={`/structures/${structure.rcsb_id}`} className="group block h-full">
      <div className="w-full h-full bg-white rounded-lg border border-gray-200 overflow-hidden transition-all duration-200 hover:shadow-md hover:border-gray-300 flex flex-col">
        {/* Image */}
        <div className="relative h-48 bg-gradient-to-br from-gray-50 to-gray-100 overflow-hidden">
          <img
            src={imageUrl}
            alt={`Structure ${structure.rcsb_id}`}
            className="w-full h-full object-cover transition-all duration-300 group-hover:brightness-110 group-hover:blur-[1px]"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.onerror = null;
              target.src = `https://placehold.co/400x300/f8fafc/94a3b8?text=${structure.rcsb_id}`;
            }}
          />
          <div className="absolute top-2 left-2 bg-black/70 text-white text-[11px] font-mono font-bold px-2 py-0.5 rounded">
            {structure.rcsb_id}
          </div>
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <ArrowRight className="w-8 h-8 text-white/30" strokeWidth={1.5} />
          </div>
        </div>

        {/* Content */}
        <div className="p-3 flex-grow flex flex-col gap-1.5">
          <p className="text-[13px] leading-tight">
            <span className="italic font-medium text-gray-900">{genus}</span>
            {species && <span className="italic text-gray-500"> {species}</span>}
          </p>

          <p
            className="text-[11px] text-gray-400 line-clamp-2 leading-snug flex-grow"
            title={structure.citation_title || undefined}
          >
            {structure.citation_title || "No title available"}
          </p>

          {authorLine && (
            <p className="text-[9px] text-gray-300 truncate" title={authors.join(", ")}>
              {authorLine}
            </p>
          )}
        </div>

        {/* Bottom metadata */}
        <div className="px-3 pb-2.5 flex items-center gap-1.5 flex-wrap text-[9px] text-gray-400">
          {structure.citation_year && (
            <span className="bg-gray-50 px-1.5 py-0.5 rounded">{structure.citation_year}</span>
          )}
          {structure.resolution && (
            <span className="bg-gray-50 px-1.5 py-0.5 rounded">{structure.resolution.toFixed(1)} A</span>
          )}
          {structure.expMethod && (
            <span className="bg-gray-50 px-1.5 py-0.5 rounded truncate max-w-[80px]" title={structure.expMethod}>
              {structure.expMethod === "ELECTRON MICROSCOPY" ? "cryo-EM"
                : structure.expMethod === "X-RAY DIFFRACTION" ? "X-ray"
                : structure.expMethod}
            </span>
          )}
          {meaningfulLigands.length > 0 && (
            <Tooltip text={meaningfulLigands.join(", ")}>
              <span className="bg-emerald-50 text-emerald-500 px-1.5 py-0.5 rounded">
                {meaningfulLigands.length} lig
              </span>
            </Tooltip>
          )}
        </div>
      </div>
    </a>
  );
};

/** Tiny inline tooltip -- avoids importing antd Tooltip for this one use */
function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <span className="relative group/tip">
      {children}
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-1.5 py-0.5 bg-gray-800 text-white text-[8px] rounded whitespace-nowrap opacity-0 group-hover/tip:opacity-100 transition-opacity z-10">
        {text}
      </span>
    </span>
  );
}

// ── Page ──

export default function StructureCataloguePage() {
  const [cursor, setCursor] = useState<string | null>(null);
  const [items, setItems] = useState<StructureSummary[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);

  const [filters, setFilters] = useState<UiFilters>({
    search: "",
    ids: [],
    expMethod: [],
    polyState: [],
    family: [],
    isotype: [],
    ligands: [],
    uniprot: [],
    sourceTaxa: [],
    hostTaxa: [],
    resMin: undefined,
    resMax: undefined,
    yearMin: undefined,
    yearMax: undefined,
    hasVariants: undefined,
    variantFamily: undefined,
    variantType: undefined,
    variantPosMin: undefined,
    variantPosMax: undefined,
    variantWildType: undefined,
    variantObserved: undefined,
    variantSource: undefined,
  });

  const [searchText, setSearchText] = useState(filters.search ?? "");
  const debouncedSearch = useDebouncedValue(searchText, 300);

  useEffect(() => {
    setFilters((prev) => ({ ...prev, search: debouncedSearch }));
  }, [debouncedSearch]);

  const queryArgs: ListStructuresApiArg = useMemo(() => {
    return {
      cursor,
      limit: DEFAULT_LIMIT,
      search: filters.search?.trim() || null,
      ids: filters.ids.length ? filters.ids : null,
      expMethod: filters.expMethod.length ? filters.expMethod : null,
      polyState: filters.polyState.length ? filters.polyState : null,
      family: filters.family.length ? filters.family : null,
      isotype: filters.isotype.length ? filters.isotype : null,
      ligands: filters.ligands.length ? filters.ligands : null,
      uniprot: filters.uniprot.length ? filters.uniprot : null,
      resMin: filters.resMin ?? null,
      resMax: filters.resMax ?? null,
      yearMin: filters.yearMin ?? null,
      yearMax: filters.yearMax ?? null,
      sourceTaxa: filters.sourceTaxa.length ? filters.sourceTaxa.map(String) : null,
      hostTaxa: filters.hostTaxa.length ? filters.hostTaxa.map(String) : null,
      hasVariants: filters.hasVariants ?? null,
      variantFamily: filters.variantFamily ?? null,
      variantType: filters.variantType ?? null,
      variantPosMin: filters.variantPosMin ?? null,
      variantPosMax: filters.variantPosMax ?? null,
      variantWildType: filters.variantWildType ?? null,
      variantObserved: filters.variantObserved ?? null,
      variantSource: filters.variantSource ?? null,
    };
  }, [cursor, filters]);

  const filterSignature = useMemo(() => {
    const { cursor: _c, limit: _l, ...rest } = queryArgs;
    return JSON.stringify(rest);
  }, [queryArgs]);

  const { data: facets } = useGetStructureFacetsQuery();
  const { data: sourceTaxTree } = useGetTaxonomyTreeQuery({ taxType: "source" });
  const { data: hostTaxTree } = useGetTaxonomyTreeQuery({ taxType: "host" });

  const { data, isFetching, isLoading, isError, refetch } = useListStructuresQuery(queryArgs);

  const lastSigRef = useRef<string | null>(null);

  useEffect(() => {
    if (lastSigRef.current === null) {
      lastSigRef.current = filterSignature;
      return;
    }
    if (lastSigRef.current !== filterSignature) {
      lastSigRef.current = filterSignature;
      setCursor(null);
      setItems([]);
      setTotalCount(0);
    }
  }, [filterSignature]);

  useEffect(() => {
    if (!data?.data) return;
    setTotalCount(data.total_count ?? 0);
    setItems((prev) => {
      const incoming = data.data;
      if (cursor === null) {
        const seen = new Set<string>();
        const unique: StructureSummary[] = [];
        for (const s of incoming) {
          if (!seen.has(s.rcsb_id)) { seen.add(s.rcsb_id); unique.push(s); }
        }
        return unique;
      }
      const seen = new Set(prev.map((x) => x.rcsb_id));
      const merged = [...prev];
      for (const s of incoming) {
        if (!seen.has(s.rcsb_id)) { seen.add(s.rcsb_id); merged.push(s); }
      }
      return merged;
    });
  }, [data, cursor]);

  const hasMore = data?.has_more ?? false;
  const nextCursor = data?.next_cursor ?? null;

  const clearAll = () => {
    setSearchText("");
    setFilters({
      search: "", ids: [], expMethod: [], polyState: [], family: [], isotype: [],
      ligands: [], uniprot: [], sourceTaxa: [], hostTaxa: [],
      resMin: undefined, resMax: undefined, yearMin: undefined, yearMax: undefined,
      hasVariants: undefined, variantFamily: undefined, variantType: undefined,
      variantPosMin: undefined, variantPosMax: undefined, variantWildType: undefined,
      variantObserved: undefined, variantSource: undefined,
    });
    setCursor(null);
    // Don't manually clear items/totalCount -- let the data effect repopulate from the query
  };

  const updateFilter = <K extends keyof UiFilters>(key: K, value: UiFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="container mx-auto px-4 py-6 max-w-[1600px]">
        {/* Header */}
        <div className="flex justify-between items-end mb-5">
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">
              Tubulin Structures
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Browse tubulin-related PDB structures
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isFetching && (
              <span className="text-[10px] text-gray-400 uppercase tracking-wide">
                Updating...
              </span>
            )}
            <span className="text-xs text-gray-500 font-medium bg-white px-2.5 py-1 rounded border border-gray-200">
              {items.length} of {totalCount.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Sidebar */}
          <div className="lg:col-span-3">
            <div className="sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#e5e7eb transparent' }}>
              <StructureFiltersPanel
                filters={filters}
                facets={facets}
                sourceTaxTree={sourceTaxTree}
                hostTaxTree={hostTaxTree}
                totalCount={totalCount}
                searchText={searchText}
                onSearchTextChange={setSearchText}
                updateFilter={updateFilter}
                onClear={clearAll}
              />
            </div>
          </div>

          {/* Main content */}
          <div className="lg:col-span-9">
            {isError ? (
              <div className="flex flex-col items-center justify-center h-64 text-red-600 bg-red-50 rounded-lg border border-red-200">
                <p className="font-medium">Error loading structures</p>
                <button
                  onClick={() => refetch()}
                  className="mt-3 px-4 py-1.5 bg-white border border-red-300 rounded text-sm font-medium hover:bg-red-50 transition-colors"
                >
                  Try Again
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {isLoading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="w-full h-80 bg-gray-100 animate-pulse rounded-lg" />
                    ))
                  ) : items.length > 0 ? (
                    items.map((structure) => (
                      <StructureCard key={structure.rcsb_id} structure={structure} />
                    ))
                  ) : (
                    <div className="col-span-full flex flex-col items-center justify-center text-center text-gray-500 h-80 bg-white rounded-lg border-2 border-dashed border-gray-200">
                      <Eye className="h-12 w-12 mb-3 text-gray-300" />
                      <h3 className="text-lg font-medium text-gray-600">No Structures Found</h3>
                      <p className="text-sm text-gray-400 mt-1">Try adjusting your filters</p>
                    </div>
                  )}
                </div>

                {!isLoading && hasMore && nextCursor && (
                  <div className="mt-8 flex justify-center">
                    <button
                      onClick={() => setCursor(nextCursor)}
                      disabled={isFetching}
                      className="px-6 py-2 bg-white text-gray-700 border border-gray-300 font-medium rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors disabled:opacity-50 text-sm"
                    >
                      {isFetching ? "Loading..." : "Load More"}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
