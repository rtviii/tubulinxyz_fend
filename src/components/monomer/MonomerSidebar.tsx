// src/components/monomer/MonomerSidebar.tsx
import { useState } from 'react';
import { 
  ArrowLeft, Plus, Eye, EyeOff, X, Search, 
  Dna, FlaskConical, Target, AlertCircle 
} from 'lucide-react';
import type { MolstarInstance } from '@/components/molstar/services/MolstarInstance';
import type { PolymerComponent, AlignedStructure } from '@/components/molstar/core/types';
import type { StructureProfile } from '@/components/structure/types'; // You might need to move this type to a shared file
import { AlignStructureForm } from './AlignStructureForm'; // Assuming you extract this too, or keep it local if preferred

interface Mutation {
  masterIndex: number;
  authSeqId: number | null;
  fromResidue: string;
  toResidue: string;
  phenotype: string | null;
}

interface LigandSite {
  id: string;
  ligandId: string;
  ligandName: string;
  ligandChain: string;
  ligandAuthSeqId: number;
  color: string;
}

interface MonomerSidebarProps {
  activeChainId: string | null;
  polymerComponents: PolymerComponent[];
  alignedStructures: AlignedStructure[];
  instance: MolstarInstance | null;
  pdbId: string | null;
  profile: StructureProfile | null;
  
  // Annotation Data
  ligandSites: LigandSite[];
  mutations: Mutation[];
  
  // Visibility State
  visibleLigandIds: Set<string>;
  showMutations: boolean;
  
  // Actions
  onToggleLigand: (siteId: string) => void;
  onFocusLigand: (siteId: string) => void;
  onToggleMutations: (enabled: boolean) => void;
  onFocusMutation: (masterIndex: number) => void; // New prop for focusing specific mutation
  onShowAllLigands: () => void;
  onHideAllLigands: () => void;
  onClearAll: () => void;
}

