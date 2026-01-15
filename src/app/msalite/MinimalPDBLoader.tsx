'use client';

import { useState } from 'react';
import { MolstarService } from '@/components/molstar/molstar_service';
import { useSequenceAligner } from '../msa-viewer/hooks/useSequenceAligner';
import { createClassificationFromProfile } from '@/services/profile_service';

interface MinimalPDBLoaderProps {
  molstarService: MolstarService | null;
}

interface ChainInfo {
  id: string;
  length: number;
}

export function MinimalPDBLoader({ molstarService }: MinimalPDBLoaderProps) {
  const [pdbInput, setPdbInput] = useState('');
  const [loadedPdb, setLoadedPdb] = useState<string | null>(null);
  const [chains, setChains] = useState<ChainInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [alignedChains, setAlignedChains] = useState<Set<string>>(new Set());

  const { alignAndRegisterChain, isAligning, currentChain } = useSequenceAligner();

  const handleLoad = async () => {
    if (!molstarService || !pdbInput.trim()) return;

    setLoading(true);
    setChains([]);
    setLoadedPdb(null);
    setAlignedChains(new Set());

    try {
      const pdbId = pdbInput.trim().toUpperCase();

      // Fetch profile for classification
      const response = await fetch(`http://localhost:8000/structures/${pdbId}/profile`);
      if (!response.ok) throw new Error(`Failed to fetch profile`);

      const profile = await response.json();
      const classification = createClassificationFromProfile(profile);

      await molstarService.controller.loadStructure(pdbId, classification);
      await molstarService.viewer.representations.stylized_lighting();

      // Get chains
      const chainIds = molstarService.controller.getAllChains(pdbId);
      const chainData: ChainInfo[] = [];

      for (const ch of chainIds) {
        const obs = molstarService.controller.getObservedSequenceAndMapping(pdbId, ch);
        if (obs && obs.sequence.length > 0) {
          chainData.push({ id: ch, length: obs.sequence.length });
        }
      }

      setChains(chainData);
      setLoadedPdb(pdbId);
    } catch (err: any) {
      console.error('Load failed:', err);
      alert(`Failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAlign = async (chainId: string) => {
    if (!molstarService || !loadedPdb) return;

    try {
      await alignAndRegisterChain(loadedPdb, chainId, molstarService);
      await molstarService.controller.isolateChain(loadedPdb, chainId, true);
      setAlignedChains(prev => new Set([...prev, chainId]));
    } catch (err: any) {
      alert(`Align failed: ${err.message}`);
    }
  };

  return (
    <div className="text-xs">
      <div className="font-medium text-gray-700 mb-2">Load Structure</div>

      <div className="flex gap-1 mb-2">
        <input
          value={pdbInput}
          onChange={e => setPdbInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleLoad()}
          placeholder="PDB ID"
          className="flex-1 border rounded px-2 py-1 font-mono uppercase text-xs"
          disabled={loading}
        />
        <button
          onClick={handleLoad}
          disabled={loading || !molstarService || !pdbInput.trim()}
          className="px-2 py-1 bg-blue-600 text-white rounded text-xs disabled:bg-gray-400"
        >
          {loading ? '...' : 'Load'}
        </button>
      </div>

      {loadedPdb && chains.length > 0 && (
        <div>
          <div className="text-gray-600 mb-1">{loadedPdb} - {chains.length} chains</div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {chains.map(ch => {
              const isAligned = alignedChains.has(ch.id);
              const isProcessing = isAligning && currentChain === ch.id;

              return (
                <div
                  key={ch.id}
                  className={`flex justify-between items-center p-1 rounded border ${
                    isAligned ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <span className="font-mono">
                    {ch.id} <span className="text-gray-500">({ch.length})</span>
                  </span>
                  <button
                    onClick={() => handleAlign(ch.id)}
                    disabled={isAligned || isAligning}
                    className={`px-2 py-0.5 rounded text-xs ${
                      isAligned
                        ? 'bg-green-100 text-green-700'
                        : isProcessing
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-800 text-white hover:bg-black'
                    }`}
                  >
                    {isAligned ? 'Done' : isProcessing ? '...' : 'Align'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}