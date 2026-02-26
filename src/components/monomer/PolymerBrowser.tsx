// src/components/monomer/PolymerBrowser.tsx
import { useMemo, useRef, useState, useCallback } from 'react';
import { Plus, Loader2, RotateCcw, X, ChevronUp, ChevronDown } from 'lucide-react';
import { usePolymerSearch } from '@/hooks/usePolymerSearch';
import { getHexForFamily, getHexForLigand } from '@/components/molstar/colors/palette';
import { LIGAND_IGNORE_IDS } from '@/components/molstar/colors/palette';
import { makeChainKey } from '@/lib/chain_key';
import type { PolypeptideEntitySummary } from '@/store/tubxz_api';

const TUBULIN_FAMILIES = [
  'tubulin_alpha', 'tubulin_beta', 'tubulin_gamma', 'tubulin_delta', 'tubulin_epsilon',
];

const FAMILY_LABEL: Record<string, string> = {
  tubulin_alpha: '\u03B1', tubulin_beta: '\u03B2', tubulin_gamma: '\u03B3',
  tubulin_delta: '\u03B4', tubulin_epsilon: '\u03B5',
};

const TAXA_PRESETS: { label: string; id: number }[] = [
  { label: 'Human', id: 9606 },
  { label: 'Mouse', id: 10090 },
  { label: 'Bovine', id: 9913 },
  { label: 'Pig', id: 9823 },
  { label: 'Yeast', id: 4932 },
];

const VARIANT_TYPES = [
  { value: '', label: 'Any' },
  { value: 'substitution', label: 'Substitutions' },
  { value: 'insertion', label: 'Insertions' },
  { value: 'deletion', label: 'Deletions' },
];

interface ChainRowData {
  entity: PolypeptideEntitySummary;
  chainId: string;
  chainKey: string;
}

type SortField = 'pdb' | 'chain' | 'family' | 'organism' | 'variants';
type SortDir = 'asc' | 'desc';

interface PolymerBrowserProps {
  defaultFamily?: string;
  alignedChainKeys: Set<string>;
  onSelectChain: (pdbId: string, chainId: string, family?: string) => void;
}

