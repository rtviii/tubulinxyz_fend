// src/app/msalite/components/ChainAligner.tsx
'use client';

import { useState, useCallback } from 'react';
import { MolstarInstance } from '@/components/molstar/services/MolstarInstance';
import { useChainAlignment } from '../../../hooks/useChainAlignment';
import { useAppSelector } from '@/store/store';
import { selectIsChainAligned } from '@/store/slices/sequence_registry';

interface ChainAlignerProps {
  molstarInstance: MolstarInstance | null;
  onLog?: (message: string) => void;
}

interface ChainInfo {
  id: string;
  length: number;
  sequence: string;
  family?: string;
}

export function ChainAligner({ molstarInstance, onLog }: ChainAlignerProps) {
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
    if (!molstarInstance || !pdbInput.trim()) return;

    const pdbId = pdbInput.trim().toUpperCase();
    setIsLoading(true);
    setChains([]);
    setLoadedPdbId(null);

    try {
      log(`Loading ${pdbId}...`);

      // Fetch profile for classification AND family info
      let classification: Record<string, string> = {};
      let familyMap: Record<string, string> = {};  // chainId -> family

      try {
        const response = await fetch(`http://localhost:8000/structures/${pdbId}/profile`);
        if (response.ok) {
          const profile = await response.json();

          // Build classification and family maps from profile
          if (profile.polypeptides && profile.entities) {
            for (const poly of profile.polypeptides) {
              const entity = profile.entities[poly.entity_id];
              if (entity?.family) {
                classification[poly.auth_asym_id] = entity.family;
                familyMap[poly.auth_asym_id] = entity.family;
              }
            }
          }
        }
      } catch {
        // Profile fetch is optional
      }

      await molstarInstance.loadStructure(pdbId, classification);

      const chainIds = molstarInstance.getAllChainIds();
      const chainInfos: ChainInfo[] = [];

      for (const chainId of chainIds) {
        const observed = molstarInstance.getObservedSequence(chainId);
        if (observed && observed.sequence.length > 0) {
          chainInfos.push({
            id: chainId,
            length: observed.sequence.length,
            sequence: observed.sequence,
            family: familyMap[chainId],
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

  const handleAlignChain = async (chain: ChainInfo) => {
    if (!molstarInstance || !loadedPdbId) return;

    try {
      log(`Aligning ${loadedPdbId}:${chain.id}...`);
      const result = await alignChain(loadedPdbId, chain.id, molstarInstance, chain.family);
      log(`Aligned ${result.sequenceId}: ${Object.keys(result.mapping).length} mapped positions`);
    } catch (err: any) {
      log(`Alignment failed: ${err.message}`);
    }
  };

  return (
    <div className="flex flex-col gap-3">
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
          disabled={isLoading || !molstarInstance || !pdbInput.trim()}
          className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:bg-gray-400"
        >
          {isLoading ? '...' : 'Load'}
        </button>
      </div>

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
                onAlign={() => handleAlignChain(chain)}
              />
            ))}
          </div>
        </div>
      )}

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

  // Format family for display
  const familyLabel = chain.family ? formatFamilyShort(chain.family) : null;

  return (
    <div className={`flex items-center justify-between p-1.5 rounded text-xs ${isAligned ? 'bg-green-100' : 'bg-white'
      }`}>
      <div className="flex items-center gap-2">
        <span className={`font-mono font-medium ${isAligned ? 'text-green-700' : 'text-gray-700'}`}>
          {chain.id}
        </span>
        <span className="text-gray-500">{chain.length} aa</span>
        {familyLabel && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-gray-200 text-gray-600">
            {familyLabel}
          </span>
        )}
      </div>
      <button
        onClick={onAlign}
        disabled={isAligned || isAligning}
        className={`px-2 py-0.5 rounded text-xs ${isAligned
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

function formatFamilyShort(family: string): string {
  const tubulinMatch = family.match(/^tubulin_(\w+)$/);
  if (tubulinMatch) {
    return tubulinMatch[1].charAt(0).toUpperCase() + tubulinMatch[1].slice(1);
  }
  const mapMatch = family.match(/^map_(\w+)/);
  if (mapMatch) {
    return mapMatch[1].toUpperCase();
  }
  return family;
}