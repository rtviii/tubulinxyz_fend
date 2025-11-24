'use client';

import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { Eye, Loader2, Download } from 'lucide-react';

// Redux & API
import { useAppDispatch, useAppSelector } from '@/store/store';
import { useListStructuresStructuresListPostMutation } from '@/store/tubxz_api';
import { set_structures_total_count, set_structures_next_cursor } from '@/store/slices/slice_structures';

// Components
import { StructureFiltersComponent } from './structure_filters';

// --- Types ---
type TubulinStructure = {
    rcsb_id: string;
    citation_title: string;
    polymerization_state?: string; 
    organism_name?: string; 
    src_organism_names: string[];
    citation_year: number;
    resolution: number;
    expMethod: string;
};

// --- Helper: Debounce Hook ---
function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);
    return debouncedValue;
}

// --- Structure Card Component ---
const StructureCard = ({ structure }: { structure: TubulinStructure }) => {
    const organism = structure.organism_name || structure.src_organism_names?.[0] || 'Unknown Organism';
    const imageUrl = `/output/${structure.rcsb_id}.png`;

    return (
        <a href={`/structures/${structure.rcsb_id}`} className="group block h-full">
            <div className="w-full h-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transform transition-all duration-300 hover:shadow-xl hover:-translate-y-1 flex flex-col">
                <div className="relative h-64 bg-gray-50 overflow-hidden border-b border-gray-100">
                    {/* Image with zoom and center crop effect - No Gradient Overlay */}
                    <img
                        src={imageUrl}
                        alt={`Structure ${structure.rcsb_id}`}
                        className="w-full h-full object-cover scale-[1.1] origin-center transition-transform duration-500 group-hover:scale-[1.15] bg-white mix-blend-multiply"
                        onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.onerror = null;
                            target.src = `https://placehold.co/600x400/f3f4f6/9ca3af?text=${structure.rcsb_id}+Image+Missing`;
                        }}
                    />
                    
                    {/* Labels - slightly adjusted for visibility on light backgrounds if needed, but kept clean */}
                    <div className="absolute top-3 left-3 bg-white/90 text-gray-800 text-xs font-bold font-mono px-2 py-1 rounded shadow-sm border border-gray-200/50 backdrop-blur-sm">
                        {structure.rcsb_id}
                    </div>
                    <div className="absolute bottom-3 right-3 bg-white/90 text-gray-800 text-xs font-bold px-2 py-1 rounded shadow-sm border border-gray-200/50 backdrop-blur-sm">
                        {structure.citation_year}
                    </div>
                </div>
                <div className="p-4 flex-grow flex flex-col justify-between bg-white">
                    <div>
                        <p className="text-base font-bold text-gray-900 truncate mb-1">{organism}</p>
                        <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed" title={structure.citation_title}>
                            {structure.citation_title || "No title available"}
                        </p>
                    </div>
                    <div className="mt-4 flex justify-between items-center text-xs font-medium text-gray-500 bg-gray-50 px-3 py-2 rounded-md border border-gray-100">
                        <span className="truncate max-w-[60%]" title={structure.expMethod}>{structure.expMethod}</span>
                        <span>{structure.resolution ? `${structure.resolution.toFixed(2)} Å` : 'N/A'}</span>
                    </div>
                </div>
            </div>
        </a>
    );
};

const PlaceholderCard = () => (
    <div className="group block h-full">
        <div className="w-full h-full bg-gray-50 rounded-xl border border-gray-200 flex flex-col animate-pulse shadow-sm">
            <div className="h-64 bg-gray-200 rounded-t-xl"></div>
            <div className="p-5 space-y-4">
                <div className="h-5 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-full"></div>
                <div className="flex justify-between pt-2">
                    <div className="h-8 bg-gray-200 rounded-lg w-1/3"></div>
                    <div className="h-8 bg-gray-200 rounded-lg w-1/4"></div>
                </div>
            </div>
        </div>
    </div>
);

