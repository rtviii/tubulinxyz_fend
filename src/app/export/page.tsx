'use client';

// Hidden asset-export route for the conference poster. Mounts one UI component
// at a time, chromeless and large, with per-component "save" controls.
//
//   /export?target=msa&rcsb_id=9MLF&chain=A
//   /export?target=msa&rcsb_id=9MLF&chain=A&rows=9U6D:A,9EOK:B&w=1800&h=900
//   /export?target=msa&rcsb_id=9YAB&chain=B&ann=1&ptms=acetylation,ubiquitination&h=1100
//   /export?target=msa&rcsb_id=9WDA&chain=b&preset=colchicine-pocket&win=236-316&h=420
//   /export?target=popup&rcsb_id=9MLF&family=tubulin_alpha&master=44&letter=K
//   /export?target=catalogue&fade=1
//
// MSA extra rows (&rows=PDB:CHAIN,...) preload additional chains as MSA rows.
// They must be the SAME family as the primary chain (the panel filters by family).
// &ann=1 loads real annotations and force-expands each chain so its aux rows show
// (binding sites, substitutions, PTMs all auto-enabled); &ptms=type,type limits the
// PTM types shown. &preset=<name> adds a set of global annotation tracks (see
// TRACK_PRESETS) as a bottom band — use the matching family's chain. &win=START-END
// crops the "SVG · whole MSA (vector)" export to that master-column window.
// Size the capture region with &w / &h so all rows fit.
//
// Data is REAL: the MSA panel self-aligns from the fetched profile, the residue
// popup self-fetches annotations by (family, master index), and the catalogue
// self-drives from RTK Query. No mocks.

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { API_BASE_URL } from '@/config';
import { useAppDispatch, useAppSelector } from '@/store/store';
import { clearPdbSequences } from '@/store/slices/sequence_registry';
import {
  clearAllAnnotations,
  showAllLigands,
  setVariantsVisible,
  setSpeciesForChain,
  toggleModificationType,
} from '@/store/slices/annotationsSlice';
import { useMultiChainAnnotations, ChainAnnotationFetcher } from '@/hooks/useMultiChainAnnotations';
import { addTrack, clearAllTracks, type FilterSpec, type PaintSpec } from '@/store/slices/annotationTracksSlice';
import { useResolveTracks } from '@/hooks/useResolveTracks';
import { computeAuxiliaryCellColors } from '@/store/slices/colorRulesSelector';
import { selectLigandOverrides, selectVariantOverrides, selectModificationOverrides } from '@/store/slices/colorOverridesSlice';
import type { MsaSequence } from '@/store/slices/sequence_registry';
import type { MSAHandle } from '@/components/msa/types';
import { getFamilyForChain, chainIsAlignable, type StructureProfile } from '@/lib/profile_utils';
import type { PolymerComponent } from '@/components/molstar/core/types';
import { SequenceAlignmentPanel } from '@/components/msa/SequenceAlignmentPanel';
import { ResiduePopupContent } from '@/components/residue_popup/ResiduePopup';
import type { ResiduePopupTarget } from '@/components/residue_popup/types';
import { StructureCard, type LigandLookup } from '@/components/structures/StructureCard';
import { useGetStructureFacetsQuery, useListStructuresQuery, useGetMasterProfileQuery, type TubulinFamily } from '@/store/tubxz_api';
import { useChainAlignment } from '@/hooks/useChainAlignment';
import { ExportStage, type ExportAction } from '@/components/export/ExportStage';
import {
  captureNodePng,
  captureNodeSvg,
  captureCanvasPng,
  captureSvg,
  captureMsaVectorSvg,
  findVisibleCanvas,
  findNavigationSvg,
} from '@/components/export/exportCapture';

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center text-sm text-gray-500">
      {children}
    </div>
  );
}

/** Fetch a structure profile through the same /api proxy the real pages use. */
function useProfile(rcsbId: string | null) {
  const [profile, setProfile] = useState<StructureProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!rcsbId) return;
    let cancelled = false;
    setProfile(null);
    setError(null);
    fetch(`${API_BASE_URL}/structures/${rcsbId}/profile`)
      .then((r) => {
        if (!r.ok) throw new Error(`profile ${r.status}`);
        return r.json();
      })
      .then((p: StructureProfile) => {
        if (!cancelled) setProfile(p);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [rcsbId]);
  return { profile, error };
}

