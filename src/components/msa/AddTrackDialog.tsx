/**
 * AddTrackDialog — Variants-only filter builder with live results panel.
 *
 * Scoped to variants because PTMs already have their own UI (PerChainPtmDropdown)
 * and ligand binding contacts are still in development. See
 * notes/annotation_tracks_roadmap.md for the deferred items.
 *
 * Layout: two columns. Filters on the left, live results on the right.
 *   - Phenotype search at top (the primary entry point for literature queries)
 *   - Sources, AAs, UniProts, PTM co-occurrence, species tree, position range
 *   - Label (optional, auto-generated from filter signature if blank)
 *   - Family is implicit — passed in as a prop from the displayed chain
 */
'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Loader2 } from 'lucide-react';
import { Select, TreeSelect, Slider } from 'antd';
import { useAppDispatch } from '@/store/store';
import {
  addTrack,
  type FilterSpec,
  type Family,
} from '@/store/slices/annotationTracksSlice';
import { useGetTaxonomyTreeQuery } from '@/store/tubxz_api';
import { taxIdsToVariantSpeciesNames } from '@/lib/variant_species_map';

interface AddTrackDialogProps {
  /** Implicit family from the displayed primary chain. */
  family: Family;
  onClose: () => void;
}

// 20 canonical AAs in a 5×4 grid (rows = property-ish clusters but order
// doesn't matter much for v1; just a stable arrangement).
const AAS = ['A', 'V', 'L', 'I', 'M', 'P', 'G', 'C', 'S', 'T',
             'N', 'Q', 'F', 'W', 'Y', 'H', 'K', 'R', 'D', 'E'];

// Known PTM types for the co-occurrence dropdown. Static for v1; replace
// with a backend "facets" endpoint when we add autocomplete elsewhere.
const KNOWN_PTM_TYPES = [
  'phosphorylation', 'acetylation', 'methylation', 'ubiquitination',
  'palmitoylation', 'polyglutamylation', 'glycylation', 'detyrosination',
  'tyrosination', 'glycosylation', 'sumoylation',
];

const PRESET_COLORS = [
  '#F39C12', '#E74C3C', '#8E44AD', '#3498DB', '#1ABC9C',
  '#2ECC71', '#E67E22', '#34495E', '#D35400', '#16A085',
];

// ---------------------------------------------------------------------------
// Small primitives
// ---------------------------------------------------------------------------

function FieldHeader({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <label className="text-[9px] font-semibold uppercase tracking-wider text-gray-500">
        {label}
      </label>
      {hint && <span className="text-[9px] text-gray-400">{hint}</span>}
    </div>
  );
}