export function MonomerSidebar({
  activeChainId,
  polymerComponents,
  alignedStructures,
  instance,
  pdbId,
  profile,
  ligandSites,
  mutations,
  visibleLigandIds,
  showMutations,
  onToggleLigand,
  onFocusLigand,
  onToggleMutations,
  onFocusMutation,
  onShowAllLigands,
  onHideAllLigands,
  onClearAll,
}: MonomerSidebarProps) {
  const [showAlignForm, setShowAlignForm] = useState(false);
  const [mutationFilter, setMutationFilter] = useState('');

  const handleBack = () => instance?.exitMonomerView();
  const handleChainSwitch = (chainId: string) => {
    if (chainId !== activeChainId) instance?.switchMonomerChain(chainId);
  };

  const getFamilyForChain = (chainId: string) => {
    if (!profile) return undefined;
    const poly = profile.polypeptides.find(p => p.auth_asym_id === chainId);
    if (!poly) return undefined;
    return profile.entities[poly.entity_id]?.family;
  };

  const activeFamily = activeChainId ? getFamilyForChain(activeChainId) : undefined;

  // Filter mutations based on search
  const filteredMutations = mutations.filter(m => {
    const search = mutationFilter.toLowerCase();
    const code = `${m.fromResidue}${m.authSeqId || '?'}${m.toResidue}`.toLowerCase();
    const pheno = (m.phenotype || '').toLowerCase();
    return code.includes(search) || pheno.includes(search);
  });

  return (
    <div className="h-full bg-white border-r border-gray-200 flex flex-col overflow-hidden">
      {/* --- Header Section --- */}
      <div className="flex-shrink-0 p-4 border-b">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4 transition-colors"
        >
          <ArrowLeft size={16} />
          Back to structure
        </button>

        <h1 className="text-xl font-bold text-gray-900 mb-1">
          Chain {activeChainId}
        </h1>
        <div className="flex items-center gap-2 text-sm text-gray-500">
           <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">{pdbId}</span>
           {activeFamily && <span>• {activeFamily}</span>}
        </div>
      </div>

      {/* --- Scrollable Content --- */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        
        {/* Chain Switcher */}
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Switch Chain
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {polymerComponents.map(chain => (
              <button
                key={chain.chainId}
                onClick={() => handleChainSwitch(chain.chainId)}
                className={`px-2.5 py-1 text-xs font-mono rounded-md border transition-all ${
                  chain.chainId === activeChainId
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                {chain.chainId}
              </button>
            ))}
          </div>
        </section>

        {/* Annotations Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Annotations
            </h2>
            <button onClick={onClearAll} className="text-xs text-blue-600 hover:underline">
              Reset View
            </button>
          </div>

          {/* --- Mutations Panel --- */}
          {mutations.length > 0 && (
            <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
              <div className="p-3 bg-gray-50 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Dna size={16} className="text-rose-500" />
                  <span className="font-medium text-sm text-gray-900">Variants</span>
                  <span className="text-xs text-gray-500 bg-white px-1.5 py-0.5 rounded border">
                    {mutations.length}
                  </span>
                </div>
                <button
                  onClick={() => onToggleMutations(!showMutations)}
                  className="text-gray-400 hover:text-gray-700 p-1 rounded hover:bg-gray-200"
                  title={showMutations ? "Hide all variants" : "Show all variants"}
                >
                  {showMutations ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
              </div>

              {/* Mutation Search */}
              <div className="p-2 border-b">
                <div className="relative">
                  <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input 
                    type="text" 
                    placeholder="Search variants (e.g. S250F, Resistant)"
                    className="w-full pl-8 pr-2 py-1 text-xs border rounded focus:outline-none focus:border-blue-500"
                    value={mutationFilter}
                    onChange={(e) => setMutationFilter(e.target.value)}
                  />
                </div>
              </div>

              {/* Mutation List */}
              <div className="max-h-60 overflow-y-auto divide-y divide-gray-100">
                {filteredMutations.map((mut, idx) => (
                  <div 
                    key={`${mut.masterIndex}_${idx}`}
                    className="group flex flex-col p-2.5 hover:bg-rose-50 transition-colors text-sm cursor-pointer"
                    onClick={() => onFocusMutation(mut.masterIndex)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 font-mono font-medium text-gray-900">
                        <span>{mut.fromResidue}</span>
                        <span className="text-gray-400 text-xs">➜</span>
                        <span>{mut.toResidue}</span>
                        <span className="text-gray-400 font-sans text-xs ml-1">
                           #{mut.authSeqId}
                        </span>
                      </div>
                      <button className="opacity-0 group-hover:opacity-100 text-xs bg-white border px-1.5 rounded text-gray-600 hover:text-blue-600 shadow-sm">
                        Focus
                      </button>
                    </div>
                    
                    {mut.phenotype && (
                      <div className="text-xs text-gray-500 leading-snug">
                        {mut.phenotype}
                      </div>
                    )}
                  </div>
                ))}
                {filteredMutations.length === 0 && (
                   <div className="p-4 text-center text-xs text-gray-400">
                      No variants match filter
                   </div>
                )}
              </div>
            </div>
          )}

          {/* --- Ligands Panel --- */}
          {ligandSites.length > 0 && (
            <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
               <div className="p-3 bg-gray-50 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FlaskConical size={16} className="text-emerald-600" />
                  <span className="font-medium text-sm text-gray-900">Ligands</span>
                  <span className="text-xs text-gray-500 bg-white px-1.5 py-0.5 rounded border">
                    {ligandSites.length}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={onShowAllLigands} className="text-[10px] uppercase font-bold text-gray-400 hover:text-blue-600 px-1">All</button>
                  <span className="text-gray-300">|</span>
                  <button onClick={onHideAllLigands} className="text-[10px] uppercase font-bold text-gray-400 hover:text-gray-600 px-1">None</button>
                </div>
              </div>

              <div className="max-h-60 overflow-y-auto divide-y divide-gray-100">
                {ligandSites.map(site => (
                  <div 
                    key={site.id} 
                    className="flex items-center justify-between p-2 hover:bg-gray-50 group transition-colors"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div 
                        className="w-1.5 h-8 rounded-full flex-shrink-0 mt-0.5" 
                        style={{ backgroundColor: site.color }} 
                      />
                      <div className="min-w-0">
                        <div className="flex items-baseline gap-2">
                           <span className="font-bold text-sm text-gray-900 truncate" title={site.ligandName}>
                             {site.ligandName}
                           </span>
                           <span className="text-xs font-mono text-gray-400">
                             {site.ligandId}
                           </span>
                        </div>
                        <div className="text-xs text-gray-500 font-mono mt-0.5">
                          Chain {site.ligandChain} : {site.ligandAuthSeqId}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1 items-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => onFocusLigand(site.id)}
                        className="p-1 hover:bg-white hover:shadow-sm rounded text-gray-400 hover:text-blue-600"
                        title="Zoom to Ligand"
                      >
                        <Target size={14} />
                      </button>
                      <button
                        onClick={() => onToggleLigand(site.id)}
                        className={`p-1 hover:bg-white hover:shadow-sm rounded ${
                          visibleLigandIds.has(site.id) ? 'text-gray-600' : 'text-gray-300'
                        }`}
                        title="Toggle Visibility"
                      >
                         {visibleLigandIds.has(site.id) ? <Eye size={14} /> : <EyeOff size={14} />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {ligandSites.length === 0 && mutations.length === 0 && (
             <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-200 rounded-lg text-gray-400">
                <AlertCircle size={24} className="mb-2 opacity-50" />
                <span className="text-xs">No annotations found</span>
             </div>
          )}
        </section>
      </div>
    </div>
  );
}