// components/PDBSequenceExtractor.tsx
import { useState } from 'react';
import { useSequenceStructureRegistry } from '../hooks/useSequenceStructureSync';
import { createTubulinClassificationMap } from '@/services/gql_parser';
import { fetchRcsbGraphQlData } from '@/services/rcsb_graphql_service';
import { MolstarService, useMolstarService } from '@/components/molstar/molstar_service';

const API_BASE_URL = "http://localhost:8000";

interface ChainInfo {
  chainId: string;
  sequence: string;
  length: number;
}

interface PDBSequenceExtractorProps {
  molstarService: MolstarService;
  registry: ReturnType<typeof useSequenceStructureRegistry>;
}

export function PDBSequenceExtractor({ molstarService, registry }: PDBSequenceExtractorProps) {
  const [pdbId, setPdbId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [chains, setChains] = useState<ChainInfo[]>([]);
  const [loadedPdbId, setLoadedPdbId] = useState<string | null>(null);
  const [aligningChain, setAligningChain] = useState<string | null>(null);

  const handleLoadStructure = async () => {
    if (!pdbId.trim() || !molstarService) return;

    const pdbIdUpper = pdbId.trim().toUpperCase();
    setIsLoading(true);
    setChains([]);
    setLoadedPdbId(null);

    try {



      const normalizedPdbId = pdbIdUpper.toUpperCase();
      const gqlData = await fetchRcsbGraphQlData(normalizedPdbId);
      const classification = createTubulinClassificationMap(gqlData);


      await molstarService.controller.loadStructure(pdbIdUpper, classification);
      const allChains = molstarService.controller.getAllChains(pdbIdUpper);
      await molstarService.viewer.representations.stylized_lighting()  

      if (!allChains || allChains.length === 0) {
        alert(`No chains found in ${pdbIdUpper}`);
        return;
      }

      registry.registerStructure(pdbIdUpper, allChains);

      const chainInfos: ChainInfo[] = [];
      for (const chainId of allChains) {
        const sequence = molstarService.controller.getChainSequence(pdbIdUpper, chainId);
        if (sequence && sequence.length > 0) {
          chainInfos.push({ chainId, sequence, length: sequence.length });
        }
      }

      setChains(chainInfos);
      setLoadedPdbId(pdbIdUpper);
    } catch (err: any) {
      console.error("Failed to load structure:", err);
      alert(`Failed to load ${pdbIdUpper}: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAlignChain = async (chainInfo: ChainInfo) => {
    if (!loadedPdbId) return;

    setAligningChain(chainInfo.chainId);
    
    try {
      const response = await fetch(`${API_BASE_URL}/msaprofile/sequence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sequence: chainInfo.sequence,
          sequence_id: `${loadedPdbId}_${chainInfo.chainId}`,
          annotations: [],
        }),
      });

      if (!response.ok) {
        throw new Error(`Alignment failed: ${response.status}`);
      }

      const result = await response.json();
      
      const positionMapping: Record<number, number> = {};
      result.mapping.forEach((originalResidue: number, alignedPos: number) => {
        if (originalResidue !== -1) {
          positionMapping[alignedPos] = originalResidue;
        }
      });
      
      registry.addSequence(
        `${loadedPdbId}_${chainInfo.chainId}`,
        `${loadedPdbId}_${chainInfo.chainId}`,
        result.aligned_sequence,
        {
          type: 'pdb',
          pdbId: loadedPdbId,
          chainId: chainInfo.chainId,
          positionMapping: positionMapping
        }
      );
    } catch (err: any) {
      console.error("Failed to align chain:", err);
      alert(`Failed to align: ${err.message}`);
    } finally {
      setAligningChain(null);
    }
  };

  return (
    <div className="p-4 border-t bg-gray-50">
      <h3 className="text-md font-semibold mb-2">Load Structure & Extract Chains</h3>

      <div className="flex gap-2 mb-4">
        <div className="flex-grow">
          <label className="block text-xs font-medium text-gray-600 mb-1">PDB ID</label>
          <input
            type="text"
            value={pdbId}
            onChange={(e) => setPdbId(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleLoadStructure()}
            placeholder="e.g., 5CJO"
            className="p-2 w-full border rounded text-sm font-mono uppercase"
            disabled={isLoading}
          />
        </div>
        <button
          onClick={handleLoadStructure}
          disabled={isLoading || !pdbId.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm self-end"
        >
          {isLoading ? "Loading..." : "Load Structure"}
        </button>
      </div>

      {loadedPdbId && chains.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Chains in {loadedPdbId}:</h4>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {chains.map((chain) => {
              const existingSeq = registry.getSequenceByChain(loadedPdbId, chain.chainId);
              const isAligned = existingSeq !== null;

              return (
                <div
                  key={chain.chainId}
                  className={`flex items-start gap-2 p-3 border rounded transition-colors ${
                    isAligned ? 'bg-green-50 border-green-300' : 'bg-white hover:border-blue-300'
                  }`}
                >
                  <div className="flex-grow min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono font-bold text-blue-600">Chain {chain.chainId}</span>
                      <span className="text-xs text-gray-500">({chain.length} residues)</span>
                      {isAligned && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                          Row {existingSeq.rowIndex + 1}
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-mono text-gray-600 overflow-hidden">
                      <span className="bg-gray-100 px-2 py-1 rounded">
                        {chain.sequence.substring(0, 60)}
                        {chain.sequence.length > 60 && "..."}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleAlignChain(chain)}
                    disabled={aligningChain === chain.chainId || isAligned}
                    className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed whitespace-nowrap flex-shrink-0"
                  >
                    {aligningChain === chain.chainId ? "Aligning..." : isAligned ? "Aligned" : "Align"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-xs text-gray-500 mt-2">Load a PDB structure to view and align its chains</p>
    </div>
  );
}