/** Toggle pill grid — used for both wild-type and observed AAs. */
function AaPillGrid({
  selected,
  onChange,
}: {
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  return (
    <div className="grid grid-cols-10 gap-0.5">
      {AAS.map(aa => {
        const isOn = selected.has(aa);
        return (
          <button
            key={aa}
            type="button"
            onClick={() => {
              const next = new Set(selected);
              if (isOn) next.delete(aa);
              else next.add(aa);
              onChange(next);
            }}
            className={`
              h-5 text-[10px] font-mono rounded transition-colors
              ${isOn
                ? 'bg-blue-100 border border-blue-400 text-blue-700'
                : 'bg-gray-50 border border-gray-200 text-gray-500 hover:bg-gray-100'}
            `}
          >
            {aa}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main dialog
// ---------------------------------------------------------------------------

export function AddTrackDialog({ family, onClose }: AddTrackDialogProps) {
  const dispatch = useAppDispatch();
  const { data: sourceTaxTree } = useGetTaxonomyTreeQuery({ taxType: 'source' });

  // ── Filter state ──
  const [phenotype, setPhenotype] = useState('');
  const [sourceStructural, setSourceStructural] = useState(true);
  const [sourceLiterature, setSourceLiterature] = useState(true);
  const [wildTypeAas, setWildTypeAas] = useState<Set<string>>(new Set());
  const [observedAas, setObservedAas] = useState<Set<string>>(new Set());
  const [uniprotIds, setUniprotIds] = useState<string[]>([]);
  const [coOccursPtms, setCoOccursPtms] = useState<string[]>([]);
  const [selectedTaxIds, setSelectedTaxIds] = useState<number[]>([]);
  const [positionRange, setPositionRange] = useState<[number, number]>([1, 451]);
  const [positionRangeEnabled, setPositionRangeEnabled] = useState(false);

  // ── Common state ──
  const [labelOverride, setLabelOverride] = useState('');
  const [color, setColor] = useState<string>(PRESET_COLORS[0]);

  // ── Derived: species text names from selected taxIds ──
  const speciesNames = useMemo(
    () => taxIdsToVariantSpeciesNames(selectedTaxIds),
    [selectedTaxIds],
  );

  // ── Build the FilterSpec ──
  const filterSpec = useMemo<FilterSpec>(() => {
    const sources: ('structural' | 'literature')[] = [];
    if (sourceStructural) sources.push('structural');
    if (sourceLiterature) sources.push('literature');
    const phenotypeChips = phenotype
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    return {
      kind: 'variants',
      family,
      ...(sources.length ? { sources } : {}),
      ...(uniprotIds.length ? { uniprot_ids: uniprotIds } : {}),
      ...(wildTypeAas.size ? { wild_type_aas: Array.from(wildTypeAas) } : {}),
      ...(observedAas.size ? { observed_aas: Array.from(observedAas) } : {}),
      ...(speciesNames.length ? { species_names: speciesNames } : {}),
      ...(coOccursPtms.length ? { co_occurs_with_mod_type: coOccursPtms } : {}),
      ...(phenotypeChips.length ? { phenotype_contains: phenotypeChips } : {}),
      ...(positionRangeEnabled ? { position_range: positionRange } : {}),
    };
  }, [
    family, sourceStructural, sourceLiterature, uniprotIds, wildTypeAas,
    observedAas, speciesNames, coOccursPtms, phenotype, positionRange,
    positionRangeEnabled,
  ]);

  // ── Auto-generated label from filter signature (when user leaves blank) ──
  const autoLabel = useMemo(() => {
    const parts: string[] = [];
    if (sourceLiterature && !sourceStructural) parts.push('Lit');
    else if (sourceStructural && !sourceLiterature) parts.push('Struct');
    if (uniprotIds.length) parts.push(uniprotIds.slice(0, 2).join('/'));
    if (wildTypeAas.size) parts.push([...wildTypeAas].join('') + (observedAas.size ? '>' + [...observedAas].join('') : ''));
    if (coOccursPtms.length) parts.push('+' + coOccursPtms[0]);
    const phen = phenotype.split(',').map(s => s.trim()).filter(Boolean);
    if (phen.length) parts.push(`"${phen[0].slice(0, 20)}"`);
    if (parts.length === 0) parts.push('variants');
    return parts.join(' · ');
  }, [
    sourceLiterature, sourceStructural, uniprotIds, wildTypeAas, observedAas,
    coOccursPtms, phenotype,
  ]);

  const effectiveLabel = labelOverride.trim() || autoLabel;

  // ── Live preview: debounced resolve ──
  const [results, setResults] = useState<
    | { kind: 'idle' }
    | { kind: 'loading' }
    | { kind: 'ok'; count: number; positions: Array<{ master_index: number; match_count: number; matched_records: any[] }> }
    | { kind: 'error'; message: string }
  >({ kind: 'idle' });

  useEffect(() => {
    let cancelled = false;
    const handle = setTimeout(() => {
      setResults({ kind: 'loading' });
      fetch('/api/annotations/track/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spec: filterSpec }),
      })
        .then(async res => {
          if (!res.ok) {
            let detail: string;
            try {
              const body = await res.json();
              detail = body.detail ?? JSON.stringify(body);
            } catch { detail = await res.text(); }
            throw new Error(`(${res.status}) ${detail.slice(0, 200)}`);
          }
          return res.json();
        })
        .then(json => {
          if (cancelled) return;
          setResults({
            kind: 'ok',
            count: json.matched ?? 0,
            positions: json.positions ?? [],
          });
        })
        .catch(err => {
          if (cancelled) return;
          setResults({ kind: 'error', message: String(err?.message ?? err) });
        });
    }, 300);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [filterSpec]);

  // ── Add action ──
  const canAdd = results.kind === 'ok' && results.count > 0;
  const handleAdd = useCallback(() => {
    if (!canAdd) return;
    dispatch(addTrack({
      label: effectiveLabel,
      family,
      filters: filterSpec,
      paint: { kind: 'flat', color },
    }));
    onClose();
  }, [canAdd, effectiveLabel, family, filterSpec, color, dispatch, onClose]);

  // ── ESC to close ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div
        className="relative bg-white rounded-lg shadow-xl flex flex-col text-gray-800"
        style={{
          width: 'min(1100px, calc(100vw - 32px))',
          // Fixed height so the modal doesn't jump as the result count changes.
          // The left filter panel and right results pane both scroll internally.
          height: 'min(720px, calc(100vh - 48px))',
        }}
      >

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-baseline gap-2">
            <h2 className="text-sm font-semibold">Add annotation track</h2>
            <span className="text-[10px] text-gray-400">
              variants &amp; positions of interest · family: {family.replace('tubulin_', '')}
            </span>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <X size={14} />
          </button>
        </div>

        {/* Two-column body */}
        <div className="flex flex-1 min-h-0">

          {/* LEFT: filter form */}
          <div className="w-[440px] flex-shrink-0 border-r border-gray-100 overflow-y-auto px-4 py-3 space-y-3">

            {/* Phenotype search — primary entry point for literature queries.
                Hint chips below show the actual phrasing in Morissette's data
                (the dataset uses spelled-out forms, not acronyms like "CFEOM"). */}
            <div>
              <FieldHeader label="Phenotype search" hint="case-insensitive substring; comma-separated = OR" />
              <div className="relative mt-1">
                <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={phenotype}
                  onChange={e => setPhenotype(e.target.value)}
                  placeholder='type a phrase from the data, e.g. "fibrosis of the extraocular"'
                  className="w-full pl-6 pr-2 py-1.5 text-[11px] border border-gray-200 rounded focus:outline-none focus:border-blue-400"
                />
              </div>
              <div className="flex flex-wrap gap-1 mt-1">
                <span className="text-[9px] text-gray-400 self-center mr-0.5">try:</span>
                {[
                  'fibrosis of the extraocular',
                  'Cortical dysplasia',
                  'lissencephaly',
                  'microcephaly',
                  'Leukodystrophy',
                  'pathogenic',
                  'DOID',
                ].map(phrase => (
                  <button
                    key={phrase}
                    type="button"
                    onClick={() => {
                      // Replace the input with this phrase; if user wants to OR
                      // with existing chips they can edit manually.
                      setPhenotype(phrase);
                    }}
                    className="px-1.5 py-px text-[9px] rounded border border-gray-200 text-gray-600 bg-white hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700"
                    title={`Set phenotype search to: ${phrase}`}
                  >
                    {phrase}
                  </button>
                ))}
              </div>
            </div>

            {/* Sources */}
            <div>
              <FieldHeader label="Sources" />
              <div className="flex items-center gap-3 mt-1">
                <label
                  className="flex items-center gap-1 text-[11px] text-gray-700 cursor-pointer"
                  title="Substitutions detected from multiple-sequence alignment of structural data"
                >
                  <input
                    type="checkbox"
                    checked={sourceStructural}
                    onChange={e => setSourceStructural(e.target.checked)}
                  />
                  structural
                </label>
                <label
                  className="flex items-center gap-1 text-[11px] text-gray-700 cursor-pointer"
                  title="Literature-curated variants from Morisette's database (carries phenotype text)"
                >
                  <input
                    type="checkbox"
                    checked={sourceLiterature}
                    onChange={e => setSourceLiterature(e.target.checked)}
                  />
                  literature
                </label>
              </div>
            </div>

            {/* Wild-type AAs */}
            <div>
              <FieldHeader label="Wild-type AAs" hint="click to toggle" />
              <div className="mt-1">
                <AaPillGrid selected={wildTypeAas} onChange={setWildTypeAas} />
              </div>
            </div>

            {/* Observed AAs */}
            <div>
              <FieldHeader label="Observed AAs" hint="click to toggle" />
              <div className="mt-1">
                <AaPillGrid selected={observedAas} onChange={setObservedAas} />
              </div>
            </div>

            {/* UniProt IDs */}
            <div>
              <FieldHeader label="UniProt IDs" hint="press Enter to add" />
              <Select
                mode="tags"
                value={uniprotIds}
                onChange={setUniprotIds}
                placeholder="Q13509"
                size="small"
                style={{ width: '100%', marginTop: 4 }}
                tokenSeparators={[',', ' ']}
              />
            </div>

            {/* Co-occurs with PTM type */}
            <div>
              <FieldHeader label="Co-occurs with PTM" hint="cross-stream filter" />
              <Select
                mode="multiple"
                value={coOccursPtms}
                onChange={setCoOccursPtms}
                placeholder="acetylation, phosphorylation…"
                size="small"
                style={{ width: '100%', marginTop: 4 }}
                options={KNOWN_PTM_TYPES.map(t => ({ label: t, value: t }))}
              />
            </div>

            {/* Species tree */}
            <div>
              <FieldHeader label="Species" hint="NCBI tree; selects map to variant.species text" />
              <TreeSelect
                style={{ width: '100%', marginTop: 4 }}
                value={selectedTaxIds}
                onChange={setSelectedTaxIds}
                placeholder="All species"
                styles={{ popup: { root: { maxHeight: 320, overflow: 'auto' } } }}
                multiple allowClear treeCheckable
                showCheckedStrategy={TreeSelect.SHOW_PARENT}
                treeData={sourceTaxTree ?? []}
                size="small" showSearch treeNodeFilterProp="title"
              />
              {selectedTaxIds.length > 0 && speciesNames.length === 0 && (
                <div className="text-[9px] text-amber-600 mt-1">
                  selected taxIds don't map to any variant species text (see roadmap: variant tax_id re-ingestion)
                </div>
              )}
            </div>

            {/* Position range */}
            <div>
              <div className="flex items-center justify-between">
                <FieldHeader label="Position range" />
                <label className="flex items-center gap-1 text-[9px] text-gray-500 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={positionRangeEnabled}
                    onChange={e => setPositionRangeEnabled(e.target.checked)}
                  />
                  restrict
                </label>
              </div>
              {positionRangeEnabled && (
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="number"
                    value={positionRange[0]}
                    onChange={e => setPositionRange([Number(e.target.value), positionRange[1]])}
                    className="w-12 px-1 py-0.5 text-[10px] border border-gray-200 rounded"
                  />
                  <div className="flex-1">
                    <Slider
                      range
                      min={1}
                      max={451}
                      value={positionRange}
                      onChange={v => setPositionRange(v as [number, number])}
                    />
                  </div>
                  <input
                    type="number"
                    value={positionRange[1]}
                    onChange={e => setPositionRange([positionRange[0], Number(e.target.value)])}
                    className="w-12 px-1 py-0.5 text-[10px] border border-gray-200 rounded"
                  />
                </div>
              )}
            </div>

            {/* Label + Color */}
            <div className="pt-2 mt-2 border-t border-gray-100">
              <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
                <div>
                  <FieldHeader label="Name (optional)" hint={`auto: ${autoLabel}`} />
                  <input
                    value={labelOverride}
                    onChange={e => setLabelOverride(e.target.value)}
                    placeholder={autoLabel}
                    className="w-full mt-1 px-2 py-1 text-[11px] border border-gray-200 rounded focus:outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <FieldHeader label="Color" />
                  <div className="flex items-center gap-1 mt-1">
                    {PRESET_COLORS.slice(0, 5).map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColor(c)}
                        className={`w-4 h-4 rounded-sm border ${color === c ? 'border-gray-800 ring-1 ring-gray-400' : 'border-gray-200'}`}
                        style={{ backgroundColor: c }}
                        title={c}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    {PRESET_COLORS.slice(5).map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColor(c)}
                        className={`w-4 h-4 rounded-sm border ${color === c ? 'border-gray-800 ring-1 ring-gray-400' : 'border-gray-200'}`}
                        style={{ backgroundColor: c }}
                        title={c}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: live results */}
          <div className="flex-1 flex flex-col min-h-0 min-w-0">
            {/* Status bar */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-1.5 text-[11px] text-gray-700">
                {results.kind === 'idle' && <span className="text-gray-400">…</span>}
                {results.kind === 'loading' && (
                  <>
                    <Loader2 size={12} className="animate-spin text-blue-500" />
                    <span className="text-gray-500">resolving…</span>
                  </>
                )}
                {results.kind === 'ok' && (
                  <>
                    <span className="font-semibold">{results.count}</span> master column{results.count === 1 ? '' : 's'} match
                  </>
                )}
                {results.kind === 'error' && (
                  <span className="text-red-500 truncate" title={results.message}>error: {results.message.slice(0, 80)}</span>
                )}
              </div>
              <div className="text-[9px] text-gray-400">
                {results.kind === 'ok' && results.count > 200 ? 'first 200 shown' : ''}
              </div>
            </div>

            {/* Column header row */}
            <div
              className="grid items-center gap-2 px-4 py-1.5 border-b border-gray-200 bg-gray-50 text-[9px] font-semibold uppercase tracking-wider text-gray-500 flex-shrink-0"
              style={{ gridTemplateColumns: '46px 64px 32px 36px 1fr 70px 90px' }}
              title="Each row is one matching master alignment column"
            >
              <span title="Master alignment column (1-based)">Position</span>
              <span title="Wild-type → observed amino acid">Mutation</span>
              <span title="Number of records contributing to this column">N</span>
              <span title="Provenance of the contributing record(s)">Source</span>
              <span>Phenotype / notes</span>
              <span>UniProt</span>
              <span>Species</span>
            </div>

            {/* Body */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              {results.kind === 'ok' && results.positions.length === 0 && (
                <div className="px-4 py-6 text-[11px] text-gray-400 italic">
                  No master columns match. Loosen filters above.
                </div>
              )}
              {results.kind === 'ok' && results.positions.slice(0, 200).map(p => {
                const rec = p.matched_records[0] ?? {};
                const wt = rec.wild_type ?? '?';
                const obs = rec.observed ?? '?';
                const isLit = rec.source === 'morisette';
                const isPositionOnly = wt === obs && wt !== '?';
                const phen = rec.phenotype as string | null;
                const uni = rec.uniprot_id as string | null;
                const sp = rec.species as string | null;
                return (
                  <div
                    key={p.master_index}
                    className="grid items-baseline gap-2 px-4 py-1 border-b border-gray-50 text-[10px] hover:bg-blue-50/50"
                    style={{ gridTemplateColumns: '46px 64px 32px 36px 1fr 70px 90px' }}
                    title={`Master column ${p.master_index} · ${p.match_count} contributing record${p.match_count === 1 ? '' : 's'}${isPositionOnly ? ' · position-only annotation (wild-type = observed)' : ''}`}
                  >
                    <span className="font-semibold text-gray-700">{p.master_index}</span>
                    <span className="font-mono text-gray-700">
                      {isPositionOnly ? (
                        <span title="Position-only annotation: residue identity at this column is recorded without a substitution. Common for correlation notes in Morisette data.">
                          <span>{wt}</span>
                          <span className="ml-1 px-0.5 text-[8px] text-amber-600 bg-amber-50 border border-amber-200 rounded font-sans">pos</span>
                        </span>
                      ) : (
                        <>{wt}&#8594;{obs}</>
                      )}
                    </span>
                    <span className="text-gray-500 text-[10px] tabular-nums">{p.match_count}</span>
                    <span
                      className={`inline-flex items-center justify-center px-1 py-px rounded text-[8px] font-medium leading-none w-fit
                        ${isLit
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-sky-50 text-sky-700 border border-sky-200'}`}
                      title={isLit ? 'Literature-curated (Morisette)' : 'Structural (MSA-derived)'}
                    >
                      {isLit ? 'lit' : 'struct'}
                    </span>
                    <span className="min-w-0 truncate text-gray-700" title={phen ?? undefined}>
                      {phen ?? <span className="text-gray-300 italic">—</span>}
                    </span>
                    <span className="text-blue-600 font-mono text-[9px] truncate" title={uni ?? undefined}>
                      {uni ?? <span className="text-gray-300">—</span>}
                    </span>
                    <span className="text-gray-500 italic text-[9px] truncate" title={sp ?? undefined}>
                      {sp ?? <span className="text-gray-300 not-italic">—</span>}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-2.5 border-t border-gray-100 flex-shrink-0 bg-gray-50/50">
          <button
            onClick={onClose}
            className="px-3 py-1 text-[11px] text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={!canAdd}
            className={`px-3 py-1 text-[11px] font-medium rounded transition-colors ${
              canAdd
                ? 'bg-blue-500 text-white hover:bg-blue-600'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
            title={canAdd ? `Add "${effectiveLabel}"` : 'fill in filters to add'}
          >
            Add track
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
