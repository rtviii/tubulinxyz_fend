'use client'
import React, { useState } from 'react';
import { Search, ChevronRight, Filter, X } from 'lucide-react';

const HomePage = () => {
  const [selectedSupergroup, setSelectedSupergroup] = useState(null);
  const [filters, setFilters] = useState({
    species: 'all',
    isotype: [],
    hasLigand: 'all',
    hasPTM: 'all'
  });
  const [showFilters, setShowFilters] = useState(false);

  const supergroups = [
    {
      id: 'dimers',
      title: 'Single Dimers',
      count: '~4,028',
      description: 'Explore tubulin in its soluble, unpolymerized state. These structures reveal drug binding sites, nucleotide interactions, and the curved conformation of free αβ-dimers.',
      color: 'from-blue-50 to-blue-100 border-blue-200'
    },
    {
      id: 'oligomers',
      title: 'Oligomers',
      count: '~850',
      description: 'Intermediate assembly states between free dimers and microtubules. These structures capture the dynamics of tubulin polymerization and depolymerization.',
      color: 'from-purple-50 to-purple-100 border-purple-200'
    },
    {
      id: 'lattices',
      title: 'Microtubule Lattices',
      count: '~3,517',
      description: 'Analyze tubulin within intact microtubule walls. These structures show the straight, polymerized conformation and lateral interactions between protofilaments.',
      color: 'from-emerald-50 to-emerald-100 border-emerald-200'
    }
  ];

  // Mock structure data
  const mockStructures = Array.from({ length: 20 }, (_, i) => ({
    pdbId: `${i + 1}ABC`,
    title: `Tubulin structure ${i + 1}`,
    isotype: ['TUBA1A', 'TUBB3'][i % 2],
    species: 'Human',
    resolution: (2.1 + Math.random()).toFixed(1),
    hasLigand: i % 3 === 0,
    ligand: i % 3 === 0 ? 'Taxol' : null
  }));

  const hasActiveFilters = selectedSupergroup || 
    filters.species !== 'all' || 
    filters.isotype.length > 0 ||
    filters.hasLigand !== 'all' ||
    filters.hasPTM !== 'all';

  const displayCount = hasActiveFilters ? 12 : 20;

  const toggleIsotype = (isotype) => {
    setFilters(prev => ({
      ...prev,
      isotype: prev.isotype.includes(isotype)
        ? prev.isotype.filter(i => i !== isotype)
        : [...prev.isotype, isotype]
    }));
  };

  const clearFilters = () => {
    setSelectedSupergroup(null);
    setFilters({
      species: 'all',
      isotype: [],
      hasLigand: 'all',
      hasPTM: 'all'
    });
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <div className="relative pt-16 pb-12 bg-gradient-to-b from-gray-50 to-white border-b">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h1 className="text-4xl font-light tracking-tight mb-3 text-gray-900 font-mono">
            tubulin.xyz
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
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-6 text-center">
              Browse by Assembly State
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {supergroups.map(group => (
                <button
                  key={group.id}
                  onClick={() => {
                    setSelectedSupergroup(group.id);
                    setShowFilters(true);
                  }}
                  className={`group relative p-6 rounded-lg border-2 bg-gradient-to-br ${group.color} hover:shadow-lg transition-all text-left`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-lg font-medium text-gray-900">{group.title}</h3>
                    <span className="text-xs font-mono px-2 py-1 bg-white/70 rounded">
                      {group.count}
                    </span>
                  </div>
                  
                  {/* Placeholder visualization */}
                  <div className="w-full h-32 bg-white/50 rounded-lg mb-4 flex items-center justify-center border border-gray-200/50">
                    <div className="text-6xl opacity-20">🧬</div>
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
                <button onClick={() => setSelectedSupergroup(null)} className="ml-1 hover:bg-blue-200 rounded-full p-0.5">
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {filters.species !== 'all' && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">
                {filters.species}
                <button onClick={() => setFilters(prev => ({ ...prev, species: 'all' }))} className="ml-1 hover:bg-purple-200 rounded-full p-0.5">
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
        <div className="flex gap-6">
          {/* Filters Sidebar */}
          {(showFilters || hasActiveFilters) && (
            <div className="w-64 flex-shrink-0">
              <div className="sticky top-6 space-y-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    Refine Results
                  </h3>
                  <button 
                    onClick={() => setShowFilters(false)}
                    className="lg:hidden text-gray-400 hover:text-gray-600"
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
                    onChange={(e) => setFilters(prev => ({ ...prev, species: e.target.value }))}
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
                    onChange={(e) => setFilters(prev => ({ ...prev, hasLigand: e.target.value }))}
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
                    onChange={(e) => setFilters(prev => ({ ...prev, hasPTM: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400/50"
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
                {hasActiveFilters ? 'Filtered Structures' : 'Recent Structures'}
                <span className="ml-2 text-gray-400">({displayCount} results)</span>
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
              {mockStructures.slice(0, displayCount).map(structure => (
                <div
                  key={structure.pdbId}
                  className="group border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg hover:border-gray-300 transition-all cursor-pointer bg-white"
                >
                  {/* Structure visualization placeholder */}
                  <div className="aspect-square bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(0,0,0,0.03)_1px,_transparent_1px)] bg-[length:20px_20px]"></div>
                    <div className="text-6xl opacity-30">🧬</div>
                    {structure.hasLigand && (
                      <div className="absolute top-2 right-2 px-2 py-1 bg-emerald-500 text-white text-xs rounded">
                        {structure.ligand}
                      </div>
                    )}
                  </div>
                  
                  {/* Structure info */}
                  <div className="p-3">
                    <div className="flex items-start justify-between mb-2">
                      <span className="font-mono text-sm font-medium text-gray-900">
                        {structure.pdbId}
                      </span>
                      <span className="text-xs text-gray-500">
                        {structure.resolution} Å
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                      {structure.title}
                    </p>
                    <div className="flex gap-1 flex-wrap">
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded">
                        {structure.isotype}
                      </span>
                      <span className="px-2 py-0.5 bg-gray-50 text-gray-600 text-xs rounded">
                        {structure.species}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Load more */}
            {hasActiveFilters && displayCount < mockStructures.length && (
              <div className="mt-8 text-center">
                <button className="px-6 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors">
                  Load more structures
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
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