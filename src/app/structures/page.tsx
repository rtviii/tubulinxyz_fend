"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, Mail } from "lucide-react";
import {
  AppPill,
  PillDivider,
  PillSection,
  PillAnchor,
  PillChatInput,
} from "@/components/ui/AppPill";
import { GlobalNav } from "@/components/ui/GlobalNav";
import {
  useGetStructureFacetsQuery,
  useGetTaxonomyTreeQuery,
  useListStructuresQuery,
  type ListStructuresApiArg,
  type StructureSummary,
} from "@/store/tubxz_api";

import { StructureFiltersPanel, type UiFilters } from "./StructureFiltersPanel";
import { API_BASE_URL } from "@/config";
import { StructureCard, type LigandLookup } from "@/components/structures/StructureCard";
import {
  AssistantTargetProvider,
  type AssistantTargetValue,
} from "@/components/assistant/AssistantTargetContext";
import { backendFiltersToUi, humanizeUiFilters, type NLQueryResponse } from "./nlFilterMapper";
import {
  buildCatalogueUrl,
  searchParamsToUiFilters,
} from "@/lib/url_state";

const EMPTY_FILTERS: UiFilters = {
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
  hasAnyMap: undefined,
  hasVariants: undefined,
  variantFamily: undefined,
  variantType: undefined,
  variantPosMin: undefined,
  variantPosMax: undefined,
  variantWildType: undefined,
  variantObserved: undefined,
  variantSource: undefined,
};

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

const DEFAULT_LIMIT = 100;

// ── Page ──

export default function StructureCataloguePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50/50" />}>
      <StructureCataloguePageInner />
    </Suspense>
  );
}

function StructureCataloguePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [cursor, setCursor] = useState<string | null>(null);
  const [items, setItems] = useState<StructureSummary[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);

  // Hydrate filters from URL on first render. URL is the source of truth on
  // mount; after that the page owns state and pushes updates back to URL.
  const [filters, setFilters] = useState<UiFilters>(() => ({
    ...EMPTY_FILTERS,
    ...searchParamsToUiFilters(searchParams),
  }));

  const [searchText, setSearchText] = useState(() => filters.search ?? "");
  const debouncedSearch = useDebouncedValue(searchText, 300);

  useEffect(() => {
    setFilters((prev) => ({ ...prev, search: debouncedSearch }));
  }, [debouncedSearch]);

  // URL writeback. Skip first render — we already hydrated from URL.
  const skipFirstWriteRef = useRef(true);
  useEffect(() => {
    if (skipFirstWriteRef.current) {
      skipFirstWriteRef.current = false;
      return;
    }
    router.replace(buildCatalogueUrl(filters), { scroll: false });
  }, [filters, router]);

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
      hasAnyMap: filters.hasAnyMap ?? null,
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

  const ligandLookup = useMemo((): LigandLookup => {
    const map: LigandLookup = {};
    for (const l of facets?.top_ligands ?? []) {
      if (l.chemical_name) map[l.chemical_id] = l.chemical_name;
    }
    return map;
  }, [facets]);

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
      hasAnyMap: undefined,
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

  // Overwrite the keys present in `parsed`; leave other filters untouched.
  // Also syncs the debounced search box if the translator set a search term.
  const applyNLFilters = (parsed: Partial<UiFilters>) => {
    setFilters((prev) => ({ ...prev, ...parsed }));
    if (parsed.search !== undefined) {
      setSearchText(parsed.search ?? "");
    }
    setCursor(null);
  };

  // ── Assistant target: wires the cross-page PillChatInput into /nl_query/filters ──
  const assistantValue = useMemo<AssistantTargetValue>(() => ({
    target: "filters",
    placeholder: "Ask about structures, ligands, mutations...",
    handle: async (text, signal) => {
      const resp = await fetch(`${API_BASE_URL}/nl_query/filters`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, target: "structures", current_filters: filters }),
        signal,
      });
      if (!resp.ok) {
        const body = await resp.text().catch(() => "");
        return { error: `HTTP ${resp.status}: ${body.slice(0, 200)}` };
      }
      const data = (await resp.json()) as NLQueryResponse;
      if (data.clarification) return { clarification: data.clarification };
      if (!data.filters) return { error: "No filters returned." };
      const parsed = backendFiltersToUi(data.filters);
      if (Object.keys(parsed).length === 0) {
        return { summary: data.summary || "No filter changes inferred." };
      }
      return {
        confirm: {
          summary: data.summary || "Apply these filters?",
          items: humanizeUiFilters(parsed),
          onApply: () => applyNLFilters(parsed),
        },
      };
    },
  }), [filters]);

  return (
    <AssistantTargetProvider value={assistantValue}>
    <div className="min-h-screen bg-gray-50/50">
      <div className="container mx-auto px-4 py-6 max-w-[1600px]">
        {/* Header */}
        <div className="flex justify-between items-end mb-5 gap-4">
          <div className="flex-shrink-0">
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">
              Tubulin Structures
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Browse tubulin-related PDB structures
            </p>
          </div>

          {/* Unified pill: nav | AI search placeholder | counter + feedback */}
          {/* `relative z-50` lifts the AppPill stacking context above the
              catalogue grid so the chat-input confirm panel isn't covered. */}
          <div className="relative z-50 flex-1 min-w-0 max-w-[720px]">
            <AppPill>
              <GlobalNav />

              <PillDivider />

              <PillSection stretch className="px-1">
                <PillChatInput
                  placeholder="Ask about structures, ligands, mutations..."
                  widthClass="flex-1 min-w-0"
                />
              </PillSection>

              <PillDivider />

              <div className="flex items-center gap-1.5 px-2 py-1">
                {isFetching && (
                  <span className="text-[9px] text-slate-400 uppercase tracking-wide">Updating</span>
                )}
                <span className="text-[11px] font-mono text-slate-500">
                  {items.length}
                  <span className="text-slate-300 mx-0.5">/</span>
                  {totalCount.toLocaleString()}
                </span>
              </div>

              <PillAnchor
                href="mailto:feedback@tube.xyz?subject=tube.xyz%20feedback"
                icon={Mail}
                title="Send feedback"
              />
            </AppPill>
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
                      <StructureCard key={structure.rcsb_id} structure={structure} ligandLookup={ligandLookup} />
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
    </AssistantTargetProvider>
  );
}
