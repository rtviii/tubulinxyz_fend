// src/app/msalite/components/ChainAligner.tsx
'use client';

import { useState, useCallback } from 'react';
import { MolstarService } from '@/components/molstar/molstar_service';
import { useChainAlignment } from '../hooks/useChainAlignment';
import { useAppSelector } from '@/store/store';
import { selectIsChainAligned } from '@/store/slices/sequence_registry';

interface ChainAlignerProps {
  molstarService: MolstarService | null;
  onLog?: (message: string) => void;
}

interface ChainInfo {
  id: string;
  length: number;
  sequence: string;
}

export function ChainAligner({ molstarService, onLog }: ChainAlignerProps) {
  const [pdbInput, setPdbInput] = useState('');
  const [loadedPdbId, setLoadedPdbId] = useState<string | null>(null);
  const [chains, setChains] = useState<ChainInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const { alignChain, isAligning, currentChain, error } = useChainAlignment();

  const log = useCallback((msg: string) => {
    onLog?.(msg);
    console.log(`[ChainAligner] ${msg}`);
  }, [onLog]);

  const handleLoadStructure = async () => {
    if (!molstarService || !pdbInput.trim()) return;

    const pdbId = pdbInput.trim().toUpperCase();
    setIsLoading(true);
    setChains([]);
    setLoadedPdbId(null);

    try {
      log(`Loading ${pdbId}...`);
      
      // Fetch profile for classification (optional, for coloring)
      let classification = undefined;
      try {
        const response = await fetch(`http://localhost:8000/structures/${pdbId}/profile`);
        if (response.ok) {
          const profile = await response.json();
          // You can process profile here if needed
        }
      } catch {
        // Profile fetch is optional, continue without it
      }

      await molstarService.controller.loadStructure(pdbId, classification);
      
      // Extract chain info
      const chainIds = molstarService.controller.getAllChains(pdbId);
      const chainInfos: ChainInfo[] = [];

      for (const chainId of chainIds) {
        const observed = molstarService.controller.getObservedSequenceAndMapping(pdbId, chainId);
        if (observed && observed.sequence.length > 0) {
          chainInfos.push({
            id: chainId,
            length: observed.sequence.length,
            sequence: observed.sequence,
          });
        }
      }

      setChains(chainInfos);
      setLoadedPdbId(pdbId);
      log(`Loaded ${pdbId}: ${chainInfos.length} chains`);

    } catch (err: any) {
      log(`Failed to load ${pdbId}: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAlignChain = async (chainId: string) => {
    if (!molstarService || !loadedPdbId) return;

    try {
      log(`Aligning ${loadedPdbId}:${chainId}...`);
      const result = await alignChain(loadedPdbId, chainId, molstarService);
      log(`Aligned ${result.sequenceId}: ${Object.keys(result.mapping).length} mapped positions`);
    } catch (err: any) {
      log(`Alignment failed: ${err.message}`);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Input */}
      <div className="flex gap-2">
        <input
          value={pdbInput}
          onChange={(e) => setPdbInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleLoadStructure()}
          placeholder="PDB ID (e.g., 5JCO)"
          className="flex-1 border rounded px-2 py-1 text-sm font-mono uppercase"
          disabled={isLoading}
        />
        <button
          onClick={handleLoadStructure}
          disabled={isLoading || !molstarService || !pdbInput.trim()}
          className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:bg-gray-400"
        >
          {isLoading ? '...' : 'Load'}
        </button>
      </div>

      {/* Chain list */}
      {loadedPdbId && chains.length > 0 && (
        <div className="border rounded p-2 bg-gray-50">
          <div className="text-xs text-gray-600 mb-2">
            {loadedPdbId}: {chains.length} chain{chains.length > 1 ? 's' : ''}
          </div>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {chains.map((chain) => (
              <ChainRow
                key={chain.id}
                pdbId={loadedPdbId}
                chain={chain}
                isAligning={isAligning && currentChain === chain.id}
                onAlign={() => handleAlignChain(chain.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
          {error}
        </div>
      )}
    </div>
  );
}

function ChainRow({
  pdbId,
  chain,
  isAligning,
  onAlign,
}: {
  pdbId: string;
  chain: ChainInfo;
  isAligning: boolean;
  onAlign: () => void;
}) {
  const isAligned = useAppSelector((state) => selectIsChainAligned(state, pdbId, chain.id));

  return (
    <div className={`flex items-center justify-between p-1.5 rounded text-xs ${
      isAligned ? 'bg-green-100' : 'bg-white'
    }`}>
      <div className="flex items-center gap-2">
        <span className={`font-mono font-medium ${isAligned ? 'text-green-700' : 'text-gray-700'}`}>
          {chain.id}
        </span>
        <span className="text-gray-500">{chain.length} aa</span>
      </div>
      <button
        onClick={onAlign}
        disabled={isAligned || isAligning}
        className={`px-2 py-0.5 rounded text-xs ${
          isAligned
            ? 'bg-green-200 text-green-800 cursor-default'
            : isAligning
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-800 text-white hover:bg-black'
        }`}
      >
        {isAligned ? 'Done' : isAligning ? '...' : 'Align'}
      </button>
    </div>
  );
}