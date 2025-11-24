// src/app/msa-viewer/components/PDBSequenceExtractor.tsx
import { useCallback, useState } from 'react';
import { useSequenceStructureRegistry } from '../hooks/useSequenceStructureSync';
import { MolstarService } from '@/components/molstar/molstar_service';
import { createTubulinClassificationMap } from '@/services/gql_parser';
import { fetchRcsbGraphQlData } from '@/services/rcsb_graphql_service';
import { useSequenceAligner } from '../hooks/useSequenceAligner';
import { ChainAnnotationSummary } from './ChainAnnotationSummary';
import { useChainAnnotations } from '../hooks/useChainAnnotations';

interface PDBSequenceExtractorProps {
  mainService: MolstarService | null;
  auxiliaryService: MolstarService | null;
  registry: ReturnType<typeof useSequenceStructureRegistry>;
}

interface AvailableChain {
  id: string;
  len: number;
  seq: string;
}

export function PDBSequenceExtractor({ mainService, auxiliaryService, registry }: PDBSequenceExtractorProps) {
  const [pdbId, setPdbId] = useState("");
  const [isLoadingStructure, setIsLoadingStructure] = useState(false);
  const [availableChains, setAvailableChains] = useState<AvailableChain[]>([]);
  const [loadedPdbId, setLoadedPdbId] = useState<string | null>(null);
  const [selectedViewer, setSelectedViewer] = useState<'main' | 'auxiliary'>('main');

  const { alignAndRegisterChain, isAligning, currentChain } = useSequenceAligner(registry);
  const { cacheAnnotations, getAnnotations } = useChainAnnotations();

  const activeService = selectedViewer === 'main' ? mainService : auxiliaryService;

  const handleLoadStructure = async () => {
    if (!activeService || !pdbId.trim()) return;

    setIsLoadingStructure(true);
    setAvailableChains([]);
    setLoadedPdbId(null);

    try {
      const cleanId = pdbId.trim().toUpperCase();

      const gqlData = await fetchRcsbGraphQlData(cleanId);
      const classification = createTubulinClassificationMap(gqlData);

      await activeService.controller.loadStructure(cleanId, classification);
      await activeService.viewer.representations.stylized_lighting();

      const chainIds = activeService.controller.getAllChains(cleanId);

      const chainsData: AvailableChain[] = [];
      for (const ch of chainIds) {
        const obs = activeService.controller.getObservedSequenceAndMapping(cleanId, ch);
        if (obs && obs.sequence.length > 0) {
          chainsData.push({
            id: ch,
            len: obs.sequence.length,
            seq: obs.sequence
          });
        }
      }

      registry.registerStructure(cleanId, chainIds, selectedViewer);
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
    if (!activeService || !loadedPdbId) return;
    try {
      await alignAndRegisterChain(loadedPdbId, chainId, activeService);
    } catch (err: any) {
      alert(`Alignment failed: ${err.message}`);
    }
  };

  const handleAnnotationsLoaded = useCallback((chainId: string, data: any) => {
    if (loadedPdbId) {
      cacheAnnotations(loadedPdbId, chainId, data);
    }
  }, [loadedPdbId, cacheAnnotations]); // Add dependencies


  const isChainAligned = (chainId: string) => {
    return loadedPdbId && registry.getSequenceByChain(loadedPdbId, chainId) !== null;
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">1. Load Structure</h3>
        <div className="flex gap-2">
          <select
            className="text-sm border border-gray-300 rounded-md p-2 bg-white outline-none"
            value={selectedViewer}
            onChange={e => setSelectedViewer(e.target.value as any)}
          >
            <option value="main">Main Viewer</option>
            <option value="auxiliary">Aux Viewer</option>
          </select>

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
            disabled={isLoadingStructure || !activeService || !pdbId.trim()}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isLoadingStructure ? "..." : "Load"}
          </button>
        </div>
      </div>

      {loadedPdbId && availableChains.length > 0 && (
        <div className="flex-1 min-h-0 flex flex-col bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="p-3 border-b border-gray-100 flex justify-between items-center">
            <h3 className="text-sm font-semibold text-gray-700">2. Align Chains</h3>
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
