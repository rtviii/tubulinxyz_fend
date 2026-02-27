// src/components/explorer/CanonicalSiteSearch.tsx

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { useListLigandOptionsQuery } from '@/store/tubxz_api';
import { useDebounce } from '@/lib/useDebounce';
import { API_BASE_URL } from '@/config';
import type { ExplorerContext } from './types';
import type { StructureProfile } from '@/lib/profile_utils';
import { masterFrequenciesToColorings } from './heatmapColors';

// ────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────

interface CanonicalSiteResponse {
  chemical_id: string;
  chemical_name: string | null;
  family: string;
  structure_count: number;
  residues: Array<{ master_index: number; count: number; frequency: number }>;
}

function getTubulinFamilyChainsWithMappings(
  profile: StructureProfile | null
): Array<{
  family: string;
  chainId: string;
  masterToAuth: Record<string, number | null>;
}> {
  if (!profile) return [];
  const result: typeof ret = [];
  const ret = result; // just for type inference

  for (const poly of profile.polypeptides) {
    const entity = profile.entities[poly.entity_id];
    if (!entity || !('family' in entity) || !entity.family) continue;
    const family = entity.family as string;
    if (!family.startsWith('tubulin_')) continue;
    if (!('chain_index_mappings' in entity) || !entity.chain_index_mappings) continue;

    const mapping = entity.chain_index_mappings[poly.auth_asym_id];
    if (!mapping) continue;

    result.push({
      family,
      chainId: poly.auth_asym_id,
      masterToAuth: mapping.master_to_auth_seq_id,
    });
  }

  return result;
}

async function fetchAndPaint(
  ctx: ExplorerContext,
  chemicalId: string,
  chains: ReturnType<typeof getTubulinFamilyChainsWithMappings>
): Promise<{ structureCount: number; residueCount: number } | null> {
  if (!ctx.instance || chains.length === 0) return null;

  // Group chains by family so we make one fetch per family
  const familySet = new Set(chains.map(c => c.family));
  const allColorings: Array<{ chainId: string; authSeqId: number; color: any }> = [];
  let totalStructures = 0;

  for (const family of familySet) {
    try {
      const res = await fetch(
        `${API_BASE_URL}/ligands/canonical-site/${encodeURIComponent(chemicalId)}/${encodeURIComponent(family)}`
      );
      if (!res.ok) continue;
      const data: CanonicalSiteResponse = await res.json();
      totalStructures = Math.max(totalStructures, data.structure_count);

      const freqMap = new Map<number, number>();
      for (const r of data.residues) {
        freqMap.set(r.master_index, r.frequency);
      }

      // Map onto every chain of this family in the current structure
      const familyChains = chains.filter(c => c.family === family);
      for (const { chainId, masterToAuth } of familyChains) {
        allColorings.push(
          ...masterFrequenciesToColorings(freqMap, masterToAuth, chainId)
        );
      }
    } catch {
      continue;
    }
  }

  if (allColorings.length === 0) return null;

  await ctx.instance.applyColorscheme(`canonical-site-${chemicalId}`, allColorings);
  return { structureCount: totalStructures, residueCount: allColorings.length };
}

// ────────────────────────────────────────────
// Component
// ────────────────────────────────────────────

interface CanonicalSiteSearchProps {
  context: ExplorerContext;
  onActiveChange?: (active: boolean) => void;
}

export function CanonicalSiteSearch({ context, onActiveChange }: CanonicalSiteSearchProps) {
  const [inputValue, setInputValue] = useState('taxol');
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeResult, setActiveResult] = useState<{
    chemId: string;
    name: string | null;
    structureCount: number;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedQuery = useDebounce(inputValue, 250);

  const chains = useMemo(
    () => getTubulinFamilyChainsWithMappings(context.profile),
    [context.profile]
  );

  const { data: options, isFetching } = useListLigandOptionsQuery(
    { search: debouncedQuery || undefined, limit: 8 },
    { skip: debouncedQuery.length < 2 || !!activeResult }
  );

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = useCallback(
    async (chemId: string, chemName: string | null) => {
      setIsOpen(false);
      setInputValue(chemName ? `${chemName} (${chemId})` : chemId);
      setIsLoading(true);

      try {
        const result = await fetchAndPaint(context, chemId, chains);
        if (result) {
          setActiveResult({ chemId, name: chemName, structureCount: result.structureCount });
          onActiveChange?.(true);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [context, chains, onActiveChange]
  );

  const handleClear = useCallback(async () => {
    await context.instance?.restoreDefaultColors();
    setActiveResult(null);
    setInputValue('');
    onActiveChange?.(false);
    inputRef.current?.focus();
  }, [context.instance, onActiveChange]);

  if (chains.length === 0) return null;

  return (
    <div ref={containerRef} className="relative">
      <label className="text-[10px] text-gray-400 mb-0.5 block">
        Binding site heatmap
      </label>

      <div className="flex items-center gap-1">
        <div className="relative flex-1">
          <Search
            size={11}
            className="absolute left-1.5 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none"
          />
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={e => {
              setInputValue(e.target.value);
              setIsOpen(true);
              if (activeResult) {
                // User is editing while a result is active -- clear it
                context.instance?.restoreDefaultColors();
                setActiveResult(null);
                onActiveChange?.(false);
              }
            }}
            onFocus={() => {
              if (!activeResult && inputValue.length >= 2) setIsOpen(true);
            }}
            placeholder="Search ligand..."
            className={`w-full text-xs pl-6 pr-2 py-1 rounded border outline-none transition-colors ${
              activeResult
                ? 'border-blue-300 bg-blue-50 text-blue-700'
                : 'border-gray-200 bg-white text-gray-700 focus:border-blue-300'
            }`}
          />
          {isLoading && (
            <Loader2
              size={11}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 animate-spin text-blue-400"
            />
          )}
        </div>

        {activeResult && (
          <button
            onClick={handleClear}
            className="p-1 text-blue-400 hover:text-blue-600 flex-shrink-0"
            title="Clear heatmap"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* Active result info */}
      {activeResult && (
        <div className="text-[10px] text-blue-500 mt-0.5">
          Averaged across {activeResult.structureCount} structures
        </div>
      )}

      {/* Autocomplete dropdown */}
      {isOpen && !activeResult && options?.data && options.data.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-0.5 bg-white border border-gray-200 rounded shadow-lg max-h-48 overflow-y-auto">
          {options.data.map(lig => (
            <button
              key={lig.chemical_id}
              onClick={() => handleSelect(lig.chemical_id, lig.chemical_name ?? null)}
              className="w-full text-left px-2 py-1.5 text-xs hover:bg-blue-50 flex items-center justify-between"
            >
              <span className="truncate mr-2">
                <span className="font-mono font-medium">{lig.chemical_id}</span>
                {lig.chemical_name && (
                  <span className="text-gray-400 ml-1">{lig.chemical_name}</span>
                )}
              </span>
              {lig.structure_count != null && (
                <span className="text-[9px] text-gray-300 flex-shrink-0">
                  {lig.structure_count} structs
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {isOpen && !activeResult && isFetching && (
        <div className="absolute z-50 left-0 right-0 mt-0.5 bg-white border border-gray-200 rounded shadow-sm p-2">
          <div className="text-[10px] text-gray-400 text-center">Searching...</div>
        </div>
      )}
    </div>
  );
}