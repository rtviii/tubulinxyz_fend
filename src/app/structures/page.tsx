'use client';

import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { Search, SlidersHorizontal, Eye, ChevronDown } from 'lucide-react';

// --- MOCK DATA ---
// Moved directly into the file to avoid path resolution issues.
const MOCKED_STRUCTURES = [
    {
        "pdbId": "4O2B",
        "title": "Crystal structure of T2R-TTL complex with Colchicine",
        "conformation": "curved",
        "organism": "Homo sapiens",
        "year": 2014,
        "resolution": 2.3,
        "expMethod": "X-RAY DIFFRACTION",
        "imageUrl": "https://cdn.rcsb.org/images/structures/2b/4o2b/4o2b_assembly-1.jpeg"
    },
    {
        "pdbId": "5J2T",
        "title": "Structure of two tubulin dimers in complex with vinblastine",
        "conformation": "curved",
        "organism": "Bos taurus",
        "year": 2016,
        "resolution": 2.4,
        "expMethod": "X-RAY DIFFRACTION",
        "imageUrl": "https://cdn.rcsb.org/images/structures/2t/5j2t/5j2t_assembly-1.jpeg"
    },
    {
        "pdbId": "5SYF",
        "title": "Structure of mammalian tubulin with paclitaxel",
        "conformation": "straight",
        "organism": "Sus scrofa",
        "year": 2016,
        "resolution": 5.5,
        "expMethod": "ELECTRON CRYSTALLOGRAPHY",
        "imageUrl": "https://cdn.rcsb.org/images/structures/yf/5syf/5syf_assembly-1.jpeg"
    },
    {
        "pdbId": "6WVR",
        "title": "Human alpha-1/beta-3 tubulin-DARPin D1 complex in a microtubule",
        "conformation": "straight",
        "organism": "Homo sapiens",
        "year": 2020,
        "resolution": 2.1,
        "expMethod": "ELECTRON MICROSCOPY",
        "imageUrl": "https://cdn.rcsb.org/images/structures/vr/6wvr/6wvr_assembly-1.jpeg"
    },
    {
        "pdbId": "1SA0",
        "title": "Tubulin-colchicine complex",
        "conformation": "curved",
        "organism": "Bos taurus",
        "year": 2004,
        "resolution": 3.58,
        "expMethod": "ELECTRON CRYSTALLOGRAPHY",
        "imageUrl": "https://cdn.rcsb.org/images/structures/a0/1sa0/1sa0_assembly-1.jpeg"
    }
];


// Define the type for a single structure
type TubulinStructure = {
    pdbId: string;
    title: string;
    conformation: 'curved' | 'straight';
    organism: string;
    year: number;
    resolution: number;
    expMethod: string;
    imageUrl: string;
};

// --- Placeholder Card Component ---
const PlaceholderCard = ({ pdbId }: { pdbId: string }) => {
    return (
        <div className="group block h-full">
            <div className="w-full h-full bg-gray-100 rounded-lg shadow-inner border border-gray-200 flex flex-col animate-pulse">
                <div className="relative h-40 bg-gray-200">
                    <div className="absolute top-2 left-2 bg-gray-300 text-transparent text-xs font-mono px-2 py-1 rounded select-none">
                        {pdbId}
                    </div>
                </div>
                <div className="p-4 flex-grow flex flex-col justify-between">
                    <div>
                        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded w-full mb-1"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                    <div className="mt-3 flex justify-between items-center">
                        <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                    </div>
                </div>
            </div>
        </div>
    );
};


// --- Structure Card Component ---
const StructureCard = ({ structure }: { structure: TubulinStructure }) => {
    // Using a regular <a> tag instead of Next's <Link> to avoid build issues in this environment
    return (
        <a href={`/structures/${structure.pdbId}`} className="group block h-full">
            <div className="w-full h-full bg-white rounded-lg shadow-md overflow-hidden transform transition-all duration-300 hover:shadow-xl hover:-translate-y-1 border border-gray-200 flex flex-col">
                <div className="relative h-40 bg-gray-100">
                    <img
                        src={structure.imageUrl}
                        alt={`Image of ${structure.pdbId}`}
                        className="w-full h-full object-cover"
                        // Simple fallback in case the image fails
                        onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.onerror = null; // prevent infinite loop
                            target.src = `https://placehold.co/600x400/e5e7eb/9ca3af?text=Image+Not+Found`;
                        }}
                    />
                    <div className="absolute top-2 left-2 bg-black/50 text-white text-xs font-mono px-2 py-1 rounded">
                        {structure.pdbId}
                    </div>
                    <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                        {structure.year}
                    </div>
                </div>
                <div className="p-4 flex-grow flex flex-col justify-between">
                    <div>
                        <p className="text-sm font-semibold text-blue-600 truncate">{structure.organism}</p>
                        <p className="text-xs text-gray-700 mt-1 h-8 line-clamp-2">{structure.title}</p>
                    </div>
                    <div className="mt-3 flex justify-between items-center text-xs text-gray-500">
                        <span>{structure.expMethod}</span>
                        <span>{structure.resolution} Å</span>
                    </div>
                </div>
            </div>
        </a>
    );
};


// --- Filters Panel Component ---
type ConformationFilter = 'all' | 'curved' | 'straight';

