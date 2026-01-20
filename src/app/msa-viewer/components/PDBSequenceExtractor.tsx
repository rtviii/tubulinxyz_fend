import { useState } from 'react';
import { MolstarService } from '@/components/molstar/molstar_service';
import { useSequenceAligner } from '../hooks/useSequenceAligner';
import { ChainAnnotationSummary } from './ChainAnnotationSummary';
import { useAppSelector } from '@/store/store';
import { selectIsChainAligned } from '@/store/slices/sequence_registry';
import { useGetStructureProfileStructuresRcsbIdProfileGetQuery } from '@/store/tubxz_api';
import { createClassificationFromProfile } from '@/services/profile_service';

interface PDBSequenceExtractorProps {
  mainService: MolstarService | null;
  onChainAligned?: (pdbId: string, chainId: string) => void;
}

interface AvailableChain {
  id: string;
  len: number;
  seq: string;
}

export function PDBSequenceExtractor({
  mainService,
  onChainAligned,
}: PDBSequenceExtractorProps) {
  const [pdbIdInput, setPdbIdInput] = useState("");
  const [loadedPdbId, setLoadedPdbId] = useState<string | null>(null);
  const [availableChains, setAvailableChains] = useState<AvailableChain[]>([]);
  const [isLoadingStructure, setIsLoadingStructure] = useState(false);

  const { alignAndRegisterChain, isAligning, currentChain } = useSequenceAligner();

  // Skip query until we have a loaded PDB ID
  const { data: profileData } = useGetStructureProfileStructuresRcsbIdProfileGetQuery(
    { rcsbId: loadedPdbId! },
    { skip: !loadedPdbId }
  );

  const handleLoadStructure = async () => {
    if (!mainService || !pdbIdInput.trim()) return;

    setIsLoadingStructure(true);
    setAvailableChains([]);
    setLoadedPdbId(null);

    try {
      const cleanId = pdbIdInput.trim().toUpperCase();

      // Fetch profile for classification
      const response = await fetch(`http://localhost:8000/structures/${cleanId}/profile`);
      if (!response.ok) {
        throw new Error(`Failed to fetch profile for ${cleanId}`);
      }
      const profile = await response.json();
      const classification = createClassificationFromProfile(profile);

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

      setAvailableChains(chainsData);
      setLoadedPdbId(cleanId);

    } catch (err: any) {
      console.error("Structure load failed:", err);
      alert(`Failed to load ${pdbIdInput}: ${err.message}`);
    } finally {
      setIsLoadingStructure(false);
    }
  };

  const handleAlignClick = async (chainId: string) => {
    if (!mainService || !loadedPdbId) return;

    try {
      await alignAndRegisterChain(loadedPdbId, chainId, mainService);
      await mainService.controller.isolateChain(loadedPdbId, chainId, true);
      onChainAligned?.(loadedPdbId, chainId);
    } catch (err: any) {
      alert(`Alignment failed: ${err.message}`);
    }
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Load Structure</h3>
        <div className="flex gap-2">
          <input
            value={pdbIdInput}
            onChange={e => setPdbIdInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLoadStructure()}
            className="flex-1 border border-gray-300 rounded-md p-2 font-mono uppercase text-sm outline-none"
            placeholder="PDB ID (e.g., 5JCO)"
            disabled={isLoadingStructure}
          />
          <button
            onClick={handleLoadStructure}
            disabled={isLoadingStructure || !mainService || !pdbIdInput.trim()}
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
            {availableChains.map(chain => (
              <ChainRow
                key={chain.id}
                pdbId={loadedPdbId}
                chain={chain}
                isAligning={isAligning}
                currentChain={currentChain}
                onAlignClick={handleAlignClick}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Extracted to use hooks properly
function ChainRow({
  pdbId,
  chain,
  isAligning,
  currentChain,
  onAlignClick,
}: {
  pdbId: string;
  chain: AvailableChain;
  isAligning: boolean;
  currentChain: string | null;
  onAlignClick: (chainId: string) => void;
}) {
  const isAligned = useAppSelector(state => selectIsChainAligned(state, pdbId, chain.id));
  const processing = isAligning && currentChain === chain.id;

  return (
    <div
      className={`p-2 rounded-md border transition-all ${isAligned
          ? 'bg-green-50 border-green-200'
          : 'bg-white border-gray-200 hover:border-blue-300'
        }`}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-baseline gap-2">
          <span className={`font-mono font-bold text-base ${isAligned ? 'text-green-700' : 'text-gray-700'}`}>
            Chain {chain.id}
          </span>
          <span className="text-xs text-gray-500">{chain.len} residues</span>
        </div>

        <button
          onClick={() => onAlignClick(chain.id)}
          disabled={isAligned || isAligning}
          className={`text-xs px-3 py-1 rounded-md font-medium transition-all shadow-sm ${isAligned
              ? 'bg-white text-green-700 border border-green-200 cursor-default'
              : processing
                ? 'bg-blue-100 text-blue-700 cursor-wait'
                : 'bg-gray-800 text-white hover:bg-black'
            }`}
        >
          {isAligned ? "Aligned" : processing ? "..." : "Align"}
        </button>
      </div>

      <ChainAnnotationSummary
        rcsb_id={pdbId}
        auth_asym_id={chain.id}
      />
    </div>
  );
}
