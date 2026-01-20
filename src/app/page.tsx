'use client'
import React, { useState, useMemo } from 'react';
import { Search, ChevronRight, Filter, X } from 'lucide-react';
import Link from 'next/link'; // Import next/link

// Define the type for a single structure based on the user's example
interface StructureData {
  identifier: string;
  data: {
    rcsb_id: string;
    struct?: {
      title: string;
    };
    struct_keywords?: {
      pdbx_keywords: string;
    };
    polymer_entities?: Array<{
      rcsb_entity_source_organism?: Array<{
        ncbi_scientific_name?: string;
        rcsb_gene_name?: Array<{ value: string }>;
      }>;
    }>;
    nonpolymer_entities?: Array<{
      nonpolymer_comp: {
        chem_comp: {
          id: string;
        };
      };
    }>;
    // Attempt to get resolution
    rcsb_entry_info?: {
      resolution_combined?: Array<{ value: number }>;
    };
  };
  type: string;
}

// // Cast the imported data to our type
// const allStructures: StructureData[] = structuresData as StructureData[];

// --- Thumbnail Lists ---
const dimerThumbnails = ['/thumbnails/1JJF.png', '/thumbnails/6E7B.png'];
const oligomerThumbnail = '/thumbnails/5J2T.png';
const latticeThumbnail = '/thumbnails/5SYF.png';
const defaultThumbnails = [
  '/thumbnails/1JJF.png', 
  '/thumbnails/1SA0.png', 
  '/thumbnails/4O2B.png', 
  '/thumbnails/5J2T.png', 
  '/thumbnails/5SYF.png', 
  '/thumbnails/6E7B.png',
  '/thumbnails/6WVR.png'
];
// --- End Thumbnail Lists ---

// --- Helper functions for data extraction ---

const getPrimarySpecies = (structure: StructureData): string | null => {
  const polymerEntities = structure.data.polymer_entities;
  if (!polymerEntities) return null;
  // Find first entity with a scientific name
  for (const entity of polymerEntities) {
    const org = entity.rcsb_entity_source_organism?.[0]?.ncbi_scientific_name;
    if (org) return org;
  }
  return null;
};

const getPrimaryGene = (structure: StructureData): string | null => {
  const polymerEntities = structure.data.polymer_entities;
  if (!polymerEntities) return null;
  // Find first entity with a gene name
  for (const entity of polymerEntities) {
    const gene = entity.rcsb_entity_source_organism?.[0]?.rcsb_gene_name?.[0]?.value;
    if (gene) return gene;
  }
  return null;
};

const getPrimaryLigand = (structure: StructureData): string | null => {
  const nonPolymerEntities = structure.data.nonpolymer_entities;
  if (!nonPolymerEntities || nonPolymerEntities.length === 0) return null;
  
  // Filter out common ions or molecules
  const commonIgnored = ['MG', 'HOH', 'GOL', 'SO4', 'GDP', 'GTP', 'CA', 'NA', 'CL', 'ZN'];
  const ligand = nonPolymerEntities.find(
    e => !commonIgnored.includes(e.nonpolymer_comp.chem_comp.id)
  );
  
  return ligand?.nonpolymer_comp.chem_comp.id || null;
};

const getResolution = (structure: StructureData): string | null => {
    const res = structure.data.rcsb_entry_info?.resolution_combined?.[0]?.value;
    return res ? res.toFixed(1) : null;
}

// Deterministically get a "group" for an ID (0, 1, or 2)
// This allows us to stably show ~1/3rd of structures
const getDeterministicGroup = (id: string): number => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
      hash = (hash << 5) - hash + id.charCodeAt(i);
      hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash) % 3;
};

// Deterministically get an index for an array
const getDeterministicIndex = (id: string, arrayLength: number): number => {
  let hash = 0;
  if (id.length === 0) return 0;
  for (let i = 0; i < id.length; i++) {
      hash = (hash << 5) - hash + id.charCodeAt(i);
      hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash) % arrayLength;
};

// --- End Helper Functions ---