const FiltersPanel = ({
    activeFilter,
    onFilterChange,
    totalCount
}: {
    activeFilter: ConformationFilter;
    onFilterChange: (filter: ConformationFilter) => void;
    totalCount: number;
}) => {
    return (
        <div className="w-full bg-gray-50 p-4 rounded-lg border border-gray-200">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-800">Filters</h2>
                <span className="text-sm font-mono text-gray-500 bg-gray-200 px-2 py-1 rounded-md">{totalCount} structures</span>
            </div>

            {/* --- Working Conformation Filter --- */}
            <div className="space-y-2 mb-6">
                <label className="text-sm font-medium text-gray-700 block">Conformation</label>
                <div className="flex bg-gray-200 rounded-md p-1">
                    {(['all', 'curved', 'straight'] as ConformationFilter[]).map((filter) => (
                        <button
                            key={filter}
                            onClick={() => onFilterChange(filter)}
                            className={`w-1/3 py-1 text-sm rounded-md capitalize transition-colors duration-200 ${activeFilter === filter
                                    ? 'bg-white text-blue-600 shadow-sm'
                                    : 'bg-transparent text-gray-600 hover:bg-gray-300/50'
                                }`}
                        >
                            {filter}
                        </button>
                    ))}
                </div>
            </div>

            {/* --- Mocked Filters UI --- */}
            <div className="space-y-4 opacity-50 cursor-not-allowed">
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Search</label>
                    <div className="relative">
                        <input type="text" placeholder="PDB ID, Organism..." disabled className="w-full p-2 pl-8 border rounded-md text-sm" />
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    </div>
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Deposition Year</label>
                    <div className="flex items-center gap-2">
                        <input type="number" placeholder="Start" disabled className="w-full p-2 border rounded-md text-sm" />
                        <span>-</span>
                        <input type="number" placeholder="End" disabled className="w-full p-2 border rounded-md text-sm" />
                    </div>
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Resolution (Å)</label>
                    <div className="flex items-center gap-2">
                        <input type="number" placeholder="Min" disabled className="w-full p-2 border rounded-md text-sm" />
                        <span>-</span>
                        <input type="number" placeholder="Max" disabled className="w-full p-2 border rounded-md text-sm" />
                    </div>
                </div>
                {/* --- NEW MOCKED FILTERS --- */}
                <div className="space-y-2 pt-2 border-t">
                    <label className="text-sm font-medium text-gray-700">Ligands Present</label>
                    <div className="relative">
                        <select disabled className="w-full appearance-none p-2 border rounded-md text-sm text-gray-500">
                            <option>Select ligand...</option>
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    </div>
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Family</label>
                    <div className="relative">
                        <select disabled className="w-full appearance-none p-2 border rounded-md text-sm text-gray-500">
                            <option>Select family...</option>
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    </div>
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Isotype</label>
                    <div className="relative">
                        <input type="text" placeholder="e.g., Alpha-1B, Beta-3" disabled className="w-full p-2 border rounded-md text-sm" />
                    </div>
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Modifications / Mutations</label>
                    <div className="relative">
                        <select disabled className="w-full appearance-none p-2 border rounded-md text-sm text-gray-500">
                            <option>Any</option>
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Main Page Component ---
const StructureCatalogueContent = () => {
    const [conformationFilter, setConformationFilter] = useState<ConformationFilter>('all');

    // Replaced useSearchParams with a client-side effect to read URL params
    useEffect(() => {
        // Ensure this code only runs on the client
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const initialConformation = params.get('conformation');
            if (initialConformation === 'curved' || initialConformation === 'straight') {
                setConformationFilter(initialConformation);
            }
        }
    }, []); // Empty dependency array ensures this runs once on mount

    const filteredStructures = useMemo(() => {
        if (conformationFilter === 'all') {
            return MOCKED_STRUCTURES;
        }
        return MOCKED_STRUCTURES.filter(
            (structure) => structure.conformation === conformationFilter
        );
    }, [conformationFilter]);

    const placeholderCards = Array.from({ length: 20 }, (_, i) => ({ pdbId: `XXX${i + 1}` }));

    return (
        <div className="min-h-screen bg-white">
            <div className="container mx-auto px-4 py-8 max-w-7xl">
                <h1 className="text-4xl font-bold text-gray-800 mb-2">Tubulin Structures</h1>
                <p className="text-gray-600 mb-8">Browse and filter known atomic models of tubulin dimers and lattices.</p>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                    {/* Left Column: Filters */}
                    <div className="md:col-span-3">
                        <div className="sticky top-8">
                            <FiltersPanel
                                activeFilter={conformationFilter}
                                onFilterChange={setConformationFilter}
                                totalCount={MOCKED_STRUCTURES.length}
                            />
                        </div>
                    </div>

                    {/* Right Column: Structure Grid */}
                    <div className="md:col-span-9">
                        {filteredStructures.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {filteredStructures.map((structure) => (
                                    <StructureCard key={structure.pdbId} structure={structure as TubulinStructure} />
                                ))}
                                {placeholderCards.map((p) => (
                                    <PlaceholderCard key={p.pdbId} pdbId={p.pdbId} />
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center text-center text-gray-500 h-96 bg-gray-50 rounded-lg">
                                <Eye className="h-12 w-12 mb-4 text-gray-400" />
                                <h3 className="text-xl font-semibold">No Structures Found</h3>
                                <p>No structures match the current filter criteria.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};


export default function StructureCataloguePage() {
    return <StructureCatalogueContent />;
}


