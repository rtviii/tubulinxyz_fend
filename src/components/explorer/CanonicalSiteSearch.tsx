import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Loader2, X, ChevronDown } from 'lucide-react';
import { useListLigandOptionsQuery } from '@/store/tubxz_api';
import { useDebounce } from '@/lib/useDebounce';
import { API_BASE_URL } from '@/config';
import type { ExplorerContext } from './types';
import type { StructureProfile } from '@/lib/profile_utils';
import { masterFrequenciesToColorings } from './heatmapColors';
import { getMolstarLigandColor } from '@/components/molstar/colors/palette';
import { createPortal } from 'react-dom';

// ────────────────────────────────────────────
// Types & helpers
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
    const result: Array<{
        family: string;
        chainId: string;
        masterToAuth: Record<string, number | null>;
    }> = [];

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

    const ligandColor = getMolstarLigandColor(chemicalId);
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

            const familyChains = chains.filter(c => c.family === family);
            for (const { chainId, masterToAuth } of familyChains) {
                allColorings.push(
                    ...masterFrequenciesToColorings(freqMap, masterToAuth, chainId, ligandColor)
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
// Inline ligand picker (the [TAXOL v] part)
// ────────────────────────────────────────────

function InlineLigandPicker({
  selectedId,
  selectedName,
  onSelect,
  disabled,
}: {
  selectedId: string | null;
  selectedName: string | null;
  onSelect: (chemId: string, chemName: string | null) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);
  const debouncedQuery = useDebounce(query, 200);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: options, isFetching } = useListLigandOptionsQuery(
    { search: debouncedQuery || undefined, limit: 8 },
    { skip: debouncedQuery.length < 2 || !open }
  );

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Calculate position when opening
  const openDropdown = useCallback(() => {
    if (disabled) return;
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 4, left: rect.left });
    }
    setOpen(true);
    setQuery('');
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [disabled]);

  const displayLabel = selectedName
    ? selectedName.length > 12 ? selectedId : selectedName
    : selectedId ?? 'TAXOL';

  return (
    <>
      <button
        ref={triggerRef}
        onClick={openDropdown}
        disabled={disabled}
        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-xs font-semibold text-gray-700 border border-gray-200 transition-colors cursor-pointer"
      >
        {displayLabel}
        <ChevronDown size={10} className="text-gray-400" />
      </button>

      {open && dropdownPos && createPortal(
        <div
          ref={dropdownRef}
          className="w-56 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden"
          style={{
            position: 'fixed',
            top: dropdownPos.top,
            left: dropdownPos.left,
            zIndex: 9999,
          }}
        >
          <div className="p-1.5 border-b border-gray-100">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Type to search..."
              className="w-full text-xs px-2 py-1 rounded border border-gray-200 outline-none focus:border-blue-300"
              autoFocus
            />
          </div>
          <div className="max-h-40 overflow-y-auto">
            {isFetching && (
              <div className="text-[10px] text-gray-400 text-center py-2">Searching...</div>
            )}
            {!isFetching && debouncedQuery.length < 2 && (
              <div className="text-[10px] text-gray-400 text-center py-2">Type 2+ characters...</div>
            )}
            {!isFetching && options?.data && options.data.length === 0 && debouncedQuery.length >= 2 && (
              <div className="text-[10px] text-gray-400 text-center py-2">No results</div>
            )}
            {options?.data?.map(lig => (
              <button
                key={lig.chemical_id}
                onClick={() => {
                  onSelect(lig.chemical_id, lig.chemical_name ?? null);
                  setOpen(false);
                  setQuery('');
                }}
                className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-blue-50 flex items-center justify-between"
              >
                <span className="truncate mr-2">
                  <span className="font-mono font-medium">{lig.chemical_id}</span>
                  {lig.chemical_name && (
                    <span className="text-gray-400 ml-1">{lig.chemical_name}</span>
                  )}
                </span>
                {lig.structure_count != null && (
                  <span className="text-[9px] text-gray-300 flex-shrink-0">
                    {lig.structure_count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

// ────────────────────────────────────────────
// Question-style component
// ────────────────────────────────────────────

interface CanonicalSiteQuestionProps {
    context: ExplorerContext;
    onActiveChange?: (active: boolean) => void;
}

export function CanonicalSiteQuestion({ context, onActiveChange }: CanonicalSiteQuestionProps) {
    const [selectedLigand, setSelectedLigand] = useState<{
        chemId: string;
        name: string | null;
    }>({ chemId: 'TA1', name: 'TAXOL' });

    const [isLoading, setIsLoading] = useState(false);
    const [activeResult, setActiveResult] = useState<{
        chemId: string;
        structureCount: number;
    } | null>(null);

    const chains = useMemo(
        () => getTubulinFamilyChainsWithMappings(context.profile),
        [context.profile]
    );

    if (chains.length === 0) return null;

    const isActive = activeResult !== null;

    const handleExecute = async () => {
        if (isActive) {
            // Toggle off
            await context.instance?.restoreDefaultColors();
            setActiveResult(null);
            onActiveChange?.(false);
            return;
        }

        setIsLoading(true);
        try {
            const result = await fetchAndPaint(context, selectedLigand.chemId, chains);
            if (result) {
                setActiveResult({ chemId: selectedLigand.chemId, structureCount: result.structureCount });
                onActiveChange?.(true);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleLigandChange = async (chemId: string, chemName: string | null) => {
        // If a result is active, clear it first
        if (activeResult) {
            await context.instance?.restoreDefaultColors();
            setActiveResult(null);
            onActiveChange?.(false);
        }
        setSelectedLigand({ chemId, name: chemName });
    };

    return (
        <div>
            <button
                onClick={handleExecute}
                disabled={isLoading}
                className={`w-full text-left px-2.5 py-2 rounded text-xs transition-colors ${isActive
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'text-gray-600 hover:bg-gray-50 border border-transparent'
                    }`}
            >
                <span className="flex items-center justify-between">
                    <span className="truncate">
                        Where does{' '}
                        <span onClick={e => e.stopPropagation()}>
                            <InlineLigandPicker
                                selectedId={selectedLigand.chemId}
                                selectedName={selectedLigand.name}
                                onSelect={handleLigandChange}
                                disabled={isLoading}
                            />
                        </span>
                        {' '}bind?
                    </span>
                    {isLoading && (
                        <Loader2 size={11} className="animate-spin flex-shrink-0 ml-1" />
                    )}
                    {isActive && !isLoading && (
                        <X size={11} className="flex-shrink-0 ml-1 text-blue-400" />
                    )}
                </span>
            </button>
            {activeResult && (
                <div className="text-[9px] text-blue-400 mt-0.5 ml-2.5">
                    Averaged across {activeResult.structureCount} structures
                </div>
            )}
        </div>
    );
}