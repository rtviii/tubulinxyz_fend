// src/components/monomer/PolymerBrowser.tsx
import { useMemo, useState, useCallback } from 'react';
import { Plus, Loader2, ChevronUp, ChevronDown } from 'lucide-react';
import { Select, TreeSelect } from 'antd';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible';
import { usePolymerSearch } from '@/hooks/usePolymerSearch';
import { getHexForFamily, getHexForIsotype, getHexForLigand } from '@/components/molstar/colors/palette';
import { LIGAND_IGNORE_IDS } from '@/components/molstar/colors/palette';
import { makeChainKey } from '@/lib/chain_key';
import type { PolypeptideEntitySummary } from '@/store/tubxz_api';
import { useGetStructureFacetsQuery, useGetTaxonomyTreeQuery } from '@/store/tubxz_api';

// ── Constants ──

const TUBULIN_FAMILIES = [
  'tubulin_alpha', 'tubulin_beta', 'tubulin_gamma', 'tubulin_delta', 'tubulin_epsilon',
] as const;

const FAMILY_SYMBOL: Record<string, string> = {
  tubulin_alpha: '\u03B1', tubulin_beta: '\u03B2', tubulin_gamma: '\u03B3',
  tubulin_delta: '\u03B4', tubulin_epsilon: '\u03B5',
};

const FAMILY_GHOST_HEX: Record<string, string> = {
  tubulin_alpha: '#D4C4A8',
  tubulin_beta: '#B8C4D0',
  tubulin_gamma: '#A07CC0',
  tubulin_delta: '#5EAB70',
  tubulin_epsilon: '#D4C060',
};

const ISOTYPE_FAMILY: Record<string, string> = {
  TUBA: 'tubulin_alpha',
  TUBB: 'tubulin_beta',
  TUBG: 'tubulin_gamma',
  TUBD: 'tubulin_delta',
  TUBE: 'tubulin_epsilon',
};

const VARIANT_TYPE_STYLE: Record<string, { label: string; color: string }> = {
  substitution: { label: 'sub', color: '#f97316' },
  insertion: { label: 'ins', color: '#22c55e' },
  deletion: { label: 'del', color: '#ef4444' },
};

function formatFamilyLabel(f: string) {
  const special: Record<string, string> = {
    map_eb_family: 'EB family', map_ckap5_chtog: 'CKAP5/ch-TOG',
    map_ttll_glutamylase_short: 'TTLL glut. (short)',
    map_ttll_glutamylase_long: 'TTLL glut. (long)',
    map_ccp_deglutamylase: 'CCP deglut.',
  };
  if (special[f]) return special[f];
  return f.replace(/^map_/, '').split('_')
    .map(w => (w.length <= 3 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)))
    .join(' ');
}

// ── Types ──

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

// ── Main Component ──