function synthPolymerComponents(profile: StructureProfile | null, rcsbId: string): PolymerComponent[] {
  if (!profile) return [];
  return (profile.polypeptides ?? []).map((p: any) => ({
    type: 'polymer' as const,
    pdbId: rcsbId,
    ref: '',
    chainId: p.auth_asym_id,
  }));
}

/** Resolve the chain to display: the requested chain if alignable, else the
 *  first alignable (α/β) chain in the structure. */
function resolveChain(profile: StructureProfile | null, chainParam?: string): string | null {
  if (!profile) return null;
  if (chainParam && chainIsAlignable(profile, chainParam)) return chainParam;
  const first = (profile.polypeptides ?? []).find((p: any) => chainIsAlignable(profile, p.auth_asym_id));
  return first?.auth_asym_id ?? chainParam ?? null;
}

// ── MSA export ───────────────────────────────────────────────

/** Parse the &rows= param: "PDB:CHAIN,PDB:CHAIN" -> [{id,chain}]. */
function parseRowSpecs(s: string): { id: string; chain: string }[] {
  return s
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => {
      const [id, chain] = t.split(':');
      return { id: (id ?? '').toUpperCase(), chain: chain ?? 'A' };
    })
    .filter((x) => x.id);
}

/** Fetch several structure profiles in parallel (for extra MSA rows). */
function useProfiles(ids: string[]): Record<string, StructureProfile> {
  const [map, setMap] = useState<Record<string, StructureProfile>>({});
  const key = ids.join(',');
  useEffect(() => {
    if (ids.length === 0) { setMap({}); return; }
    let cancelled = false;
    Promise.all(
      ids.map((id) =>
        fetch(`${API_BASE_URL}/structures/${id}/profile`)
          .then((r) => (r.ok ? r.json() : null))
          .then((p) => [id, p] as const)
          .catch(() => [id, null] as const),
      ),
    ).then((entries) => {
      if (cancelled) return;
      const m: Record<string, StructureProfile> = {};
      for (const [id, p] of entries) if (p) m[id] = p as StructureProfile;
      setMap(m);
    });
    return () => { cancelled = true; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return map;
}

// Named global-track presets for reproducible figures (each entry is addTrack-ready).
const TRACK_PRESETS: Record<string, Array<{ label: string; family: string; filters: FilterSpec; paint: PaintSpec }>> = {
  // The colchicine / drug-resistance pocket on β-tubulin (window 236–316).
  'colchicine-pocket': [
    {
      label: 'Colchicine footprint', family: 'tubulin_beta',
      filters: { kind: 'binding_contacts', family: 'tubulin_beta', chemical_ids: ['LOC'], structure_ids: ['3E22'] },
      paint: { kind: 'flat', color: '#9ca3af' },
    },
    {
      label: 'Drug resistance', family: 'tubulin_beta',
      filters: {
        kind: 'variants', family: 'tubulin_beta', sources: ['literature'], position_range: [236, 316],
        phenotype_contains: ['resistant', 'paclitaxel', 'docetaxel', 'taxane', 'colchicine', 'benomyl', 'carbendazim', 'epothilone', 'vinca', 'withaferin', 'albendazole'],
      },
      paint: { kind: 'flat', color: '#06b6d4' },
    },
    {
      label: 'Tubulinopathies', family: 'tubulin_beta',
      filters: {
        kind: 'variants', family: 'tubulin_beta', sources: ['literature'], position_range: [236, 316],
        phenotype_contains: ['leukodystrophy', 'cortical', 'microcephaly', 'polymicrogyria', 'dysgyria', 'lissencephaly', 'malformation', 'akinesia', 'hypomyelinating'],
      },
      paint: { kind: 'flat', color: '#8b5cf6' },
    },
    {
      label: 'Reactive cysteines', family: 'tubulin_beta',
      filters: { kind: 'variants', family: 'tubulin_beta', wild_type_aas: ['C'], sources: ['structural', 'literature'], position_range: [236, 316] },
      paint: { kind: 'flat', color: '#f97316' },
    },
  ],
};

function MsaExport({ rcsbId, chainParam, sp }: { rcsbId: string; chainParam?: string; sp: URLSearchParams }) {
  const dispatch = useAppDispatch();
  const { profile, error } = useProfile(rcsbId);
  const stageRef = useRef<HTMLDivElement>(null);
  const msaHandleRef = useRef<MSAHandle>(null);
  const [displaySeqs, setDisplaySeqs] = useState<MsaSequence[]>([]);
  const { alignChainFromProfile, resetBuiltCache } = useChainAlignment();
  const annEnabled = sp.get('ann') === '1';
  const configuredRef = useRef<Set<string>>(new Set());
  const presetName = sp.get('preset') ?? '';
  const presetAddedRef = useRef(false);

  // Resolve any annotation tracks (preset or otherwise) against the backend.
  useResolveTracks();

  // Start from a clean registry / annotations / tracks so no stale rows leak in.
  useEffect(() => {
    dispatch(clearPdbSequences());
    dispatch(clearAllAnnotations());
    dispatch(clearAllTracks());
    resetBuiltCache();
    configuredRef.current.clear();
    presetAddedRef.current = false;
  }, [dispatch, rcsbId, resetBuiltCache]);

  // Load a named global-track preset (e.g. colchicine-pocket) once.
  useEffect(() => {
    if (!presetName || presetAddedRef.current) return;
    const preset = TRACK_PRESETS[presetName];
    if (!preset) return;
    presetAddedRef.current = true;
    for (const t of preset) dispatch(addTrack(t));
  }, [presetName, dispatch]);

  const polymerComponents = useMemo(() => synthPolymerComponents(profile, rcsbId), [profile, rcsbId]);
  const chainId = useMemo(() => resolveChain(profile, chainParam), [profile, chainParam]);
  const family = useMemo(
    () => (profile && chainId ? getFamilyForChain(profile, chainId) : undefined),
    [profile, chainId],
  );

  // Extra preloaded rows: &rows=PDB:CHAIN,PDB:CHAIN. Must share the primary's
  // family to appear (the panel filters its rows by family).
  const rowsParam = sp.get('rows') ?? '';
  const extraSpecs = useMemo(() => parseRowSpecs(rowsParam), [rowsParam]);
  const extraIds = useMemo(() => [...new Set(extraSpecs.map((s) => s.id))], [extraSpecs]);
  const extraProfiles = useProfiles(extraIds);

  // Master alignment length for the primary family -- needed to build aligned rows.
  const { data: masterData } = useGetMasterProfileQuery(
    { family: (family ?? 'tubulin_alpha') as TubulinFamily },
    { skip: !family },
  );
  const masterLen = masterData?.alignment_length ?? 0;

  // Once master length + extra profiles are ready, align each extra chain into
  // the registry; the panel renders every registry row of the family.
  useEffect(() => {
    if (!masterLen) return;
    for (const spec of extraSpecs) {
      const prof = extraProfiles[spec.id];
      if (prof) alignChainFromProfile(prof as any, spec.chain, masterLen);
    }
  }, [extraProfiles, masterLen, extraSpecs, alignChainFromProfile]);

  // ── Annotation rows (binding sites, substitutions, PTMs) — gated by &ann=1 ──
  // Load real per-chain annotations for every registry chain, then auto-enable
  // the aux rows so the exported MSA shows them. &ptms= limits the PTM types.
  const { chainsToFetch } = useMultiChainAnnotations(
    annEnabled ? rcsbId : null,
    annEnabled ? chainId : null,
  );
  const ptmsParam = sp.get('ptms') ?? '';
  const ptmFilter = useMemo(
    () => ptmsParam.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
    [ptmsParam],
  );
  const annChains = useAppSelector((s) => s.annotations.chains);
  useEffect(() => {
    if (!annEnabled) return;
    for (const [ck, entry] of Object.entries(annChains)) {
      if (!entry.data || configuredRef.current.has(ck)) continue;
      configuredRef.current.add(ck);
      dispatch(showAllLigands(ck));                                  // binding sites
      dispatch(setVariantsVisible({ chainKey: ck, visible: true })); // substitutions
      const taxIds = [...new Set(
        entry.data.modifications.map((m) => m.taxId).filter((t): t is number => t != null),
      )];
      if (taxIds.length) dispatch(setSpeciesForChain({ chainKey: ck, taxIds }));
      const present = [...new Set(entry.data.modifications.map((m) => m.modificationType))];
      const types = ptmFilter.length
        ? present.filter((t) => ptmFilter.includes(t.toLowerCase()))
        : present;
      for (const t of types) dispatch(toggleModificationType({ chainKey: ck, modType: t }));
    }
  }, [annEnabled, annChains, ptmFilter, dispatch]);

  // Paint the aux-row cells. The real page does this via useViewerSync; here we
  // compute the colors from displaySequences + annotations and push them to the
  // MSA handle. Re-applied a few times to catch nightingale's async grid draw.
  const ligandOverrides = useAppSelector(selectLigandOverrides);
  const variantOverrides = useAppSelector(selectVariantOverrides);
  const modificationOverrides = useAppSelector(selectModificationOverrides);
  const trackEntries = useAppSelector((s) => s.annotationTracks.tracks);
  useEffect(() => {
    if (displaySeqs.length === 0) return;
    if (!annEnabled && Object.keys(trackEntries).length === 0) return;
    const apply = () => {
      if (!msaHandleRef.current) return;
      const colors = computeAuxiliaryCellColors(
        displaySeqs,
        annChains,
        { ligand: ligandOverrides, variant: variantOverrides, modification: modificationOverrides },
        trackEntries,
      );
      if (Object.keys(colors).length > 0) msaHandleRef.current.applyCellColors(colors);
    };
    apply();
    const t1 = setTimeout(apply, 150);
    const t2 = setTimeout(apply, 600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [annEnabled, displaySeqs, annChains, trackEntries, ligandOverrides, variantOverrides, modificationOverrides]);

  // Capture-region size (grow to fit many rows): &w / &h.
  const width = parseInt(sp.get('w') ?? '1800', 10);
  const height = parseInt(sp.get('h') ?? '560', 10);

  // Optional master-column window for the vector SVG export: &win=236-316.
  const winParam = sp.get('win') ?? '';
  const winRange = useMemo<[number, number] | undefined>(() => {
    const m = winParam.match(/^(\d+)-(\d+)$/);
    return m ? [parseInt(m[1], 10), parseInt(m[2], 10)] : undefined;
  }, [winParam]);

  const actions: ExportAction[] = [
    {
      label: 'PNG · whole MSA (3×)',
      onClick: () => stageRef.current && captureNodePng(stageRef.current, `${rcsbId}_${chainId}_msa.png`, 3),
    },
    {
      label: 'PNG · grid canvas',
      onClick: () => {
        const c = stageRef.current && findVisibleCanvas(stageRef.current);
        if (c) captureCanvasPng(c, `${rcsbId}_${chainId}_msa_grid.png`);
        else alert('No alignment canvas found yet — wait for the MSA to render.');
      },
    },
    {
      label: 'SVG · ruler',
      onClick: () => {
        const s = stageRef.current && findNavigationSvg(stageRef.current);
        if (s) captureSvg(s, `${rcsbId}_${chainId}_ruler.svg`);
        else alert('No navigation ruler SVG found.');
      },
    },
    {
      label: 'SVG · whole MSA (vector)',
      onClick: () => {
        const c = stageRef.current && findVisibleCanvas(stageRef.current);
        if (c) captureMsaVectorSvg(c, displaySeqs, masterLen || 452, `${rcsbId}_${chainId}_msa_vector.svg`, winRange);
        else alert('No alignment canvas found yet — wait for the MSA to render (and use Full mode).');
      },
    },
  ];

  if (error) return <Centered>Failed to load {rcsbId}: {error}</Centered>;
  if (!profile || !chainId) return <Centered>Loading {rcsbId} profile…</Centered>;

  return (
    <>
      {annEnabled && chainsToFetch.map((c) => <ChainAnnotationFetcher key={c.chainKey} {...c} />)}
      <ExportStage ref={stageRef} actions={actions} width={width} height={height} backdrop="white">
        <div className="w-full h-full bg-white">
          <SequenceAlignmentPanel
            ref={msaHandleRef}
            chainId={chainId}
            onChainChange={() => {}}
            profile={profile}
            instance={null}
            polymerComponents={polymerComponents}
            pdbId={rcsbId}
            onClose={() => {}}
            forceExpandAll={annEnabled}
            onDisplaySequencesChange={setDisplaySeqs}
          />
        </div>
      </ExportStage>
    </>
  );
}

// ── Residue popup export ─────────────────────────────────────

function PopupExport({
  rcsbId,
  chainParam,
  sp,
}: {
  rcsbId: string;
  chainParam?: string;
  sp: URLSearchParams;
}) {
  const { profile } = useProfile(rcsbId);
  const stageRef = useRef<HTMLDivElement>(null);

  const chainId = useMemo(() => resolveChain(profile, chainParam), [profile, chainParam]);
  const familyParam = sp.get('family') ?? undefined;
  const family = familyParam ?? (profile && chainId ? getFamilyForChain(profile, chainId) : undefined);
  const master = parseInt(sp.get('master') ?? '44', 10);

  const target: ResiduePopupTarget = {
    id: 'export',
    residueLetter: sp.get('letter') ?? '?',
    label: sp.get('label') ?? `${rcsbId}:${chainId ?? ''}`,
    masterIndex: master,
    authSeqId: sp.get('auth') ? parseInt(sp.get('auth')!, 10) : undefined,
    chainId: chainId ?? undefined,
    pdbId: rcsbId,
    family,
    anchor: { mode: 'static', screenX: 0, screenY: 0 },
  };

  const actions: ExportAction[] = [
    {
      label: 'PNG (4×)',
      onClick: () => stageRef.current && captureNodePng(stageRef.current, `popup_${family}_${master}.png`, 4),
    },
    {
      label: 'SVG',
      onClick: () => stageRef.current && captureNodeSvg(stageRef.current, `popup_${family}_${master}.svg`),
    },
  ];

  return (
    <ExportStage ref={stageRef} actions={actions} backdrop="checker">
      <div
        className="bg-white border border-gray-200 rounded-lg shadow-lg text-sm"
        style={{ width: 320 }}
      >
        <ResiduePopupContent target={target} onClose={() => {}} />
      </div>
    </ExportStage>
  );
}

// ── Catalogue grid export ────────────────────────────────────

function CatalogueExport({ fade }: { fade: boolean }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const { data } = useListStructuresQuery({ cursor: null, limit: 12 } as any);
  const { data: facets } = useGetStructureFacetsQuery();

  const ligandLookup = useMemo((): LigandLookup => {
    const map: LigandLookup = {};
    for (const l of facets?.top_ligands ?? []) {
      if (l.chemical_name) map[l.chemical_id] = l.chemical_name;
    }
    return map;
  }, [facets]);

  const items = data?.data ?? [];

  const actions: ExportAction[] = [
    {
      label: 'PNG (3×)',
      onClick: () => stageRef.current && captureNodePng(stageRef.current, 'catalogue_grid.png', 3),
    },
  ];

  const fadeMask = fade ? 'linear-gradient(to right, black 55%, transparent 100%)' : undefined;

  if (items.length === 0) return <Centered>Loading catalogue…</Centered>;

  return (
    <ExportStage ref={stageRef} actions={actions} width={1400} backdrop="white">
      <div style={{ maskImage: fadeMask, WebkitMaskImage: fadeMask }}>
        <div className="grid grid-cols-4 gap-4 p-4">
          {items.map((s) => (
            <StructureCard key={s.rcsb_id} structure={s} ligandLookup={ligandLookup} />
          ))}
        </div>
      </div>
    </ExportStage>
  );
}

// ── Router ───────────────────────────────────────────────────

function ExportPageInner() {
  const sp = useSearchParams();
  const target = sp.get('target') ?? 'msa';
  const rcsbId = (sp.get('rcsb_id') ?? '9MLF').toUpperCase();
  const chain = sp.get('chain') ?? undefined;

  if (target === 'catalogue') return <CatalogueExport fade={sp.get('fade') !== '0'} />;
  if (target === 'popup') return <PopupExport rcsbId={rcsbId} chainParam={chain} sp={sp as unknown as URLSearchParams} />;
  return <MsaExport rcsbId={rcsbId} chainParam={chain} sp={sp as unknown as URLSearchParams} />;
}

export default function ExportPage() {
  return (
    <Suspense fallback={<Centered>Loading…</Centered>}>
      <ExportPageInner />
    </Suspense>
  );
}