const HomePage = () => {
  const [selectedSupergroup, setSelectedSupergroup] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    species: 'all',
    isotype: [] as string[],
    hasLigand: 'all',
    hasPTM: 'all'
  });
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const itemsPerPage = 20;

  const supergroups = [
    {
      id: 'dimers',
      title: 'Monomers, Dimers', // Updated title
      count: '213 structures',
      description: 'Tubulin in its soluble, unpolymerized state. These structures reveal drug binding sites, nucleotide interactions, and the curved conformation of free αβ-dimers.',
      color: 'from-blue-50 to-blue-100 border-blue-200',
      imageUrl: '/thumbnails/6e7b.png'
    },
    {
      id: 'oligomers',
      title: 'Oligomers',
      count: '560 structures',
      description: 'Intermediate assembly states between free dimers and microtubules. These structures capture the dynamics of tubulin polymerization and depolymerization.',
      color: 'from-purple-50 to-purple-100 border-purple-200',
      imageUrl: '/thumbnails/4o2b.png'
    },
    {
      id: 'lattices',
      title: 'Microtubule Lattices',
      count: '139 structures',
      description: 'Tubulin within intact microtubule walls. These structures show the straight, polymerized conformation and lateral interactions between protofilaments.',
      color: 'from-emerald-50 to-emerald-100 border-emerald-200',
      imageUrl: '/thumbnails/5syf.png'
    }
  ];
  
  const hasActiveFilters = selectedSupergroup || 
    filters.species !== 'all' || 
    filters.isotype.length > 0 ||
    filters.hasLigand !== 'all' ||
    filters.hasPTM !== 'all';

  // Filter logic
  const displayedStructures = useMemo(() => {
    let filtered = []
    if (selectedSupergroup) {
      // We'll use group 0 for this example
      filtered = filtered.filter(s => getDeterministicGroup(s.identifier) === 0);
    }
    
    // TODO: Apply other filters (species, isotype, etc.) based on `filters` state
    // Example:
    // if (filters.species !== 'all') {
    //   filtered = filtered.filter(s => getPrimarySpecies(s)?.toLowerCase().includes(filters.species));
    // }
    // if (filters.isotype.length > 0) {
    //   filtered = filtered.filter(s => {
    //     const gene = getPrimaryGene(s);
    //     return gene && filters.isotype.includes(gene);
    //   });
    // }

    return filtered;

  }, [selectedSupergroup, filters]); // Re-filter when filters change

  // Get thumbnail URL based on supergroup selection
  const getThumbnailUrl = (pdbId: string, supergroup: string | null): string => {
    if (supergroup === 'dimers') {
      // Deterministically pick between 1JJF and 6E7B
      const index = getDeterministicIndex(pdbId, dimerThumbnails.length);
      return dimerThumbnails[index];
    }
    if (supergroup === 'oligomers') {
      return oligomerThumbnail;
    }
    if (supergroup === 'lattices') {
      return latticeThumbnail;
    }
    // Default: pick deterministically from the available thumbnails
    const index = getDeterministicIndex(pdbId, defaultThumbnails.length);
    return defaultThumbnails[index];
  };

  const structuresToRender = displayedStructures.slice(0, page * itemsPerPage);
  const totalResults = displayedStructures.length;
  const hasMore = structuresToRender.length < totalResults;

  const toggleIsotype = (isotype: string) => {
    setFilters(prev => ({
      ...prev,
      isotype: prev.isotype.includes(isotype)
        ? prev.isotype.filter(i => i !== isotype)
        : [...prev.isotype, isotype]
    }));
    setPage(1); // Reset page on filter change
  };

  const clearFilters = () => {
    setSelectedSupergroup(null);
    setFilters({
      species: 'all',
      isotype: [],
      hasLigand: 'all',
      hasPTM: 'all'
    });
    setPage(1); // Reset page
  };
  
  const handleSupergroupClick = (groupId: string) => {
    setSelectedSupergroup(groupId);
    setShowFilters(true);
    setPage(1); // Reset page
  };
  
  const handleFilterChange = (filterType: string, value: string) => {
    setFilters(prev => ({ ...prev, [filterType]: value }));
    setPage(1); // Reset page
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <div className="relative pt-16 pb-12 bg-gradient-to-b from-gray-50 to-white border-b">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h1 className="text-4xl font-light tracking-tight mb-3 text-gray-900 font-mono">
            tube.xyz
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto mb-8 font-light">
            An interactive interface for the atomic structure of the tubulin dimer and the microtubule lattice.
          </p>
          <div className="max-w-lg mx-auto relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="search"
              placeholder="Search structures, proteins, or ligands..."
              className="w-full pl-11 pr-4 py-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Supergroups */}
        {!selectedSupergroup && (
          <div className="mb-16">
            {/* <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-6 text-center">
              Browse by Assembly State
            </h2> */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {supergroups.map(group => (
                <button
                  key={group.id}
                  onClick={() => handleSupergroupClick(group.id)}
                  className={`group relative p-6 rounded-lg border-2 bg-gradient-to-br ${group.color} hover:shadow-lg transition-all text-left overflow-hidden`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-lg font-medium text-gray-900">{group.title}</h3>
                    <span className="text-xs font-mono px-2 py-1 bg-white/70 rounded z-10">
                      {group.count}
                    </span>
                  </div>
                  
                  {/* Updated visualization with <img> */}
                  <div className="w-full h-32 bg-white/50 rounded-lg mb-4 flex items-center justify-center border border-gray-200/50 relative overflow-hidden">
                    <img
                      src={group.imageUrl}
                      alt={`${group.title} thumbnail`}
                      className="absolute inset-0 w-full h-full object-cover transition-transform group-hover:scale-105"
                    />
                  </div>

                  <p className="text-sm text-gray-700 leading-relaxed mb-4">
                    {group.description}
                  </p>

                  <div className="flex items-center text-sm text-gray-600 group-hover:text-gray-900">
                    Explore structures
                    <ChevronRight className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Active Filters Bar */}
        {hasActiveFilters && (
          <div className="mb-6 flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium text-gray-600">Active filters:</span>
            {selectedSupergroup && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                {supergroups.find(g => g.id === selectedSupergroup)?.title}
                <button onClick={() => { setSelectedSupergroup(null); setPage(1); }} className="ml-1 hover:bg-blue-200 rounded-full p-0.5">
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {filters.species !== 'all' && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">
                {filters.species}
                <button onClick={() => handleFilterChange('species', 'all')} className="ml-1 hover:bg-purple-200 rounded-full p-0.5">
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {filters.isotype.map(iso => (
              <span key={iso} className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                {iso}
                <button onClick={() => toggleIsotype(iso)} className="ml-1 hover:bg-green-200 rounded-full p-0.5">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <button 
              onClick={clearFilters}
              className="ml-auto text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Clear all
            </button>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex flex-col md:flex-row gap-6">
          {/* Filters Sidebar */}
          {(showFilters || hasActiveFilters) && (
            <div className="w-full md:w-64 flex-shrink-0">
              <div className="sticky top-6 space-y-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    Refine Results
                  </h3>
                  <button 
                    onClick={() => setShowFilters(false)}
                    className="md:hidden text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Species Filter */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-700 uppercase tracking-wide">
                    Species
                  </label>
                  <select 
                    value={filters.species}
                    onChange={(e) => handleFilterChange('species', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400/50"
                  >
                    <option value="all">All species</option>
                    <option value="human">Human</option>
                    <option value="bovine">Bovine</option>
                    <option value="yeast">Yeast</option>
                    <option value="pig">Pig</option>
                  </select>
                </div>

                {/* Isotype Filter */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-700 uppercase tracking-wide">
                    Isotype
                  </label>
                  <div className="space-y-1">
                    {['TUBA1A', 'TUBA1B', 'TUBB3', 'TUBB4B'].map(isotype => (
                      <label key={isotype} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={filters.isotype.includes(isotype)}
                          onChange={() => toggleIsotype(isotype)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="font-mono text-xs">{isotype}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Ligand Filter */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-700 uppercase tracking-wide">
                    Ligand Presence
                  </label>
                  <select 
                    value={filters.hasLigand}
                    onChange={(e) => handleFilterChange('hasLigand', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400/50"
                  >
                    <option value="all">All structures</option>
                    <option value="yes">With ligand</option>
                    <option value="no">Without ligand</option>
                  </select>
                </div>

                {/* PTM Filter */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-700 uppercase tracking-wide">
                    Post-translational Modifications
                  </label>
                  <select 
                    value={filters.hasPTM}
                    onChange={(e) => handleFilterChange('hasPTM', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400/5Music"
                  >
                    <option value="all">All structures</option>
                    <option value="yes">With PTMs</option>
                    <option value="no">Without PTMs</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Structure Grid */}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-medium text-gray-700">
                {hasActiveFilters ? 'Filtered Structures' : 'All Structures'}
                <span className="ml-2 text-gray-400">({totalResults} results)</span>
              </h2>
              {!showFilters && !hasActiveFilters && (
                <button
                  onClick={() => setShowFilters(true)}
                  className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
                >
                  <Filter className="h-4 w-4" />
                  Show filters
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {/* Use real data: structuresToRender */}
              {structuresToRender.map(structure => {
                const title = structure.data.struct?.title || 'No title available';
                const pdbId = structure.data.rcsb_id;
                const species = getPrimarySpecies(structure);
                const gene = getPrimaryGene(structure);
                const ligand = getPrimaryLigand(structure);
                const resolution = getResolution(structure);
                const thumbnailUrl = getThumbnailUrl(pdbId, selectedSupergroup);

                return (
                  <Link
                    href={`/structures/${pdbId}`}
                    key={structure.identifier}
                    className="group border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg hover:border-gray-300 transition-all bg-white"
                  >
                    {/* Structure visualization */}
                    <div className="aspect-square bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center relative overflow-hidden">
                      <img
                        src={thumbnailUrl}
                        alt={`Thumbnail for ${pdbId}`}
                        className="absolute inset-0 w-full h-full object-cover transition-transform group-hover:scale-105 z-10"
                        onError={(e) => {
                          // Fallback: show placeholder
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none'; // Hide broken image
                          target.parentElement?.querySelector('.fallback-placeholder')?.classList.remove('hidden');
                        }}
                      />
                      {/* Fallback placeholder */}
                      <div className="fallback-placeholder hidden absolute inset-0 z-0">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(0,0,0,0.03)_1px,_transparent_1px)] bg-[length:20px_20px]"></div>
                        <div className="w-full h-full flex items-center justify-center text-6xl opacity-30">🧬</div>
                      </div>
                      
                      {ligand && (
                        <div className="absolute top-2 right-2 px-2 py-1 bg-emerald-500/80 backdrop-blur-sm text-white text-xs rounded font-mono z-10">
                          {ligand}
                        </div>
                      )}
                    </div>
                    
                    {/* Structure info */}
                    <div className="p-3">
                      <div className="flex items-start justify-between mb-2">
                        <span className="font-mono text-sm font-medium text-gray-900">
                          {pdbId}
                        </span>
                        {resolution && (
                          <span className="text-xs text-gray-500">
                            {resolution} Å
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 mb-2 line-clamp-2" title={title}>
                        {title}
                      </p>
                      <div className="flex gap-1 flex-wrap">
                        {gene && (
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded font-mono">
                            {gene}
                          </span>
                        )}
                        {species && (
                          <span className="px-2 py-0.5 bg-gray-50 text-gray-600 text-xs rounded line-clamp-1" title={species}>
                            {species}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>

            {/* Load more */}
            {hasMore && (
              <div className="mt-8 text-center">
                <button 
                  onClick={() => setPage(p => p + 1)}
                  className="px-6 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                >
                  Load more structures
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer (unchanged) */}
      <footer className="border-t mt-16 py-8 bg-gray-50/50">
        <div className="max-w-6xl mx-auto px-6 text-center text-gray-500 text-xs space-y-2">
          <p>Built with structural data from the Protein Data Bank</p>
          <div className="flex justify-center gap-4">
            <span>Institut Curie</span>
            <span>•</span>
            <span>Paul Scherrer Institute</span>
            <span>•</span>
            <span>RCSB PDB</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;