export function PolymerBrowser({ defaultFamily, alignedChainKeys, onSelectChain }: PolymerBrowserProps) {
  const {
    filters, lockedFamily, updateFilter, toggleFamily,
    resetFilters, results, totalCount, hasMore, loadMore, isFetching, isError,
  } = usePolymerSearch(defaultFamily);

  const { data: facets } = useGetStructureFacetsQuery();
  const { data: sourceTaxTree } = useGetTaxonomyTreeQuery({ taxType: 'source' });

  const [posOpen, setPosOpen] = useState(false);
  const [sort, setSort] = useState<{ field: SortField; dir: SortDir }>({ field: 'pdb', dir: 'desc' });

  // ── Derived data ──

  const familyItems = useMemo(
    () => (facets?.tubulin_families ?? [])
      .filter((f: any) => (TUBULIN_FAMILIES as readonly string[]).includes(f.value))
      .map((f: any) => ({ value: f.value, count: f.count as number })),
    [facets]
  );

  const isotopeItems = useMemo(() => {
    const all = (facets?.isotypes ?? []).map((i: any) => ({ value: i.value, count: i.count as number }));
    const selectedFamilies = filters.family.filter(f => (TUBULIN_FAMILIES as readonly string[]).includes(f));
    if (selectedFamilies.length === 0) return all;
    return all.filter(iso => {
      const prefix = Object.keys(ISOTYPE_FAMILY).find(p => iso.value.startsWith(p));
      if (!prefix) return true;
      return selectedFamilies.includes(ISOTYPE_FAMILY[prefix]);
    });
  }, [facets, filters.family]);

  // Combined ligand + MAP options (same pattern as StructureFiltersPanel)
  const combinedOptions = useMemo(() => {
    const mapOpts = (facets?.tubulin_families ?? [])
      .filter((f: any) => !(TUBULIN_FAMILIES as readonly string[]).includes(f.value))
      .map((f: any) => ({
        value: `map:${f.value}`,
        label: formatFamilyLabel(f.value),
        count: f.count,
        kind: 'map' as const,
      }));
    const ligOpts = (facets?.top_ligands ?? [])
      .filter((l: any) => !LIGAND_IGNORE_IDS.has(l.chemical_id))
      .map((l: any) => ({
        value: `lig:${l.chemical_id}`,
        label: `${l.chemical_id} -- ${(l.chemical_name ?? '').toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase())}`,
        count: l.count,
        kind: 'ligand' as const,
      }));
    return [...mapOpts, ...ligOpts];
  }, [facets]);

  const combinedValue = useMemo(() => {
    const mapVals = filters.family.filter(f => f.startsWith('map_')).map(f => `map:${f}`);
    const ligVals = filters.ligands.map(l => `lig:${l}`);
    return [...mapVals, ...ligVals];
  }, [filters.family, filters.ligands]);

  const handleCombinedChange = (values: string[]) => {
    const maps = values.filter(v => v.startsWith('map:')).map(v => v.slice(4));
    const ligs = values.filter(v => v.startsWith('lig:')).map(v => v.slice(4));
    const tubulinFams = filters.family.filter(f => !f.startsWith('map_'));
    updateFilter('family', [...tubulinFams, ...maps]);
    updateFilter('ligands', ligs);
  };

  // ── Sorting ──

  const chainRows = useMemo((): ChainRowData[] => {
    const rows: ChainRowData[] = [];
    for (const entity of results) {
      const rawChains = entity.pdbx_strand_ids?.length ? entity.pdbx_strand_ids : ['A'];
      const chains = rawChains.flatMap(s => s.split(',').map(x => x.trim()).filter(Boolean));
      console.debug('[PolymerBrowser] strand ids', entity.parent_rcsb_id, entity.pdbx_strand_ids, '=>', chains);
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
        case 'pdb': return mul * a.entity.parent_rcsb_id.localeCompare(b.entity.parent_rcsb_id);
        case 'chain': return mul * a.chainId.localeCompare(b.chainId);
        case 'family': return mul * (a.entity.family ?? '').localeCompare(b.entity.family ?? '');
        case 'organism': {
          const orgA = a.entity.src_organism_names?.[0] ?? '';
          const orgB = b.entity.src_organism_names?.[0] ?? '';
          return mul * orgA.localeCompare(orgB);
        }
        case 'variants': return mul * ((a.entity.variant_count ?? 0) - (b.entity.variant_count ?? 0));
        default: return 0;
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

  const handleFamilyToggle = (family: string) => {
    toggleFamily(family);
    const newFamilies = filters.family.includes(family)
      ? filters.family.filter(f => f !== family)
      : [...filters.family, family];
    const selectedTubulin = newFamilies.filter(f => (TUBULIN_FAMILIES as readonly string[]).includes(f));
    if (selectedTubulin.length > 0 && filters.isotype.length > 0) {
      const validIsotypes = filters.isotype.filter(iso => {
        const prefix = Object.keys(ISOTYPE_FAMILY).find(p => iso.startsWith(p));
        if (!prefix) return true;
        return selectedTubulin.includes(ISOTYPE_FAMILY[prefix]);
      });
      if (validIsotypes.length !== filters.isotype.length) {
        updateFilter('isotype', validIsotypes);
      }
    }
  };

  const toggleInArray = (arr: string[], value: string) =>
    arr.includes(value) ? arr.filter(x => x !== value) : [...arr, value];

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ── Compact filters ── */}
      <div className="flex-shrink-0 space-y-1.5 pb-2 border-b border-gray-100 overflow-y-auto" style={{ maxHeight: '50%' }}>
        {/* Row: count + reset */}
        <div className="flex items-center justify-between">
          <span className="text-[9px] text-gray-400 tabular-nums">
            {isFetching ? '...' : `${totalCount.toLocaleString()} entities`}
          </span>
          <button
            onClick={resetFilters}
            className="text-[8px] text-gray-300 hover:text-gray-500 uppercase tracking-wider font-medium"
          >
            reset
          </button>
        </div>

        {/* Family pills */}
        <div className="flex flex-wrap gap-0.5">
          {familyItems.map(item => {
            const vivid = getHexForFamily(item.value);
            const ghost = FAMILY_GHOST_HEX[item.value] ?? vivid;
            const active = filters.family.includes(item.value);
            const locked = lockedFamily === item.value;
            return (
              <button
                key={item.value}
                onClick={() => handleFamilyToggle(item.value)}
                disabled={!!lockedFamily}
                className={`px-1.5 py-px text-[9px] font-medium rounded-full border transition-all
                  ${lockedFamily && !locked ? 'opacity-30' : ''} ${!!lockedFamily ? 'cursor-not-allowed' : ''}`}
                style={active ? {
                  borderColor: ghost,
                  backgroundColor: `${ghost}18`,
                  color: ghost,
                  boxShadow: `0 0 6px ${ghost}30`,
                } : {
                  borderColor: `${vivid}35`,
                  backgroundColor: 'white',
                  color: '#9ca3af',
                }}
                title={`${item.count} structures`}
              >
                {FAMILY_SYMBOL[item.value] ?? item.value}
                <span className="ml-0.5 text-[7px] opacity-60">{item.count}</span>
              </button>
            );
          })}
        </div>

        {/* Isotype pills */}
        {isotopeItems.length > 0 && (() => {
          type IsoItem = { value: string; count: number };
          const alphaIso = isotopeItems.filter((i: IsoItem) => i.value.startsWith('TUBA'));
          const betaIso = isotopeItems.filter((i: IsoItem) => i.value.startsWith('TUBB'));
          const otherIso = isotopeItems.filter((i: IsoItem) => !i.value.startsWith('TUBA') && !i.value.startsWith('TUBB'));
          const renderPills = (items: IsoItem[]) => items.map((item: IsoItem) => (
            <button
              key={item.value}
              onClick={() => updateFilter('isotype', toggleInArray(filters.isotype, item.value))}
              className="px-1 py-px text-[8px] font-medium rounded-full border transition-all"
              style={filters.isotype.includes(item.value) ? {
                borderColor: getHexForIsotype(item.value),
                backgroundColor: `${getHexForIsotype(item.value)}18`,
                color: getHexForIsotype(item.value),
              } : {
                borderColor: `${getHexForIsotype(item.value)}30`,
                backgroundColor: 'white',
                color: '#9ca3af',
              }}
            >
              {item.value}
              <span className="ml-0.5 text-[7px] opacity-60">{item.count}</span>
            </button>
          ));
          return (
            <div className="space-y-0.5">
              {alphaIso.length > 0 && (
                <div className="flex items-center gap-1">
                  <span className="text-[7px] text-gray-300 font-medium w-2.5 flex-shrink-0">{'\u03B1'}</span>
                  <div className="flex flex-wrap gap-px">{renderPills(alphaIso)}</div>
                </div>
              )}
              {betaIso.length > 0 && (
                <div className="flex items-center gap-1">
                  <span className="text-[7px] text-gray-300 font-medium w-2.5 flex-shrink-0">{'\u03B2'}</span>
                  <div className="flex flex-wrap gap-px">{renderPills(betaIso)}</div>
                </div>
              )}
              {otherIso.length > 0 && (
                <div className="flex flex-wrap gap-px">{renderPills(otherIso)}</div>
              )}
            </div>
          );
        })()}

        {/* Ligands / MAPs combined select */}
        <div>
          <label className="text-[8px] font-semibold uppercase tracking-wider text-gray-400">Binds Ligands / MAPs</label>
          <Select
            mode="multiple"
            style={{ width: '100%' }}
            placeholder="Search ligands or MAPs..."
            value={combinedValue}
            onChange={handleCombinedChange}
            allowClear
            size="small"
            showSearch
            filterOption={(input, option) =>
              String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
            optionRender={(option) => {
              const data = option.data as any;
              const isMap = String(data.value).startsWith('map:');
              return (
                <div className="flex items-center gap-1.5 text-[10px]">
                  {isMap ? (
                    <img src="/landing/ligand_icon.svg" alt="" className="w-3 h-3 opacity-40 grayscale" />
                  ) : (
                    <span className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: getHexForLigand(String(data.value).replace('lig:', '')) }} />
                  )}
                  <span className={`truncate ${isMap ? 'text-violet-600' : ''}`}>{data.label}</span>
                  {data.count != null && (
                    <span className="ml-auto text-gray-300 flex-shrink-0">{data.count}</span>
                  )}
                </div>
              );
            }}
            tagRender={(props) => {
              const { label, value, closable, onClose } = props;
              const isMap = String(value).startsWith('map:');
              return (
                <span className={`inline-flex items-center gap-0.5 px-1.5 py-px text-[8px] font-medium rounded-full mr-0.5 my-px border
                  ${isMap ? 'bg-violet-50 border-violet-200 text-violet-600' : 'bg-emerald-50 border-emerald-200 text-emerald-600'}`}
                >
                  {isMap ? formatFamilyLabel(String(value).replace('map:', '')) : String(value).replace('lig:', '')}
                  {closable && <button onClick={onClose} className="ml-0.5 hover:opacity-70">&times;</button>}
                </span>
              );
            }}
            options={combinedOptions.map(o => ({ value: o.value, label: o.label, count: o.count }))}
          />
        </div>

        {/* Source organism + UniProt on one row */}
        <div className="grid grid-cols-[1fr_120px] gap-1.5">
          <div>
            <label className="text-[8px] font-semibold uppercase tracking-wider text-gray-400">Organism</label>
            <TreeSelect
              style={{ width: '100%' }}
              value={filters.sourceTaxa}
              styles={{ popup: { root: { maxHeight: 400, overflow: 'auto' } } }}
              placeholder="All species"
              multiple allowClear treeCheckable
              showCheckedStrategy={TreeSelect.SHOW_PARENT}
              treeData={sourceTaxTree ?? []}
              onChange={(v) => updateFilter('sourceTaxa', v)}
              size="small" showSearch treeNodeFilterProp="title"
            />
          </div>
          <div>
            <label className="text-[8px] font-semibold uppercase tracking-wider text-gray-400">UniProt</label>
            <input
              type="text"
              placeholder="P68363"
              value={filters.uniprot}
              onChange={e => updateFilter('uniprot', e.target.value)}
              className="w-full h-[24px] px-1.5 text-[10px] border border-gray-200 rounded bg-white"
            />
          </div>
        </div>

        {/* Annotations: variant type + position */}
        <Collapsible open={posOpen} onOpenChange={setPosOpen}>
          <div className="flex items-center gap-1.5">
            <label className="text-[8px] font-semibold uppercase tracking-wider text-gray-400 flex-shrink-0">Variants</label>
            <div className="flex gap-px flex-1">
              {Object.entries(VARIANT_TYPE_STYLE).map(([value, { label, color }]) => {
                const active = filters.variantType === value;
                return (
                  <button
                    key={value}
                    onClick={() => updateFilter('variantType', active ? null : value)}
                    className="flex-1 py-px text-[8px] font-medium rounded transition-colors border"
                    style={active ? {
                      borderColor: color,
                      backgroundColor: `${color}15`,
                      color: color,
                    } : {
                      borderColor: '#f3f4f6',
                      backgroundColor: 'white',
                      color: '#d1d5db',
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <CollapsibleTrigger className="p-0.5 text-gray-300 hover:text-gray-400 transition-colors">
              <ChevronDown className={`h-2.5 w-2.5 transition-transform ${posOpen ? '' : '-rotate-90'}`} />
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent>
            <div className="flex items-center gap-1 mt-1">
              <span className="text-[8px] text-gray-300 w-6 flex-shrink-0">Pos</span>
              <input type="number" placeholder="Min"
                value={filters.variantPosMin ?? ''}
                onChange={e => updateFilter('variantPosMin', e.target.value ? parseInt(e.target.value) : null)}
                className="flex-1 px-1 py-0.5 text-[9px] border border-gray-200 rounded bg-white h-5" />
              <span className="text-gray-300 text-[8px]">--</span>
              <input type="number" placeholder="Max"
                value={filters.variantPosMax ?? ''}
                onChange={e => updateFilter('variantPosMax', e.target.value ? parseInt(e.target.value) : null)}
                className="flex-1 px-1 py-0.5 text-[9px] border border-gray-200 rounded bg-white h-5" />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* ── Column headers ── */}
      <div className="flex items-center gap-2 px-2 py-1 text-[8px] text-gray-300 uppercase tracking-wider border-b border-gray-50 flex-shrink-0 select-none">
        <SortableHeader field="pdb" label="PDB" width="w-14" sort={sort} onSort={handleSort} />
        <SortableHeader field="chain" label="Ch" width="w-5" sort={sort} onSort={handleSort} />
        <SortableHeader field="family" label="Fam" width="w-6" sort={sort} onSort={handleSort} />
        <span className="w-16">Isotype</span>
        <SortableHeader field="organism" label="Organism" width="flex-1 min-w-0" sort={sort} onSort={handleSort} />
        <span className="w-28">Ligands</span>
        <SortableHeader field="variants" label="Var" width="w-8 text-right" sort={sort} onSort={handleSort} />
        <span className="w-6" />
      </div>

      {/* ── Results ── */}
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
          <button onClick={loadMore}
            className="w-full py-1.5 text-[10px] text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded">
            Load more
          </button>
        )}
      </div>
    </div>
  );
}

// ── Sortable header ──

function SortableHeader({
  field, label, width, sort, onSort,
}: {
  field: SortField; label: string; width: string;
  sort: { field: SortField; dir: SortDir }; onSort: (field: SortField) => void;
}) {
  const active = sort.field === field;
  return (
    <button onClick={() => onSort(field)}
      className={`${width} flex items-center gap-0.5 hover:text-gray-500 transition-colors ${active ? 'text-gray-500' : ''}`}>
      {label}
      {active && (sort.dir === 'asc' ? <ChevronUp size={8} /> : <ChevronDown size={8} />)}
    </button>
  );
}

// ── Result row ──

function PolymerChainRow({ entity, chainId, onSelect }: {
  entity: PolypeptideEntitySummary; chainId: string; onSelect: () => void;
}) {
  const familyHex = getHexForFamily(entity.family);
  const familyLabel = entity.family
    ? (FAMILY_SYMBOL[entity.family] ?? entity.family.replace('tubulin_', '').replace('map_', ''))
    : '?';
  const organism = entity.src_organism_names?.[0];
  const shortOrganism = organism ? organism.split(' ').slice(0, 2).join(' ') : '';
  const ligands = (entity.ligand_ids ?? []).filter(l => !LIGAND_IGNORE_IDS.has(l));

  return (
    <div className="group flex items-center gap-2 px-2 py-1 hover:bg-gray-50 border-b border-gray-50 text-[10px]">
      <span className="w-14 font-mono font-medium text-gray-700 flex-shrink-0">{entity.parent_rcsb_id}</span>
      <span className="w-5 font-mono text-gray-500 flex-shrink-0">{chainId}</span>
      <span className="w-6 text-center font-medium flex-shrink-0" style={{ color: familyHex }}
        title={entity.family ?? undefined}>{familyLabel}</span>
      <span className="w-16 text-[9px] text-gray-500 truncate flex-shrink-0" title={entity.isotype ?? undefined}>
        {entity.isotype ?? ''}</span>
      <span className="flex-1 min-w-0 text-gray-400 italic truncate" title={organism ?? undefined}>
        {shortOrganism}</span>
      <div className="w-28 flex flex-wrap gap-0.5 flex-shrink-0">
        {ligands.map(lig => (
          <span key={lig} className="px-1 py-px text-[8px] font-mono rounded border"
            style={{ borderColor: hexToRgba(getHexForLigand(lig), 0.4), color: getHexForLigand(lig) }}
            title={lig}>{lig}</span>
        ))}
      </div>
      <span className="w-8 text-right flex-shrink-0">
        {entity.variant_count != null && entity.variant_count > 0
          ? <span className="text-orange-400">{entity.variant_count}</span>
          : <span className="text-gray-200">0</span>}
      </span>
      <button onClick={onSelect}
        className="w-6 h-5 flex items-center justify-center text-gray-300 hover:text-blue-600 hover:bg-blue-50 rounded opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
        title={`Align ${entity.parent_rcsb_id}:${chainId}`}>
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
