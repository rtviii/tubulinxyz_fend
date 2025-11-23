// components/PDBSequenceExtractor.tsx
import { useState } from 'react';
import { useSequenceStructureRegistry } from '../hooks/useSequenceStructureSync';
import { createTubulinClassificationMap } from '@/services/gql_parser';
import { fetchRcsbGraphQlData } from '@/services/rcsb_graphql_service';
import { MolstarService } from '@/components/molstar/molstar_service';
import { useMolstarStructureLoader } from '@/components/molstar/useMolstarStructureLoader';

const API_BASE_URL = "http://localhost:8000";

interface ChainInfo {
  chainId: string;
  sequence: string;
  length: number;
}

interface PDBSequenceExtractorProps {
  mainService: MolstarService | null;
  auxiliaryService: MolstarService | null;
  registry: ReturnType<typeof useSequenceStructureRegistry>;
}

export function PDBSequenceExtractor({ mainService, auxiliaryService, registry }: PDBSequenceExtractorProps) {
  const [pdbId, setPdbId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [chains, setChains] = useState<ChainInfo[]>([]);
  const [loadedPdbId, setLoadedPdbId] = useState<string | null>(null);
  const [aligningChain, setAligningChain] = useState<string | null>(null);
  const [selectedViewer, setSelectedViewer] = useState<'main' | 'auxiliary'>('main');
  const [loadingDemo, setLoadingDemo] = useState(false);

  const mainLoader = useMolstarStructureLoader(mainService?.controller || null);
  const auxiliaryLoader = useMolstarStructureLoader(auxiliaryService?.controller || null);

  // const handleLoadDemo1 = async () => {
  //   const molstarService = selectedViewer === 'main' ? mainService : auxiliaryService;
  //   const loader = selectedViewer === 'main' ? mainLoader : auxiliaryLoader;

  //   if (!molstarService) {
  //     alert(`${selectedViewer === 'main' ? 'Main' : 'Auxiliary'} viewer not initialized`);
  //     return;
  //   }

  //   setLoadingDemo(true);
  //   setChains([]);
  //   setLoadedPdbId(null);

  //   try {
  //     const filename = '7sj7_with_metadata.cif';
  //     const demoId = '7SJ7';

  //     // Load from backend
  //     const result = await loader.loadFromBackend(filename, {
  //       applyStylizedLighting: true
  //     });

  //     if (!result.success) {
  //       alert(`Failed to load demo structure ${demoId}`);
  //       return;
  //     }

  //     const allChains = molstarService.controller.getAllChains(demoId);

  //     if (!allChains || allChains.length === 0) {
  //       alert(`No chains found in ${demoId}`);
  //       return;
  //     }

  //     registry.registerStructure(demoId, allChains, selectedViewer);

  //     const chainInfos: ChainInfo[] = [];
  //     for (const chainId of allChains) {
  //       const sequence = molstarService.controller.getChainSequence(demoId, chainId);
  //       if (sequence && sequence.length > 0) {
  //         chainInfos.push({ chainId, sequence, length: sequence.length });
  //       }
  //     }

  //     setChains(chainInfos);
  //     setLoadedPdbId(demoId);
  //     setPdbId(demoId);

  //   } catch (err: any) {
  //     console.error("Failed to load demo structure:", err);
  //     alert(`Failed to load demo: ${err.message}`);
  //   } finally {
  //     setLoadingDemo(false);
  //   }
  // };
  // const handleLoadDemo2 = async () => {
  //   const molstarService = selectedViewer === 'main' ? mainService : auxiliaryService;
  //   const loader = selectedViewer === 'main' ? mainLoader : auxiliaryLoader;

  //   if (!molstarService) {
  //     alert(`${selectedViewer === 'main' ? 'Main' : 'Auxiliary'} viewer not initialized`);
  //     return;
  //   }

  //   setLoadingDemo(true);
  //   setChains([]);
  //   setLoadedPdbId(null);

  //   try {
  //     const filename = 'fold_htuba1a_model_0.cif';
  //     const demoId = 'FOLD'; // Match what loadFromBackend extracts from filename

  //     const result = await loader.loadFromBackend(filename, {
  //       applyStylizedLighting: true
  //     });

  //     if (!result.success) {
  //       alert(`Failed to load demo structure ${demoId}`);
  //       return;
  //     }

  //     const allChains = molstarService.controller.getAllChains(demoId);

  //     if (!allChains || allChains.length === 0) {
  //       alert(`No chains found in ${demoId}`);
  //       return;
  //     }

  //     registry.registerStructure(demoId, allChains, selectedViewer);

  //     const chainInfos: ChainInfo[] = [];
  //     for (const chainId of allChains) {
  //       const sequence = molstarService.controller.getChainSequence(demoId, chainId);
  //       if (sequence && sequence.length > 0) {
  //         chainInfos.push({ chainId, sequence, length: sequence.length });
  //       }
  //     }

  //     setChains(chainInfos);
  //     setLoadedPdbId(demoId);
  //     setPdbId(demoId);

  //   } catch (err: any) {
  //     console.error("Failed to load demo structure:", err);
  //     alert(`Failed to load demo: ${err.message}`);
  //   } finally {
  //     setLoadingDemo(false);
  //   }
  // }

  const handleLoadStructure = async () => {
    if (!pdbId.trim()) return;

    const molstarService = selectedViewer === 'main' ? mainService : auxiliaryService;
    if (!molstarService) {
      alert(`${selectedViewer === 'main' ? 'Main' : 'Auxiliary'} viewer not initialized`);
      return;
    }

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
      await molstarService.viewer.representations.stylized_lighting();

      if (!allChains || allChains.length === 0) {
        alert(`No chains found in ${pdbIdUpper}`);
        return;
      }

      registry.registerStructure(pdbIdUpper, allChains, selectedViewer);

      const chainInfos: ChainInfo[] = [];
      for (const chainId of allChains) {
        // ✨ FIX: This now returns an object { sequence, authSeqIds }
        const observedData = molstarService.controller.getObservedSequenceAndMapping(pdbIdUpper, chainId);

        // ✨ FIX: Check observedData.sequence
        if (observedData && observedData.sequence.length > 0) {
          chainInfos.push({
            chainId,
            sequence: observedData.sequence, // Extract the string part
            length: observedData.sequence.length
          });
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
  };;


  const handleAlignChain = async (chainInfo: ChainInfo) => {
    if (!loadedPdbId) return;
    const molstarService = selectedViewer === 'main' ? mainService : auxiliaryService;
    if (!molstarService) return;

    setAligningChain(chainInfo.chainId);

    try {
      // 1. ATOMIC EXTRACTION (Source of Truth)
      const observedData = molstarService.controller.getObservedSequenceAndMapping(
        loadedPdbId,
        chainInfo.chainId
      );

      if (!observedData) throw new Error("Molstar extraction failed");
      
      // Validation Check
      if (observedData.sequence.length !== observedData.authSeqIds.length) {
        throw new Error(`CRITICAL: Molstar sequence length (${observedData.sequence.length}) does not match IDs length (${observedData.authSeqIds.length})`);
      }

      // 2. SEND TO BACKEND
      const payload = {
        sequence: observedData.sequence,
        sequence_id: `${loadedPdbId}_${chainInfo.chainId}`,
        annotations: [],
        auth_seq_ids: observedData.authSeqIds // <--- RENAMED FIELD matches Backend Schema
      };

      const response = await fetch(`${API_BASE_URL}/msaprofile/sequence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Backend Error: ${errText}`);
      }

  const result = await response.json();

      const positionMapping: Record<number, number> = {};

      result.mapping.forEach((backendValue: number, msaIndexZeroBased: number) => {
        if (backendValue !== -1) {
          const realAuthId = backendValue;

          // 0-BASED LOGIC
          // We map Index 0 -> AuthID X
          positionMapping[msaIndexZeroBased] = realAuthId; 
        }
      });
      // 4. Register
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

      await molstarService.controller.isolateChain(loadedPdbId, chainInfo.chainId);

    } catch (err: any) {
      console.error("Alignment Error:", err);
      alert(`Alignment failed: ${err.message}`);
    } finally {
      setAligningChain(null);
    }
  };;;;

  const alignedChains = loadedPdbId ? registry.getSequencesByStructure(loadedPdbId) : [];
  const alignedChainIds = new Set(alignedChains.map(seq =>
    seq.origin.type === 'pdb' ? seq.origin.chainId : ''
  ));

  return (
    <div>
      <h3 className="text-sm font-semibold mb-2 text-gray-800">
        Load Structure
      </h3>

      <div className="mb-2">
        {/* <label className="block text-xs font-medium text-gray-600 mb-1">Target Viewer</label> */}
        <select
          value={selectedViewer}
          onChange={(e) => setSelectedViewer(e.target.value as 'main' | 'auxiliary')}
          className="w-full p-1.5 border border-gray-300 rounded-md text-sm"
        >
          <option value="main">Main Viewer</option>
          <option value="auxiliary">Auxiliary Viewer</option>
        </select>
      </div>

      {/* Demo Button */}
      {/* <div className="mb-3 flex gap-2">
        <button
          onClick={handleLoadDemo1}
          disabled={loadingDemo}
          className="px-2 py-1 bg-purple-600 text-white rounded text-xs font-medium hover:bg-purple-700 disabled:bg-gray-400"
        >
          {loadingDemo ? "..." : "Demo: reconstructed tail & flexible loop 7SJ7"}
        </button>
        <button
          onClick={handleLoadDemo2} // Change this to your AlphaFold handler
          disabled={loadingDemo}
          className="px-2 py-1 bg-orange-600 text-white rounded text-xs font-medium hover:bg-orange-700 disabled:bg-gray-400"
        >
          AlphaFold
        </button>
      </div> */}

      <div className="border-t pt-3 mb-2">
        <p className="text-xs text-gray-500 mb-2">Or load from RCSB:</p>
      </div>

      <div className="flex gap-2 mb-2">
        <div className="flex-grow">
          <label className="block text-xs font-medium text-gray-600 mb-1">PDB ID</label>
          <input
            type="text"
            value={pdbId}
            onChange={(e) => setPdbId(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleLoadStructure()}
            placeholder="e.g., 5CJO"
            className="p-1.5 w-full border border-gray-300 rounded-md text-sm font-mono uppercase focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all"
            disabled={isLoading}
          />
        </div>
        <button
          onClick={handleLoadStructure}
          disabled={isLoading || !pdbId.trim()}
          className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm self-end font-medium shadow-sm hover:shadow transition-all"
        >
          {isLoading ? "..." : "Load"}
        </button>
      </div>

      {loadedPdbId && chains.length > 0 && (
        <div className="mt-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-gray-700">
              Chains in {loadedPdbId}
            </h4>
            <div className="text-xs text-gray-500">
              {alignedChainIds.size} / {chains.length} aligned
            </div>
          </div>

          <div className="space-y-1.5 pr-1">
            {chains.map((chain) => {
              const isAligned = alignedChainIds.has(chain.chainId);
              const existingSeq = registry.getSequenceByChain(loadedPdbId, chain.chainId);

              return (
                <div
                  key={chain.chainId}
                  className={`flex items-start gap-2 p-1.5 rounded-md transition-all ${isAligned
                    ? 'bg-green-50'
                    : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                >
                  <div className="flex-grow min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`font-mono font-bold text-sm ${isAligned ? 'text-green-700' : 'text-blue-600'}`}>
                        {chain.chainId}
                      </span>
                      <span className="text-xs text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded-full">
                        {chain.length} res
                      </span>
                      {isAligned && existingSeq && (
                        <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">
                          Row {existingSeq.rowIndex + 1}
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-mono text-gray-600">
                      <div className="bg-white px-1 py-1 rounded border border-gray-200 overflow-hidden">
                        {chain.sequence.substring(0, 50)}
                        {chain.sequence.length > 50 && (
                          <span className="text-gray-400">...</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleAlignChain(chain)}
                    disabled={aligningChain === chain.chainId || isAligned}
                    className={`px-2 py-1 text-white text-xs rounded-md font-medium whitespace-nowrap flex-shrink-0 transition-all shadow-sm hover:shadow self-center ${isAligned
                      ? 'bg-gray-300 cursor-not-allowed'
                      : aligningChain === chain.chainId
                        ? 'bg-blue-400 cursor-wait'
                        : 'bg-green-600 hover:bg-green-700'
                      }`}
                  >
                    {aligningChain === chain.chainId ? (
                      "..."
                    ) : isAligned ? (
                      "Aligned"
                    ) : "Align"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-xs text-gray-500 mt-2">
        Load structures to align their chains with the master alignment.
      </p>
    </div>
  );
}