// --- Main Page Component (Default Export) ---
export default function StructureCataloguePage() {
    const dispatch = useAppDispatch();
    const [visibleLimit, setVisibleLimit] = useState(100);

    const filters = useAppSelector((state) => state.structures_page.filters);
    const debouncedFilters = useDebounce(filters, 300);

    const [trigger, { data, isLoading, isError }] = useListStructuresStructuresListPostMutation();

    useEffect(() => {
        setVisibleLimit(100);
        trigger({ 
            structureFilterParams: { 
                ...debouncedFilters, 
                limit: 10000 
            } 
        });
    }, [debouncedFilters, trigger]);

    useEffect(() => {
        if (data) {
            dispatch(set_structures_total_count(data.total_count));
            dispatch(set_structures_next_cursor(data.next_cursor));
        }
    }, [data, dispatch]);

    const allStructures = (data?.structures as TubulinStructure[]) || [];
    const displayedStructures = useMemo(() => {
        return allStructures.slice(0, visibleLimit);
    }, [allStructures, visibleLimit]);

    const handleLoadMore = () => {
        setVisibleLimit((prev) => prev + 100);
    };

    return (
        <div className="min-h-screen bg-gray-50/30">
            <div className="container mx-auto px-4 py-8 max-w-[1600px]">
                <div className="flex justify-between items-end mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">Tubulin Structures</h1>
                        <p className="text-sm text-gray-600 max-w-2xl">Browse and filter known atomic models of tubulin dimers and lattices.</p>
                    </div>
                    {allStructures.length > 0 && (
                         <span className="text-xs text-gray-500 font-medium bg-white px-3 py-1 rounded-full border">
                            Showing {displayedStructures.length} of {allStructures.length}
                         </span>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    {/* Left Column: Narrower Filters (col-span-2) */}
                    <div className="md:col-span-2">
                        <div className="sticky top-4">
                            <StructureFiltersComponent update_state="structures" />
                        </div>
                    </div>

                    {/* Right Column: Wider Content (col-span-10) */}
                    <div className="md:col-span-10">
                        {isError ? (
                            <div className="flex flex-col items-center justify-center h-64 text-red-600 bg-red-50 rounded-xl border border-red-200 shadow-sm">
                                <p className="font-semibold text-lg">Error loading structures</p>
                                <button 
                                    onClick={() => trigger({ structureFilterParams: { ...debouncedFilters, limit: 10000 } })}
                                    className="mt-3 px-4 py-2 bg-white border border-red-300 rounded-md text-sm font-medium hover:bg-red-50 transition-colors"
                                >
                                    Try Again
                                </button>
                            </div>
                        ) : (
                            <>
                                {/* Tighter Grid for More Cards (xl:grid-cols-4) */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                                    {isLoading 
                                        ? Array.from({ length: 8 }).map((_, i) => <PlaceholderCard key={i} />)
                                        : displayedStructures.length > 0 ? (
                                            displayedStructures.map((structure) => (
                                                <StructureCard key={structure.rcsb_id} structure={structure} />
                                            ))
                                        ) : (
                                            <div className="col-span-full flex flex-col items-center justify-center text-center text-gray-500 h-96 bg-white rounded-xl border-2 border-dashed border-gray-300">
                                                <Eye className="h-16 w-16 mb-4 text-gray-400" />
                                                <h3 className="text-2xl font-semibold text-gray-700">No Structures Found</h3>
                                                <p className="max-w-md mt-3 text-gray-600">Try adjusting your filters or search terms.</p>
                                            </div>
                                        )
                                    }
                                </div>
                                {allStructures.length > visibleLimit && (
                                    <div className="mt-10 flex justify-center">
                                        <button onClick={handleLoadMore} className="px-8 py-3 bg-white text-blue-600 border border-blue-200 font-semibold rounded-lg hover:bg-blue-50 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
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
