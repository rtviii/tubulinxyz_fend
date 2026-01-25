// src/app/structures/page.tsx
"use client";

import * as React from "react";
import { useState, useEffect, useMemo } from "react";
import { Eye } from "lucide-react";

import { useAppDispatch, useAppSelector } from "@/store/store";
import { useListStructuresQuery } from "@/store/tubxz_api";
import {
  set_structures_total_count,
  set_structures_next_cursor,
  selectStructureApiArgs,
} from "@/store/slices/slice_structures";

import { StructureFiltersComponent } from "./structure_filters";
import { getLigandColor } from "@/components/molstar/colors/tubulin-color-theme";

// --- Debounce Hook ---
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

// --- Structure Card ---
const StructureCard = ({ structure }: { structure: any }) => {
  const organism = structure.src_organism_names?.[0] || "Unknown";
  const imageUrl = `/output/${structure.rcsb_id}.png`;

  const formatOrganism = (name: string) => {
    if (!name || name === "Unknown") return { genus: "Unknown", species: "" };
    const parts = name.split(" ");
    return {
      genus: parts[0],
      species: parts.slice(1).join(" "),
    };
  };

  const { genus, species } = formatOrganism(organism);

  // We assume the API returns ligand summary for the structure. 
  // If not in the summary, we can use keywords or facets if available.
  const ligands = structure.ligands || [];

  return (
    <a href={`/structures/${structure.rcsb_id}`} className="group block h-full">
      <div className="w-full h-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-200 hover:shadow-lg hover:border-gray-300 flex flex-col">
        {/* Image Section */}
        <div className="relative h-48 bg-gradient-to-br from-gray-50 to-gray-100 overflow-hidden">
          <img
            src={imageUrl}
            alt={`Structure ${structure.rcsb_id}`}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.onerror = null;
              target.src = `https://placehold.co/400x300/f8fafc/94a3b8?text=${structure.rcsb_id}`;
            }}
          />
          <div className="absolute top-2 left-2 bg-black/75 text-white text-xs font-mono font-bold px-2 py-1 rounded">
            {structure.rcsb_id}
          </div>
          {structure.citation_year && (
            <div className="absolute top-2 right-2 bg-white/90 text-gray-700 text-xs font-medium px-2 py-1 rounded shadow-sm">
              {structure.citation_year}
            </div>
          )}

          {/* Ligand Pills Overlaying Image Bottom */}
          <div className="absolute bottom-2 left-2 flex flex-wrap gap-1 max-w-[90%]">
            {structure.top_ligands?.slice(0, 3).map((lig: any) => (
              <span
                key={lig.chemical_id}
                style={{ backgroundColor: getLigandColor(lig.chemical_id) }}
                className="text-[10px] font-bold text-white px-1.5 py-0.5 rounded shadow-sm uppercase"
              >
                {lig.chemical_id}
              </span>
            ))}
            {structure.ligand_count > 3 && (
              <span className="text-[10px] font-bold bg-white/80 text-gray-600 px-1.5 py-0.5 rounded shadow-sm">
                +{structure.ligand_count - 3}
              </span>
            )}
          </div>
        </div>

        {/* Content Section */}
        <div className="p-3 flex-grow flex flex-col">
          <p className="font-semibold text-gray-900 text-sm">
            <span className="italic">{genus}</span>
            {species && (
              <span className="italic text-gray-700"> {species}</span>
            )}
          </p>

          <p
            className="text-xs text-gray-500 line-clamp-2 mt-1 flex-grow"
            title={structure.citation_title}
          >
            {structure.citation_title || "No title available"}
          </p>

          <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <span className="truncate max-w-[55%]" title={structure.expMethod}>
              {structure.expMethod}
            </span>
            <span className="font-medium text-gray-700">
              {structure.resolution
                ? `${structure.resolution.toFixed(2)} Å`
                : "—"}
            </span>
          </div>

          {structure.polymerization_state && (
            <div className="mt-2">
              <span className="text-[10px] uppercase tracking-wide bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-semibold">
                {structure.polymerization_state}
              </span>
            </div>
          )}
        </div>
      </div>
    </a>
  );
};

export default function StructureCataloguePage() {
  const dispatch = useAppDispatch();
  const [visibleLimit, setVisibleLimit] = useState(100);

  const filters = useAppSelector((state) => state.structures_page.filters);
  const debouncedFilters = useDebounce(filters, 300);

  const apiArgs = useMemo(
    () => selectStructureApiArgs(debouncedFilters),
    [debouncedFilters]
  );

  const { data, isLoading, isError, refetch } =
    useListStructuresQuery(apiArgs);

  useEffect(() => {
    if (data) {
      dispatch(set_structures_total_count(data.total_count));
      dispatch(set_structures_next_cursor(data.next_cursor ?? null));
    }
  }, [data, dispatch]);

  const allStructures = data?.data ?? [];
  const displayedStructures = useMemo(
    () => allStructures.slice(0, visibleLimit),
    [allStructures, visibleLimit]
  );

  const handleLoadMore = () => setVisibleLimit((prev) => prev + 100);

  return (
    <div className="min-h-screen bg-gray-50/30">
      <div className="container mx-auto px-4 py-8 max-w-[1600px]">
        <div className="flex justify-between items-end mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2 tracking-tight">
              Tubulin Structures
            </h1>
          </div>
          {allStructures.length > 0 && (
            <span className="text-xs text-gray-500 font-medium bg-white px-3 py-1 rounded-full border">
              Showing {displayedStructures.length} of {data?.total_count ?? 0}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-3">
            <div className="sticky top-4">
              <StructureFiltersComponent update_state="structures" />
            </div>
          </div>

          <div className="lg:col-span-9">
            {isError ? (
              <div className="flex flex-col items-center justify-center h-64 text-red-600 bg-red-50 rounded-xl border border-red-200 shadow-sm">
                <p className="font-semibold text-lg">Error loading structures</p>
                <button
                  onClick={() => refetch()}
                  className="mt-3 px-4 py-2 bg-white border border-red-300 rounded-md text-sm font-medium hover:bg-red-50 transition-colors"
                >
                  Try Again
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                  {isLoading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="w-full h-80 bg-gray-100 animate-pulse rounded-xl" />
                    ))
                  ) : displayedStructures.length > 0 ? (
                    displayedStructures.map((structure) => (
                      <StructureCard
                        key={structure.rcsb_id}
                        structure={structure}
                      />
                    ))
                  ) : (
                    <div className="col-span-full flex flex-col items-center justify-center text-center text-gray-500 h-96 bg-white rounded-xl border-2 border-dashed border-gray-300">
                      <Eye className="h-16 w-16 mb-4 text-gray-400" />
                      <h3 className="text-2xl font-semibold text-gray-700">No Structures Found</h3>
                    </div>
                  )}
                </div>
                {allStructures.length > visibleLimit && (
                  <div className="mt-10 flex justify-center">
                    <button
                      onClick={handleLoadMore}
                      className="px-8 py-3 bg-white text-blue-600 border border-blue-200 font-semibold rounded-lg hover:bg-blue-50 transition-all"
                    >
                      Load More ({allStructures.length - visibleLimit} remaining)
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
