// src/app/msa-viewer/components/PDBSequenceExtractor.tsx
import { useCallback, useState } from 'react';
import { useSequenceStructureRegistry } from '../hooks/useSequenceStructureSync';
import { MolstarService } from '@/components/molstar/molstar_service';
// import { createTubulinClassificationMap } from '@/services/gql_parser';
import { fetchRcsbGraphQlData } from '@/services/rcsb_graphql_service';
import { useSequenceAligner } from '../hooks/useSequenceAligner';
import { ChainAnnotationSummary } from './ChainAnnotationSummary';
import { useChainAnnotations } from '../hooks/useChainAnnotations';
import { createClassificationFromProfile } from '@/services/profile_service';

interface PDBSequenceExtractorProps {
  mainService: MolstarService | null;
  registry: ReturnType<typeof useSequenceStructureRegistry>;
  onMutationClick?: (pdbId: string, chainId: string, masterIndex: number) => void;
}

export function PDBSequenceExtractor({
  mainService,
  registry,
  onMutationClick
}: PDBSequenceExtractorProps) {
  const [pdbId, setPdbId] = useState("");
  const [isLoadingStructure, setIsLoadingStructure] = useState(false);
  const [availableChains, setAvailableChains] = useState<AvailableChain[]>([]);
  const [loadedPdbId, setLoadedPdbId] = useState<string | null>(null);

  const { alignAndRegisterChain, isAligning, currentChain } = useSequenceAligner(registry);
  const { cacheAnnotations, getAnnotations } = useChainAnnotations();


  const handleLoadStructure = async () => {
    if (!mainService || !pdbId.trim()) return;

    setIsLoadingStructure(true);
    setAvailableChains([]);
    setLoadedPdbId(null);

    try {
      const cleanId = pdbId.trim().toUpperCase();

      // Fetch profile from backend instead of GQL
      const response = await fetch(`http://localhost:8000/structures/${cleanId}/profile`);
      if (!response.ok) {
        throw new Error(`Failed to fetch profile for ${cleanId}`);
      }
      const profileData = await response.json();
      const classification = createClassificationFromProfile(profileData);

      await mainService.controller.loadStructure(cleanId, classification);
      await mainService.viewer.representations.stylized_lighting();

      const chainIds = mainService.controller.getAllChains(cleanId);

      const chainsData: AvailableChain[] = [];
      for (const ch of chainIds) {
        const obs = mainService.controller.getObservedSequenceAndMapping(cleanId, ch);
        if (obs && obs.sequence.length > 0) {
          chainsData.push({
            id: ch,
            len: obs.sequence.length,
            seq: obs.sequence
          });
        }
      }

      registry.registerStructure(cleanId, chainIds, 'main');
      setAvailableChains(chainsData);
      setLoadedPdbId(cleanId);

    } catch (err: any) {
      console.error("Structure load failed:", err);
      alert(`Failed to load ${pdbId}: ${err.message}`);
    } finally {
      setIsLoadingStructure(false);
    }
  };


  const handleAlignClick = async (chainId: string) => {
    if (!mainService || !loadedPdbId) return;

    try {
      const annotations = getAnnotations(loadedPdbId, chainId);

      await alignAndRegisterChain(
        loadedPdbId,
        chainId,
        mainService,
        annotations?.mutations || [],
        annotations?.modifications || []
      );

      await mainService.controller.isolateChain(loadedPdbId, chainId);

      // Trigger mutation click to select this polymer for the ligand panel
      if (onMutationClick) {
        onMutationClick(loadedPdbId, chainId, 1); // Position 1 just to trigger selection
      }

      console.log(`Isolated chain ${chainId} in structure ${loadedPdbId}`);
    } catch (err: any) {
      alert(`Alignment failed: ${err.message}`);
    }
  };

  const handleAnnotationsLoaded = useCallback((chainId: string, data: any) => {
    if (loadedPdbId) {
      cacheAnnotations(loadedPdbId, chainId, data);
    }
  }, [loadedPdbId, cacheAnnotations]);

  const handleMutationClick = useCallback((chainId: string, masterIndex: number) => {
    console.log('🟡 handleMutationClick in PDBSequenceExtractor', { loadedPdbId, chainId, masterIndex });
    if (loadedPdbId && onMutationClick) {
      console.log('🟢 Calling parent onMutationClick');
      onMutationClick(loadedPdbId, chainId, masterIndex);
    } else {
      console.log('🔴 Missing:', { loadedPdbId, hasCallback: !!onMutationClick });
    }
  }, [loadedPdbId, onMutationClick]);

  const isChainAligned = (chainId: string) => {
    return loadedPdbId && registry.getSequenceByChain(loadedPdbId, chainId) !== null;
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Load Structure</h3>
        <div className="flex gap-2">
          <input
            value={pdbId}
            onChange={e => setPdbId(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLoadStructure()}
            className="flex-1 border border-gray-300 rounded-md p-2 font-mono uppercase text-sm outline-none"
            placeholder="PDB ID (e.g., 5JCO)"
            disabled={isLoadingStructure}
          />

          <button
            onClick={handleLoadStructure}
            disabled={isLoadingStructure || !mainService || !pdbId.trim()}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isLoadingStructure ? "..." : "Load"}
          </button>
        </div>
      </div>

      {loadedPdbId && availableChains.length > 0 && (
        <div className="flex-1 min-h-0 flex flex-col bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="p-3 border-b border-gray-100 flex justify-between items-center">
            <h3 className="text-sm font-semibold text-gray-700">Align Chains</h3>
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
              {availableChains.length} chains
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {availableChains.map(chain => {
              const aligned = isChainAligned(chain.id);
              const processing = isAligning && currentChain === chain.id;

              return (
                <div
                  key={chain.id}
                  className={`p-2 rounded-md border transition-all
                     ${aligned
                      ? 'bg-green-50 border-green-200'
                      : 'bg-white border-gray-200 hover:border-blue-300'
                    }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-baseline gap-2">
                      <span className={`font-mono font-bold text-base ${aligned ? 'text-green-700' : 'text-gray-700'}`}>
                        Chain {chain.id}
                      </span>
                      <span className="text-xs text-gray-500">{chain.len} residues</span>
                    </div>

                    <button
                      onClick={() => handleAlignClick(chain.id)}
                      disabled={aligned || isAligning}
                      className={`text-xs px-3 py-1 rounded-md font-medium transition-all shadow-sm
                         ${aligned
                          ? 'bg-white text-green-700 border border-green-200 cursor-default'
                          : processing
                            ? 'bg-blue-100 text-blue-700 cursor-wait'
                            : 'bg-gray-800 text-white hover:bg-black'
                        }`}
                    >
                      {aligned ? "Aligned" : processing ? "..." : "Align"}
                    </button>
                  </div>

                  <ChainAnnotationSummary
                    rcsb_id={loadedPdbId}
                    auth_asym_id={chain.id}
                    onAnnotationsLoaded={(data) => handleAnnotationsLoaded(chain.id, data)}
                    onMutationClick={(masterIndex) => handleMutationClick(chain.id, masterIndex)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

interface AvailableChain {
  id: string;
  len: number;
  seq: string;
}