export function PolymerBrowser({ defaultFamily, alignedChainKeys, onSelectChain }: PolymerBrowserProps) {
  const {
    filters, lockedFamily, updateFilter, toggleFamily,
    addLigand, removeLigand, ligandSearch, setLigandSearch, ligandOptions,
    resetFilters, results, totalCount, hasMore, loadMore, isFetching, isError,
  } = usePolymerSearch(defaultFamily);

  const [ligandDropdownOpen, setLigandDropdownOpen] = useState(false);
  const ligandInputRef = useRef<HTMLInputElement>(null);
  const [sort, setSort] = useState<{ field: SortField; dir: SortDir }>({ field: 'pdb', dir: 'desc' });

  const chainRows = useMemo((): ChainRowData[] => {
    const rows: ChainRowData[] = [];
    for (const entity of results) {
      const chains = entity.pdbx_strand_ids?.length ? entity.pdbx_strand_ids : ['A'];
      for (const chainId of chains) {
        const key = makeChainKey(entity.parent_rcsb_id, chainId);
        if (alignedChainKeys.has(key)) continue;
        rows.push({ entity, chainId, chainKey: key });
      }
    }
    return rows;
  }, [results, alignedChainKeys]);

  const sortedRows = useMemo(() => {
    const sorted = [...chainRows];
    const { field, dir } = sort;
    const mul = dir === 'asc' ? 1 : -1;

    sorted.sort((a, b) => {
      switch (field) {
        case 'pdb':
          return mul * a.entity.parent_rcsb_id.localeCompare(b.entity.parent_rcsb_id);
        case 'chain':
          return mul * a.chainId.localeCompare(b.chainId);
        case 'family':
          return mul * (a.entity.family ?? '').localeCompare(b.entity.family ?? '');
        case 'organism': {
          const orgA = a.entity.src_organism_names?.[0] ?? '';
          const orgB = b.entity.src_organism_names?.[0] ?? '';
          return mul * orgA.localeCompare(orgB);
        }
        case 'variants':
          return mul * ((a.entity.variant_count ?? 0) - (b.entity.variant_count ?? 0));
        default:
          return 0;
      }
    });
    return sorted;
  }, [chainRows, sort]);

  const handleSort = useCallback((field: SortField) => {
    setSort(prev =>
      prev.field === field
        ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { field, dir: 'asc' }
    );
  }, []);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sort.field !== field) return null;
    return sort.dir === 'asc' ? <ChevronUp size={8} /> : <ChevronDown size={8} />;
  };

  return (
    <div className="flex flex-col h-full">
      {/* -- Filters -- */}
      <div className="space-y-2 pb-2.5 border-b border-gray-100 flex-shrink-0">
        {/* Row 1: Family + Organism */}
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="text-[9px] text-gray-400 uppercase tracking-wider font-medium">Family</label>
            <div className="flex flex-wrap gap-1 mt-0.5">
              {TUBULIN_FAMILIES.map(f => {
                const active = filters.family.includes(f);
                const hex = getHexForFamily(f);
                const locked = lockedFamily === f;
                return (
                  <button
                    key={f}
                    onClick={() => toggleFamily(f)}
                    disabled={!!lockedFamily}
                    className={`px-2 py-0.5 text-[10px] font-medium rounded-full border transition-colors
                      ${active ? 'text-white border-transparent' : 'text-gray-500 border-gray-200 bg-white'}
                      ${lockedFamily && !locked ? 'opacity-30' : ''}
                      ${!lockedFamily ? 'hover:border-gray-300' : ''}`}
                    style={active ? { backgroundColor: hex, borderColor: hex } : undefined}
                  >
                    {FAMILY_LABEL[f] ?? f}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex-1">
            <label className="text-[9px] text-gray-400 uppercase tracking-wider font-medium">Organism</label>
            <div className="flex flex-wrap gap-1 mt-0.5">
              {TAXA_PRESETS.map(t => {
                const active = filters.sourceTaxa.includes(t.id);
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      const next = active
                        ? filters.sourceTaxa.filter(x => x !== t.id)
                        : [...filters.sourceTaxa, t.id];
                      updateFilter('sourceTaxa', next);
                    }}
                    className={`px-2 py-0.5 text-[10px] rounded-full border transition-colors
                      ${active ? 'bg-gray-700 text-white border-gray-700' : 'text-gray-500 border-gray-200 hover:border-gray-300 bg-white'}`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Row 2: Ligands */}
        <div>
          <label className="text-[9px] text-gray-400 uppercase tracking-wider font-medium">Ligands</label>
          <div className="flex flex-wrap items-center gap-1 mt-0.5">
            {filters.ligands.map(lig => (
              <span
                key={lig}
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono rounded-full border"
                style={{
                  borderColor: getHexForLigand(lig),
                  backgroundColor: hexToRgba(getHexForLigand(lig), 0.1),
                }}
              >
                {lig}
                <button onClick={() => removeLigand(lig)} className="text-gray-400 hover:text-gray-600">
                  <X size={8} />
                </button>
              </span>
            ))}
            <div className="relative">
              <input
                ref={ligandInputRef}
                type="text"
                placeholder="Add ligand..."
                value={ligandSearch}
                onChange={e => { setLigandSearch(e.target.value); setLigandDropdownOpen(true); }}
                onFocus={() => { if (ligandSearch) setLigandDropdownOpen(true); }}
                onBlur={() => setTimeout(() => setLigandDropdownOpen(false), 150)}
                className="w-32 px-1.5 py-0.5 text-[10px] border border-gray-200 rounded bg-white"
              />
              {ligandDropdownOpen && ligandOptions.length > 0 && (
                <div className="absolute top-full left-0 mt-0.5 z-10 w-64 bg-white border border-gray-200 rounded shadow-lg max-h-40 overflow-y-auto">
                  {ligandOptions
                    .filter(o => !filters.ligands.includes(o.chemical_id) && !LIGAND_IGNORE_IDS.has(o.chemical_id))
                    .map(o => (
                      <button
                        key={o.chemical_id}
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => { addLigand(o.chemical_id); setLigandDropdownOpen(false); }}
                        className="w-full flex items-center gap-2 px-2 py-1 text-left hover:bg-gray-50 text-[10px]"
                      >
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: getHexForLigand(o.chemical_id) }}
                        />
                        <span className="font-mono font-medium">{o.chemical_id}</span>
                        <span className="text-gray-400 truncate flex-1">{o.chemical_name}</span>
                        {o.structure_count != null && (
                          <span className="text-gray-300 flex-shrink-0">{o.structure_count}s</span>
                        )}
                      </button>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Row 3: UniProt + Variants + MAPs + Count */}
        <div className="flex gap-2 items-end flex-wrap">
          <div className="w-36">
            <label className="text-[9px] text-gray-400 uppercase tracking-wider font-medium">UniProt</label>
            <input
              type="text"
              placeholder="e.g. P68363"
              value={filters.uniprot}
              onChange={e => updateFilter('uniprot', e.target.value)}
              className="mt-0.5 w-full px-2 py-1 text-[10px] border border-gray-200 rounded bg-white"
            />
          </div>
          <div>
            <label className="text-[9px] text-gray-400 uppercase tracking-wider font-medium">Variant type</label>
            <select
              value={filters.variantType ?? ''}
              onChange={e => updateFilter('variantType', e.target.value || null)}
              className="mt-0.5 px-1.5 py-1 text-[10px] border border-gray-200 rounded bg-white text-gray-600"
            >
              {VARIANT_TYPES.map(vt => (
                <option key={vt.value} value={vt.value}>{vt.label}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-1 items-end">
            <div className="w-14">
              <label className="text-[9px] text-gray-400 uppercase tracking-wider font-medium">Pos min</label>
              <input
                type="number"
                value={filters.variantPosMin ?? ''}
                onChange={e => updateFilter('variantPosMin', e.target.value ? parseInt(e.target.value) : null)}
                className="mt-0.5 w-full px-1 py-1 text-[10px] border border-gray-200 rounded bg-white"
              />
            </div>
            <div className="w-14">
              <label className="text-[9px] text-gray-400 uppercase tracking-wider font-medium">Pos max</label>
              <input
                type="number"
                value={filters.variantPosMax ?? ''}
                onChange={e => updateFilter('variantPosMax', e.target.value ? parseInt(e.target.value) : null)}
                className="mt-0.5 w-full px-1 py-1 text-[10px] border border-gray-200 rounded bg-white"
              />
            </div>
          </div>
          <label className="flex items-center gap-1 pb-0.5 text-[10px] text-gray-500 cursor-pointer select-none whitespace-nowrap">
            <input
              type="checkbox"
              checked={filters.excludeMaps}
              onChange={e => updateFilter('excludeMaps', e.target.checked)}
              className="rounded"
            />
            No MAPs
          </label>
          <div className="flex items-center gap-1.5 pb-0.5 ml-auto">
            <span className="text-[10px] text-gray-400 whitespace-nowrap">
              {isFetching ? '...' : `${totalCount} entities`}
            </span>
            <button onClick={resetFilters} className="p-0.5 text-gray-300 hover:text-gray-500" title="Reset">
              <RotateCcw size={10} />
            </button>
          </div>
        </div>
      </div>

      {/* -- Column headers (sortable) -- */}
      <div className="flex items-center gap-2 px-2 py-1 text-[8px] text-gray-300 uppercase tracking-wider border-b border-gray-50 flex-shrink-0 select-none">
        <SortableHeader field="pdb" label="PDB" width="w-14" sort={sort} onSort={handleSort} />
        <SortableHeader field="chain" label="Ch" width="w-5" sort={sort} onSort={handleSort} />
        <SortableHeader field="family" label="Fam" width="w-6" sort={sort} onSort={handleSort} />
        <SortableHeader field="organism" label="Organism" width="flex-1 min-w-0" sort={sort} onSort={handleSort} />
        <span className="w-28">Ligands</span>
        <SortableHeader field="variants" label="Var" width="w-8 text-right" sort={sort} onSort={handleSort} />
        <span className="w-6" />
      </div>

      {/* -- Results (scrollable) -- */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {isError ? (
          <p className="text-[10px] text-red-500 text-center py-4">Failed to load</p>
        ) : sortedRows.length === 0 && !isFetching ? (
          <p className="text-[10px] text-gray-400 text-center py-6">No matching chains</p>
        ) : (
          sortedRows.map(row => (
            <PolymerChainRow
              key={row.chainKey}
              entity={row.entity}
              chainId={row.chainId}
              onSelect={() => onSelectChain(row.entity.parent_rcsb_id, row.chainId, row.entity.family ?? undefined)}
            />
          ))
        )}

        {isFetching && (
          <div className="flex justify-center py-3">
            <Loader2 size={14} className="animate-spin text-gray-300" />
          </div>
        )}

        {hasMore && !isFetching && (
          <button
            onClick={loadMore}
            className="w-full py-1.5 text-[10px] text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded"
          >
            Load more
          </button>
        )}
      </div>
    </div>
  );
}

// -- Sortable header component --

function SortableHeader({
  field, label, width, sort, onSort,
}: {
  field: SortField;
  label: string;
  width: string;
  sort: { field: SortField; dir: SortDir };
  onSort: (field: SortField) => void;
}) {
  const active = sort.field === field;
  return (
    <button
      onClick={() => onSort(field)}
      className={`${width} flex items-center gap-0.5 hover:text-gray-500 transition-colors ${active ? 'text-gray-500' : ''}`}
    >
      {label}
      {active && (sort.dir === 'asc' ? <ChevronUp size={8} /> : <ChevronDown size={8} />)}
    </button>
  );
}

// -- Result row --

function PolymerChainRow({
  entity,
  chainId,
  onSelect,
}: {
  entity: PolypeptideEntitySummary;
  chainId: string;
  onSelect: () => void;
}) {
  const familyHex = getHexForFamily(entity.family);
  const familyLabel = entity.family
    ? (FAMILY_LABEL[entity.family] ?? entity.family.replace('tubulin_', '').replace('map_', ''))
    : '?';
  const organism = entity.src_organism_names?.[0];
  const shortOrganism = organism ? organism.split(' ').slice(0, 2).join(' ') : '';
  const ligands = (entity.ligand_ids ?? []).filter(l => !LIGAND_IGNORE_IDS.has(l));

  return (
    <div className="group flex items-center gap-2 px-2 py-1 hover:bg-gray-50 border-b border-gray-50 text-[10px]">
      <span className="w-14 font-mono font-medium text-gray-700 flex-shrink-0">{entity.parent_rcsb_id}</span>
      <span className="w-5 font-mono text-gray-500 flex-shrink-0">{chainId}</span>
      <span
        className="w-6 text-center font-medium flex-shrink-0"
        style={{ color: familyHex }}
        title={entity.family ?? undefined}
      >
        {familyLabel}
      </span>
      <span className="flex-1 min-w-0 text-gray-400 italic truncate" title={organism ?? undefined}>
        {shortOrganism}
      </span>

      <div className="w-28 flex flex-wrap gap-0.5 flex-shrink-0">
        {ligands.map(lig => (
          <span
            key={lig}
            className="px-1 py-px text-[8px] font-mono rounded border"
            style={{
              borderColor: hexToRgba(getHexForLigand(lig), 0.4),
              color: getHexForLigand(lig),
            }}
            title={lig}
          >
            {lig}
          </span>
        ))}
      </div>

      <span className="w-8 text-right flex-shrink-0">
        {entity.variant_count != null && entity.variant_count > 0 ? (
          <span className="text-orange-400">{entity.variant_count}</span>
        ) : (
          <span className="text-gray-200">0</span>
        )}
      </span>

      <button
        onClick={onSelect}
        className="w-6 h-5 flex items-center justify-center text-gray-300 hover:text-blue-600 hover:bg-blue-50 rounded opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
        title={`Align ${entity.parent_rcsb_id}:${chainId}`}
      >
        <Plus size={11} />
      </button>
    </div>
  );
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return `rgba(128,128,128,${alpha})`;
  return `rgba(${r},${g},${b},${alpha})`;
}