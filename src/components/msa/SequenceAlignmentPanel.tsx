// src/components/msa/SequenceAlignmentPanel.tsx
'use client';

import {
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { X } from 'lucide-react';
import { useAppSelector, useAppDispatch } from '@/store/store';
import { useGetMasterProfileQuery } from '@/store/tubxz_api';
import { useAutoAlignFromProfile } from '@/hooks/useChainAlignment';
import { useNightingaleComponents } from '@/hooks/useNightingaleComponents';
import { selectPositionMapping } from '@/store/slices/sequence_registry';
import { setHoveredChain } from '@/store/slices/chainFocusSlice';
import type { MsaSequence, PositionMapping } from '@/store/slices/sequence_registry';
import { selectAnnotationsState, clearChain } from '@/store/slices/annotationsSlice';
import type { ChainAnnotationEntry } from '@/store/slices/annotationsSlice';
import { getFamilyForChain, StructureProfile } from '@/lib/profile_utils';
import { formatFamilyShort } from '@/lib/formatters';
import { makeChainKey, authAsymIdFromChainKey } from '@/lib/chain_key';
import { ResizableMSAContainer, type ResizableMSAContainerHandle } from './ResizableMSAContainer';
import { MSAToolbar } from './MSAToolbar';
import type { MSAHandle } from './types';
import { toLayerType } from './auxiliary/layerKind';
import { selectAllTracks, type TrackEntry } from '@/store/slices/annotationTracksSlice';
import type { MolstarInstance } from '@/components/molstar/services/MolstarInstance';
import type { PolymerComponent, AlignedStructure } from '@/components/molstar/core/types';
import type { TubulinStructure, PolypeptideEntity, TubulinFamily } from '@/store/tubxz_api';

// ────────────────────────────────────────────
// Types
// ────────────────────────────────────────────

export interface ChainOption {
  chainId: string;
  family: string | undefined;
  familyLabel: string | undefined;
  organism: string | undefined;
  seqLength: number;
  uniprotId: string | undefined;
  isotype: string | undefined;
}

interface SelectedResidue {
  seqId: string;
  column: number;
  residueLetter: string;
  chainLabel: string;
  authSeqId: number;
}

/** Lightweight residue summary used to drive the always-on display chip in
 *  the header. The chip prefers hovered → selected → empty placeholder. */
interface HoveredResidue {
  residueLetter: string;
  chainLabel: string;
  authSeqId: number;
  masterIdx: number; // 1-based
}

/** Info emitted from MSA right-click. Page uses this to construct a ResiduePopupTarget. */
export interface MSAContextMenuEvent {
  residueLetter: string;
  masterIndex: number;
  screenX: number;
  screenY: number;
  /** Present only for structural (PDB) sequences */
  structural?: {
    chainLabel: string;  // "PDB:chainId"
    authSeqId: number;
    chainId: string;     // auth_asym_id
    pdbId: string;       // e.g. "9MLF"
  };
  /** Present only for non-structural (master/custom) sequences */
  sequenceName?: string;
}

interface SequenceAlignmentPanelProps {
  chainId: string;
  onChainChange: (chainId: string) => void;
  profile: StructureProfile | null;
  instance: MolstarInstance | null;
  polymerComponents: PolymerComponent[];
  pdbId: string | null;
  onClose: () => void;

  // Monomer-mode extras (optional)
  alignedStructures?: AlignedStructure[];
  onResidueHover?: (seqId: string, position: number) => void;
  onResidueLeave?: () => void;
  onChainRowMapChange?: (map: Record<string, { chainKey: string; displayRow: number }>) => void;
  onClearColors?: () => void;
  onWindowMaskChange?: (masterStart: number, masterEnd: number) => void;
  onWindowMaskClear?: () => void;
  onResidueContextMenu?: (event: MSAContextMenuEvent) => void;
  /** Emits the full display sequence list (including auxiliaries) for correct color rule row indexing */
  onDisplaySequencesChange?: (seqs: MsaSequence[]) => void;
  /** Emits the set of chain keys whose parent PDB row is currently expanded (aux rows showing). */
  onExpandedChainKeysChange?: (keys: Set<string>) => void;
  onAddAlignment?: () => void;
  /** Export/preview: force every PDB row expanded so its aux rows (variants,
   *  ligand sites, PTMs) materialize without manual chevron clicks. */
  forceExpandAll?: boolean;
}

// ────────────────────────────────────────────
// Auxiliary Track Helpers
// ────────────────────────────────────────────

/** Build auxiliary MsaSequence rows (variants + ligands only -- modifications are top-level).
 *  Rows are materialized based on data availability, independent of visibility flags.
 *  Visibility flags now only gate *coloring* of these rows, not their presence. */
function buildAuxiliarySequences(
  primary: MsaSequence,
  annotationEntry: ChainAnnotationEntry | null,
  maxLength: number,
): MsaSequence[] {
  if (!annotationEntry?.data) return [];

  const gapSequence = ' '.repeat(maxLength);
  const auxiliaries: MsaSequence[] = [];
  const { data } = annotationEntry;

  // Structural variants layer
  const structuralVariants = data.variants.filter(v => v.source !== 'morisette');
  if (structuralVariants.length > 0) {
    auxiliaries.push({
      id: `aux__${primary.id}__variants`,
      name: `variants`,
      sequence: gapSequence,
      rowIndex: -1,
      originType: 'auxiliary',
      family: primary.family,
      parentSequenceId: primary.id,
      layerType: toLayerType({ kind: 'variants' }),
      layerLabel: `variants (${structuralVariants.length})`,
    });
  }

  // One row per ligand site that exists in the data
  for (const site of data.ligandSites) {
    auxiliaries.push({
      id: `aux__${primary.id}__ligand__${site.id}`,
      name: site.ligandId,
      sequence: gapSequence,
      rowIndex: -1,
      originType: 'auxiliary',
      family: primary.family,
      parentSequenceId: primary.id,
      layerType: toLayerType({ kind: 'ligand', id: site.id }),
      layerLabel: `${site.ligandId} (${site.residueCount}r)`,
    });
  }

  return auxiliaries;
}

/** Build per-chain PTM tracks for a given parent sequence.
 *  Modifications are filtered to those whose taxId is in the chain's
 *  visibility.includedSpeciesTaxIds (which is seeded to [chain's own taxId] but
 *  can be expanded by the user through the PTM dropdown's species pills/search).
 *  Each enabled PTM type becomes one aux track; cells in that track may come from
 *  multiple species when the user has selected more than one. */
function buildModificationSequences(
  primary: MsaSequence,
  annotationEntry: ChainAnnotationEntry | null,
  maxLength: number,
): MsaSequence[] {
  if (!annotationEntry?.data) return [];

  const gapSequence = ' '.repeat(maxLength);
  const tracks: MsaSequence[] = [];
  const { data, visibility } = annotationEntry;
  const speciesSet = new Set(visibility.includedSpeciesTaxIds ?? []);
  if (speciesSet.size === 0) return [];

  for (const modType of visibility.visibleModificationTypes ?? []) {
    const modsOfType = data.modifications.filter(
      m => m.modificationType === modType && m.taxId != null && speciesSet.has(m.taxId)
    );
    if (modsOfType.length === 0) continue;
    tracks.push({
      id: `aux__${primary.id}__ptm__${modType}`,
      name: modType,
      sequence: gapSequence,
      rowIndex: -1,
      originType: 'auxiliary',
      family: primary.family,
      parentSequenceId: primary.id,
      layerType: toLayerType({ kind: 'ptm', id: modType }),
      layerLabel: `${modType.charAt(0).toUpperCase() + modType.slice(1)} (${modsOfType.length})`,
    });
  }

  return tracks;
}

/** Build global annotation-track rows. These are not chain-scoped: each track
 *  paints master columns of its own family.
 *
 *  Tracks ALWAYS appear in the panel regardless of which families are currently
 *  displayed -- this is the user's mental model "I added a track, I should see it".
 *  Cells naturally don't paint when the track's family doesn't match a displayed
 *  MSA (the master_index refers to columns in the other family's master). The
 *  label carries a family tag (α/β) plus a "(family not loaded)" suffix when
 *  appropriate so the user can tell the difference between "loaded but empty"
 *  and "loaded and painted".
 *
 *  parentSequenceId is intentionally undefined -- this is what marks the row as
 *  global in the painting pipeline (see colorRulesSelector.computeAuxiliaryCellColors). */
function buildTrackSequences(
  tracks: TrackEntry[],
  displayedFamilies: Set<string>,
  maxLength: number,
): MsaSequence[] {
  if (tracks.length === 0) return [];
  const gapSequence = ' '.repeat(maxLength);
  return tracks.map(t => {
    const count = t.resolved?.length;
    const familyTag =
      t.spec.family === 'tubulin_alpha' ? 'α'
      : t.spec.family === 'tubulin_beta' ? 'β'
      : t.spec.family === 'tubulin_gamma' ? 'γ'
      : '?';
    const familyMatch = displayedFamilies.has(t.spec.family);
    const statusSuffix =
      t.isLoading ? ' loading…'
      : t.error ? ' error'
      : count == null ? ''
      : ` (${count})`;
    const mismatchSuffix = familyMatch ? '' : ' — family not loaded';
    return {
      id: `aux__track__${t.spec.id}`,
      name: t.spec.label,
      sequence: gapSequence,
      rowIndex: -1,
      originType: 'auxiliary' as const,
      family: t.spec.family,
      // parentSequenceId left undefined: global row
      layerType: toLayerType({ kind: 'track', id: t.spec.id }),
      layerLabel: `${familyTag} ${t.spec.label}${statusSuffix}${mismatchSuffix}`,
    };
  });
}

/** Interleave auxiliary sequences (variants, ligands, PTMs) under their parent chain,
 *  then append global annotation-track rows in a fixed band at the bottom.
 *  Order inside each chain group: [primary] -> [variants] -> [ligands] -> [PTM types ...].
 *  PTM rows render whenever any types are enabled for that chain (independent of
 *  the expand toggle, since they are explicitly opted in via the PTMs dropdown).
 *  Also inserts a single 'spacer' row at the master->pdb boundary to visually
 *  separate the reference alignment from the loaded chains. */
function interleaveAuxiliaries(
  primaries: MsaSequence[],
  expandedSet: Set<string>,
  annotationChains: Record<string, ChainAnnotationEntry>,
  tracks: TrackEntry[],
  maxLength: number,
): MsaSequence[] {
  const result: MsaSequence[] = [];
  const gapSequence = ' '.repeat(maxLength);
  let spacerInserted = false;

  for (const seq of primaries) {
    // Insert a single empty spacer row at the boundary from master to pdb.
    if (!spacerInserted && seq.originType === 'pdb') {
      const hasMasterAlready = result.some(r => r.originType === 'master');
      if (hasMasterAlready) {
        result.push({
          id: '__spacer__master_pdb__',
          name: '',
          sequence: gapSequence,
          rowIndex: -1,
          originType: 'spacer',
        });
      }
      spacerInserted = true;
    }

    result.push(seq);

    if (seq.originType !== 'pdb') continue;

    const chainKey = seq.chainRef
      ? makeChainKey(seq.chainRef.pdbId, seq.chainRef.chainId)
      : null;
    if (!chainKey) continue;

    const entry = annotationChains[chainKey] ?? null;

    // All aux rows (variants, ligands, PTMs) collapse with the parent: they only
    // render when the chevron is open. The PTMs dropdown still controls *which*
    // PTM types are listed for the chain; expanding shows them inline below.
    if (expandedSet.has(seq.id)) {
      for (const aux of buildAuxiliarySequences(seq, entry, maxLength)) {
        result.push(aux);
      }
      for (const ptm of buildModificationSequences(seq, entry, maxLength)) {
        result.push(ptm);
      }
    }
  }

  // Append global annotation-track rows, filtered to families present in the panel.
  const displayedFamilies = new Set<string>();
  for (const seq of primaries) {
    if (seq.family) displayedFamilies.add(seq.family);
  }
  for (const trackRow of buildTrackSequences(tracks, displayedFamilies, maxLength)) {
    result.push(trackRow);
  }

  return result;
}

// ────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────

const TUBULIN_FAMILIES = new Set(['tubulin_alpha', 'tubulin_beta']);

function buildChainOptions(
  profile: StructureProfile | null,
  polymerComponents: PolymerComponent[]
): ChainOption[] {
  if (!profile) return [];

  return polymerComponents
    .map(pc => {
      const poly = profile.polypeptides.find(p => p.auth_asym_id === pc.chainId);
      const entity = poly ? profile.entities[poly.entity_id] as PolypeptideEntity | undefined : undefined;
      const family = entity && 'family' in entity ? (entity.family ?? undefined) : undefined;

      return {
        chainId: pc.chainId,
        family,
        familyLabel: family ? formatFamilyShort(family) : undefined,
        organism: entity?.src_organism_names?.[0],
        seqLength: entity?.sequence_length ?? 0,
        uniprotId: entity?.uniprot_accessions?.[0],
        isotype: entity && 'isotype' in entity ? ((entity as any).isotype ?? undefined) : undefined,
      };
    })
    .filter(opt => opt.family && TUBULIN_FAMILIES.has(opt.family));
}

// ────────────────────────────────────────────
// Component
// ────────────────────────────────────────────

export const SequenceAlignmentPanel = forwardRef<MSAHandle, SequenceAlignmentPanelProps>(
  function SequenceAlignmentPanel(props, ref) {
    const {
      chainId,
      onChainChange,
      profile,
      instance,
      polymerComponents,
      pdbId,
      onClose,
      alignedStructures = [],
      onResidueHover,
      onResidueLeave,
      onChainRowMapChange,
      onClearColors,
      onWindowMaskChange,
      onWindowMaskClear,
      onResidueContextMenu,
      onDisplaySequencesChange,
      onExpandedChainKeysChange,
      onAddAlignment,
      forceExpandAll = false,
    } = props;

    const msaRef = useRef<ResizableMSAContainerHandle>(null);

    const dispatch = useAppDispatch();

    // Nightingale web components must be loaded before rendering
    const { areLoaded: nglLoaded } = useNightingaleComponents();

    // Ref to avoid stale closure in imperative handle
    const selectResidueImplRef = useRef<(chainKey: string, masterIdx: number, authSeqId: number) => void>(() => {});

    // Expose MSAHandle to parent
    useImperativeHandle(ref, () => ({
      redraw: () => msaRef.current?.redraw(),
      jumpToRange: (s, e) => msaRef.current?.jumpToRange(s, e),
      setColorScheme: (s) => msaRef.current?.setColorScheme(s),
      setHighlight: (s, e) => msaRef.current?.setHighlight(s, e),
      setCellHighlight: (r, c) => msaRef.current?.setCellHighlight(r, c),
      setCrosshairHighlight: (r, c) => msaRef.current?.setCrosshairHighlight(r, c),
      clearHighlight: () => msaRef.current?.clearHighlight(),
      setSelectionHighlight: (r, c) => msaRef.current?.setSelectionHighlight(r, c),
      clearSelectionHighlight: () => msaRef.current?.clearSelectionHighlight(),
      applyPositionColors: (c) => msaRef.current?.applyPositionColors(c),
      applyCellColors: (c) => msaRef.current?.applyCellColors(c),
      clearPositionColors: () => msaRef.current?.clearPositionColors(),
      selectResidueByChainKey: (ck, mi, as) => selectResidueImplRef.current(ck, mi, as),
    }));

    // ── Derived family from chainId ──
    const family = useMemo(
      () => getFamilyForChain(profile, chainId),
      [profile, chainId]
    );

    // ── Chain dropdown options ──
    const chainOptions = useMemo(
      () => buildChainOptions(profile, polymerComponents),
      [profile, polymerComponents]
    );

    // ── Flash animation state ──
    const [flash, setFlash] = useState(false);
    const prevChainRef = useRef(chainId);
    useEffect(() => {
      if (prevChainRef.current !== chainId) {
        prevChainRef.current = chainId;
        setFlash(true);
        const timer = setTimeout(() => setFlash(false), 600);
        return () => clearTimeout(timer);
      }
    }, [chainId]);

    // ── Master data (local only -- never touches Redux) ──
    const fam = (family ?? 'tubulin_alpha') as TubulinFamily;
    const { data: masterData } = useGetMasterProfileQuery(
      { family: fam },
      { skip: !family }
    );
    const maxLength = masterData?.alignment_length ?? 0;

    // Master sequences are computed locally from the RTK Query response.
    // They never enter Redux, so there's no possibility of family mislabeling
    // when switching between chains of different families.
    const masterSequences: MsaSequence[] = useMemo(() => {
      if (!masterData?.sequences || !family) return [];
      return masterData.sequences.map((seq: any, i: number) => ({
        id: `master__${family}__${seq.id}`,
        name: seq.id,
        sequence: seq.sequence,
        rowIndex: i,
        originType: 'master' as const,
        family,
      }));
    }, [masterData, family]);

    // ── Auto-align current chain (PDB sequences still go to Redux for useViewerSync) ──
    const { isAligned } = useAutoAlignFromProfile(
      profile as TubulinStructure | undefined,
      chainId,
      maxLength
    );

    // PDB sequences come from Redux (registered by useAutoAlignFromProfile)
    const allSequences = useAppSelector(state => state.sequenceRegistry.sequences);
    const pdbSequences = useMemo(() => {
      if (!family) return [];
      return Object.values(allSequences)
        .filter(s => s.family === family && (s.originType === 'pdb' || s.originType === 'custom'))
        .sort((a, b) => a.rowIndex - b.rowIndex);
    }, [allSequences, family]);

    // ── Local UI state ──
    const [colorScheme, setColorScheme] = useState('salience-mono');
    const [showMasters, setShowMasters] = useState(true);
    const [inRangeOnly, setInRangeOnly] = useState(false);
    const currentRangeRef = useRef<[number, number] | null>(null);
    const [expandedSequences, setExpandedSequences] = useState<Set<string>>(new Set());

    const handleToggleExpand = useCallback((seqId: string) => {
      setExpandedSequences(prev => {
        const next = new Set(prev);
        if (next.has(seqId)) next.delete(seqId);
        else next.add(seqId);
        return next;
      });
    }, []);

    // export/preview: force every PDB row expanded so aux rows materialize.
    const effectiveExpanded = useMemo(
      () => (forceExpandAll ? new Set(pdbSequences.map(s => s.id)) : expandedSequences),
      [forceExpandAll, pdbSequences, expandedSequences],
    );

    // Annotation data (drives auxiliary track generation)
    const annotationChains = useAppSelector(
      state => state.annotations.chains
    );

    const tracks = useAppSelector(selectAllTracks);

    const displaySequences = useMemo(() => {
      const primaries = showMasters
        ? [...masterSequences, ...pdbSequences]
        : [...pdbSequences];
      return interleaveAuxiliaries(primaries, effectiveExpanded, annotationChains, tracks, maxLength);
    }, [masterSequences, pdbSequences, showMasters, effectiveExpanded, annotationChains, tracks, maxLength]);

    // Emit chain-to-row mapping for Molstar hover crosshair
    useEffect(() => {
      if (!onChainRowMapChange) return;
      const map: Record<string, { chainKey: string; displayRow: number }> = {};
      displaySequences.forEach((seq, idx) => {
        if (seq.originType === 'pdb' && seq.chainRef) {
          const ck = makeChainKey(seq.chainRef.pdbId, seq.chainRef.chainId);
          map[seq.chainRef.chainId] = { chainKey: ck, displayRow: idx };
        }
      });
      onChainRowMapChange(map);
    }, [displaySequences]); // eslint-disable-line react-hooks/exhaustive-deps

    // Emit full display sequences (includes auxiliaries) for correct color rule row indexing
    useEffect(() => {
      onDisplaySequencesChange?.(displaySequences);
    }, [displaySequences]); // eslint-disable-line react-hooks/exhaustive-deps

    // Emit the set of chain keys whose parent PDB row is expanded.
    // For pdb sequences the seq.id IS the chain key, so the expanded set maps 1:1 to chain keys
    // for any entry that is present in pdbSequences.
    useEffect(() => {
      if (!onExpandedChainKeysChange) return;
      const pdbIds = new Set(pdbSequences.map(s => s.id));
      const expandedChainKeys = new Set<string>();
      for (const id of effectiveExpanded) {
        if (pdbIds.has(id)) expandedChainKeys.add(id);
      }
      onExpandedChainKeysChange(expandedChainKeys);
    }, [effectiveExpanded, pdbSequences]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Primary chain visibility (driven by Molstar component state in Redux) ──
    const primaryVisible = useAppSelector(state => {
      if (!chainId) return true;
      return state.molstarInstances.instances.structure.componentStates[chainId]?.visible ?? true;
    });

    // ── Visibility for primary + aligned chains ──
    const visibleChainKeys = useMemo(() => {
      const set = new Set<string>();
      if (pdbId && chainId && primaryVisible) set.add(makeChainKey(pdbId, chainId));
      for (const a of alignedStructures) {
        if (a.visible) set.add(makeChainKey(a.sourcePdbId, a.sourceChainId));
      }
      return set;
    }, [pdbId, chainId, primaryVisible, alignedStructures]);

    const handleToggleChainVisibility = useCallback((chainKey: string) => {
      if (!instance) return;
      // Aligned chains toggle via the aligned-structure visibility API.
      for (const a of alignedStructures) {
        if (makeChainKey(a.sourcePdbId, a.sourceChainId) === chainKey) {
          instance.setAlignedStructureVisible(a.targetChainId, a.id, !a.visible);
          return;
        }
      }
      // Primary chain toggles via the component visibility API. Redux state is updated
      // synchronously by setChainVisibility, so `primaryVisible` (and `visibleChainKeys`)
      // re-derive on next render.
      if (pdbId && chainId && makeChainKey(pdbId, chainId) === chainKey) {
        instance.setChainVisibility(chainId, !primaryVisible);
      }
    }, [instance, alignedStructures, pdbId, chainId, primaryVisible]);

    const handleRemoveAlignedChain = useCallback((chainKey: string) => {
      if (!instance) return;
      for (const a of alignedStructures) {
        if (makeChainKey(a.sourcePdbId, a.sourceChainId) === chainKey) {
          instance.removeAlignedStructureById(a.targetChainId, a.id);
          dispatch(clearChain(chainKey));
          return;
        }
      }
    }, [instance, alignedStructures, dispatch]);

    const handleSoloChain = useCallback((soloChainKey: string) => {
      if (!instance) return;
      for (const a of alignedStructures) {
        const ck = makeChainKey(a.sourcePdbId, a.sourceChainId);
        instance.setAlignedStructureVisible(a.targetChainId, a.id, ck === soloChainKey);
      }
    }, [instance, alignedStructures]);

    // ── Range mask ──
    const handleDisplayRangeChange = useCallback((start: number, end: number) => {
      currentRangeRef.current = [start, end];
      if (inRangeOnly) onWindowMaskChange?.(start, end);
      // Re-flush selection highlight after nightingale redraws (range changes wipe highlight regions)
      const sel = selectedResidueRef.current;
      if (sel) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const idx = displaySequencesRef.current.findIndex(s => s.id === sel.seqId);
            if (idx >= 0) msaRef.current?.setSelectionHighlight(idx, sel.column);
          });
        });
      }
    }, [inRangeOnly, onWindowMaskChange]);

    const handleInRangeToggle = useCallback((checked: boolean) => {
      setInRangeOnly(checked);
      if (!checked) {
        onWindowMaskClear?.();
      } else if (currentRangeRef.current) {
        onWindowMaskChange?.(currentRangeRef.current[0], currentRangeRef.current[1]);
      }
    }, [onWindowMaskChange, onWindowMaskClear]);

    // ── Toolbar callbacks ──
    const handleSchemeChange = useCallback((scheme: string) => {
      setColorScheme(scheme);
      onClearColors?.();
      msaRef.current?.setColorScheme(scheme);
    }, [onClearColors]);

    const handleJumpToRange = useCallback(
      (start: number, end: number) => msaRef.current?.jumpToRange(start, end),
      []
    );

    const handleReset = useCallback(() => {
      onClearColors?.();
      setColorScheme('salience-mono');
      msaRef.current?.setColorScheme('salience-mono');
    }, [onClearColors]);

    // ── MSA interaction callbacks ──
    // Position mapping (master_index -> auth_seq_id) for MSA click -> Molstar focus
    const sequenceKey = pdbId && chainId ? makeChainKey(pdbId, chainId) : '';
    const positionMapping = useAppSelector(state =>
      sequenceKey ? selectPositionMapping(state, sequenceKey) : null
    );
    const allPositionMappings = useAppSelector(state => state.sequenceRegistry.positionMappings);

    // ── Persistent residue selection ──
    const [selectedResidue, setSelectedResidue] = useState<SelectedResidue | null>(null);
    const selectedResidueRef = useRef(selectedResidue);
    selectedResidueRef.current = selectedResidue;
    const displaySequencesRef = useRef(displaySequences);
    displaySequencesRef.current = displaySequences;

    // ── Transient hovered-residue (drives the header chip). Sources: MSA hover
    //    on a structural row, or Molstar 3D hover. When null, the chip falls
    //    back to selectedResidue (or a placeholder).
    const [hoveredResidue, setHoveredResidue] = useState<HoveredResidue | null>(null);

    // Reverse mapping (auth_seq_id -> master_index) per chainKey, computed from
    // the Redux position mappings. Used to translate Molstar 3D hovers into MSA
    // columns for the header display.
    const reverseMappings = useMemo(() => {
      const out: Record<string, Record<number, number>> = {};
      for (const [ck, mapping] of Object.entries(allPositionMappings)) {
        if (!mapping) continue;
        const reverse: Record<number, number> = {};
        for (const [masterStr, authSeqId] of Object.entries(mapping)) {
          if (authSeqId != null) reverse[authSeqId as number] = parseInt(masterStr, 10);
        }
        out[ck] = reverse;
      }
      return out;
    }, [allPositionMappings]);

    const displaySequencesForHoverRef = useRef(displaySequences);
    displaySequencesForHoverRef.current = displaySequences;
    const reverseMappingsRef = useRef(reverseMappings);
    reverseMappingsRef.current = reverseMappings;

    // ── Molstar 3D hover -> hoveredResidue. Mirrors the MSA-side hover path
    //    so the header chip works regardless of which surface the user is
    //    pointing at. ──
    useEffect(() => {
      const viewer = instance?.viewer;
      if (!viewer) return;
      const unsub = viewer.subscribeToHover(info => {
        if (!info) { setHoveredResidue(null); return; }
        // Find a displayed structural sequence whose chainRef matches the
        // hovered auth_asym_id. Iterate so this works for primary + aligned.
        const seqs = displaySequencesForHoverRef.current;
        let match: MsaSequence | undefined;
        let chainKey: string | null = null;
        for (const s of seqs) {
          if (s.originType !== 'pdb' || !s.chainRef) continue;
          if (s.chainRef.chainId !== info.chainId) continue;
          match = s;
          chainKey = makeChainKey(s.chainRef.pdbId, s.chainRef.chainId);
          break;
        }
        if (!match || !chainKey || !match.chainRef) { setHoveredResidue(null); return; }

        const reverse = reverseMappingsRef.current[chainKey];
        const masterIdx = reverse?.[info.authSeqId];
        if (masterIdx == null) { setHoveredResidue(null); return; }

        setHoveredResidue({
          residueLetter: match.sequence[masterIdx - 1] ?? '?',
          chainLabel: `${match.chainRef.pdbId}:${match.chainRef.chainId}`,
          authSeqId: info.authSeqId,
          masterIdx,
        });
      });
      return unsub;
    }, [instance]);

    // Track last hovered residue for context menu (both structural and non-structural)
    const lastHoveredResidueRef = useRef<Omit<MSAContextMenuEvent, 'screenX' | 'screenY'> | null>(null);

    // Clear selection on chain or family change
    useEffect(() => {
      setSelectedResidue(null);
      msaRef.current?.clearSelectionHighlight();
      instance?.viewer.clearSelection();
    }, [chainId, family]); // eslint-disable-line react-hooks/exhaustive-deps

    // Recompute selection highlight row when displaySequences changes (e.g. Reference toggle)
    useEffect(() => {
      if (!selectedResidue) return;
      const idx = displaySequences.findIndex(s => s.id === selectedResidue.seqId);
      if (idx >= 0) {
        msaRef.current?.setSelectionHighlight(idx, selectedResidue.column);
      } else {
        msaRef.current?.clearSelectionHighlight();
      }
    }, [displaySequences]); // eslint-disable-line react-hooks/exhaustive-deps

    // Resolve auxiliary sequence IDs to their parent primary sequence
    const resolveToParent = useCallback((seqId: string): string => {
      const seq = displaySequences.find(s => s.id === seqId);
      if (seq?.originType === 'auxiliary' && seq.parentSequenceId) {
        return seq.parentSequenceId;
      }
      return seqId;
    }, [displaySequences]);

    const handleResidueHover = useCallback(
      (seqId: string, position: number) => {
        const resolvedId = resolveToParent(seqId);
        const seq = displaySequences.find(s => s.id === resolvedId);
        if (seq && seq.originType === 'pdb') {
          // Structural sequence: crosshair (dim column + bold cell)
          const rowIdx = displaySequences.indexOf(seq);
          if (rowIdx >= 0) msaRef.current?.setCrosshairHighlight(rowIdx, position);
          if (seq.chainRef) {
            const ck = makeChainKey(seq.chainRef.pdbId, seq.chainRef.chainId);
            dispatch(setHoveredChain(ck));

            const mapping = ck === sequenceKey ? positionMapping : allPositionMappings[ck] ?? null;
            const authSeq = mapping ? mapping[position + 1] : undefined;
            if (authSeq !== undefined) {
              lastHoveredResidueRef.current = {
                residueLetter: seq.sequence[position] ?? '?',
                masterIndex: position + 1,
                structural: {
                  chainLabel: `${seq.chainRef.pdbId}:${seq.chainRef.chainId}`,
                  authSeqId: authSeq,
                  chainId: seq.chainRef.chainId,
                  pdbId: seq.chainRef.pdbId,
                },
              };
              // Drive the header chip too.
              setHoveredResidue({
                residueLetter: seq.sequence[position] ?? '?',
                chainLabel: `${seq.chainRef.pdbId}:${seq.chainRef.chainId}`,
                authSeqId: authSeq,
                masterIdx: position + 1,
              });
            }
          }
        } else if (seq) {
          // Non-structural (master/custom): highlight whole column + track for context menu
          msaRef.current?.setHighlight(position + 1, position + 1);
          dispatch(setHoveredChain(null));
          lastHoveredResidueRef.current = {
            residueLetter: seq.sequence[position] ?? '?',
            masterIndex: position + 1,
            sequenceName: seq.name || seq.id,
          };
        } else {
          lastHoveredResidueRef.current = null;
        }
        onResidueHover?.(resolvedId, position);
      },
      [onResidueHover, displaySequences, dispatch, sequenceKey, positionMapping, allPositionMappings, resolveToParent]
    );

    const handleResidueLeave = useCallback(
      () => {
        msaRef.current?.clearHighlight();
        dispatch(setHoveredChain(null));
        lastHoveredResidueRef.current = null;
        setHoveredResidue(null);
        onResidueLeave?.();
      },
      [onResidueLeave, dispatch]
    );

    // MSA click -> select residue in MSA + Molstar; double-click -> focus camera
    const lastMSAClickRef = useRef<{ seqId: string; position: number; time: number } | null>(null);
    const DOUBLE_CLICK_MS = 300;

    const handleResidueClick = useCallback(
      (seqId: string, position: number) => {
        const resolvedId = resolveToParent(seqId);
        const seq = displaySequences.find(s => s.id === resolvedId);
        if (!seq || seq.originType !== 'pdb' || !seq.chainRef) return;

        const ck = makeChainKey(seq.chainRef.pdbId, seq.chainRef.chainId);
        const mapping: PositionMapping | null = ck === sequenceKey
          ? positionMapping
          : allPositionMappings[ck] ?? null;
        if (!mapping) return;

        const authSeqId = mapping[position + 1];
        if (authSeqId === undefined) return;
        const authAsymId = authAsymIdFromChainKey(ck);

        // Double-click detection -> focus camera + MSA range adjustment (only if target is off-screen)
        const now = Date.now();
        const last = lastMSAClickRef.current;
        if (last && last.seqId === seqId && last.position === position && now - last.time < DOUBLE_CLICK_MS) {
          lastMSAClickRef.current = null;
          const masterIdx = position + 1;
          const range = currentRangeRef.current;
          const MARGIN = 3;
          const isVisible = range && masterIdx >= range[0] + MARGIN && masterIdx <= range[1] - MARGIN;
          if (!isVisible) {
            const WINDOW = 15;
            msaRef.current?.jumpToRange(Math.max(1, masterIdx - WINDOW), masterIdx + WINDOW);
            // Re-flush selection highlight after range change (nightingale redraw wipes regions)
            if (selectedResidue) {
              const selIdx = displaySequences.findIndex(s => s.id === selectedResidue.seqId);
              if (selIdx >= 0) {
                requestAnimationFrame(() => msaRef.current?.setSelectionHighlight(selIdx, selectedResidue.column));
              }
            }
          }
          if (instance) instance.focusResidue(authAsymId, authSeqId);
          return;
        }
        lastMSAClickRef.current = { seqId, position, time: now };

        // Toggle: clicking the same cell deselects
        if (selectedResidue && selectedResidue.seqId === seqId && selectedResidue.column === position) {
          setSelectedResidue(null);
          msaRef.current?.clearSelectionHighlight();
          instance?.viewer.clearSelection();
        } else {
          const residueLetter = seq.sequence[position] ?? '?';
          const seqIdx = displaySequences.findIndex(s => s.id === seqId);
          setSelectedResidue({
            seqId,
            column: position,
            residueLetter,
            chainLabel: `${seq.chainRef.pdbId}:${seq.chainRef.chainId}`,
            authSeqId,
          });
          // Highlight selection in MSA
          if (seqIdx >= 0) msaRef.current?.setSelectionHighlight(seqIdx, position);

          // Select in Molstar (clear everything first to ensure single selection across all chains)
          if (instance) {
            instance.viewer.clearSelection();
            if (ck === sequenceKey) {
              instance.selectResidue(authAsymId, authSeqId);
            } else {
              const aligned = alignedStructures.find(
                a => makeChainKey(a.sourcePdbId, a.sourceChainId) === ck
              );
              if (aligned) {
                instance.selectAlignedResidue(aligned.targetChainId, aligned.id, aligned.sourceChainId, authSeqId);
              }
            }
          }
        }
      },
      [displaySequences, instance, positionMapping, sequenceKey, allPositionMappings, selectedResidue, alignedStructures, resolveToParent]
    );

    // Imperative select from Molstar click
    selectResidueImplRef.current = (ck: string, masterIdx: number, authSeqId: number) => {
      const column = masterIdx - 1; // convert 1-based master to 0-based column
      const seq = displaySequences.find(s => s.id === ck);
      if (!seq || seq.originType !== 'pdb' || !seq.chainRef) return;
      const seqIdx = displaySequences.indexOf(seq);

      // Toggle if same residue
      if (selectedResidue && selectedResidue.seqId === ck && selectedResidue.column === column) {
        setSelectedResidue(null);
        msaRef.current?.clearSelectionHighlight();
        instance?.viewer.clearSelection();
        return;
      }

      const residueLetter = seq.sequence[column] ?? '?';
      setSelectedResidue({
        seqId: ck,
        column,
        residueLetter,
        chainLabel: `${seq.chainRef.pdbId}:${seq.chainRef.chainId}`,
        authSeqId,
      });
      if (seqIdx >= 0) msaRef.current?.setSelectionHighlight(seqIdx, column);

      // Select in Molstar
      if (instance) {
        instance.viewer.clearSelection();
        const authAsymId = authAsymIdFromChainKey(ck);
        if (ck === sequenceKey) {
          instance.selectResidue(authAsymId, authSeqId);
        } else {
          const aligned = alignedStructures.find(
            a => makeChainKey(a.sourcePdbId, a.sourceChainId) === ck
          );
          if (aligned) {
            instance.selectAlignedResidue(aligned.targetChainId, aligned.id, aligned.sourceChainId, authSeqId);
          }
        }
      }
    };

    // ── Context menu on right-click ──
    const handleContextMenu = useCallback(
      (e: React.MouseEvent) => {
        const hovered = lastHoveredResidueRef.current;
        if (!hovered || !onResidueContextMenu) return;
        e.preventDefault();
        onResidueContextMenu({ ...hovered, screenX: e.clientX, screenY: e.clientY });
      },
      [onResidueContextMenu]
    );


    // ── Loading state ──
    if (!nglLoaded || !family || maxLength === 0 || !isAligned) {
      return (
        <div className="h-full flex flex-col bg-white/70 backdrop-blur overflow-hidden">
          <div className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 border-b border-gray-100 bg-gray-50/40">
            <ResidueDisplayChip
              hovered={null}
              selected={null}
              onClear={() => {}}
            />
            <div className="flex-1" />
            <button
              onClick={onClose}
              className="p-0.5 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
              title="Close sequence panel"
            >
              <X size={14} />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2" />
              <p className="text-sm text-gray-500">
                {!family ? 'Unknown chain family' : 'Loading...'}
              </p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="h-full flex flex-col bg-white/70 backdrop-blur overflow-hidden">
        {/* Header: residue display (left) + tools (right) + close ── */}
        <div className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 border-b border-gray-100 bg-gray-50/40">
          <ResidueDisplayChip
            hovered={hoveredResidue}
            selected={selectedResidue}
            onClear={() => {
              setSelectedResidue(null);
              msaRef.current?.clearSelectionHighlight();
              instance?.viewer.clearSelection();
            }}
          />
          <div className="flex-1 min-w-0 overflow-x-auto">
            <MSAToolbar
              currentScheme={colorScheme}
              maxLength={maxLength}
              onSchemeChange={handleSchemeChange}
              onJumpToRange={handleJumpToRange}
              onReset={handleReset}
              compact
              inRangeOnly={inRangeOnly}
              onInRangeOnlyChange={handleInRangeToggle}
            />
          </div>
          <button
            onClick={onClose}
            className="p-0.5 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
            title="Close sequence panel"
          >
            <X size={14} />
          </button>
        </div>

        {/* MSA content */}
        <div className="flex-1 min-h-0 p-2">
          <ResizableMSAContainer
            key={`msa-${family}`}
            ref={msaRef}
            sequences={displaySequences}
            conservationSequences={masterSequences}
            maxLength={maxLength}
            colorScheme={colorScheme}
            onResidueHover={handleResidueHover}
            onResidueLeave={handleResidueLeave}
            onResidueClick={handleResidueClick}
            onContextMenu={handleContextMenu}
            onDisplayRangeChange={handleDisplayRangeChange}
            visibleChainKeys={visibleChainKeys}
            onToggleChainVisibility={handleToggleChainVisibility}
            onSoloChain={handleSoloChain}
            expandedSequences={effectiveExpanded}
            onToggleExpand={handleToggleExpand}
            onAddAlignment={onAddAlignment}
            primaryPdbId={pdbId}
            primaryChainId={chainId}
            onRemoveAlignedChain={handleRemoveAlignedChain}
            showMasters={showMasters}
            masterCount={masterSequences.length}
            onShowMastersChange={setShowMasters}
          />
        </div>
      </div>
    );
  }
);

// ────────────────────────────────────────────
// Residue Display Chip
// ────────────────────────────────────────────

/** Reserves a slot in the MSA header that always shows a residue. Sources:
 *  hover (Molstar 3D or MSA) takes priority; if no hover, shows the selected
 *  residue with a green outline; if neither, renders a placeholder. */
function ResidueDisplayChip({
  hovered,
  selected,
  onClear,
}: {
  hovered: HoveredResidue | null;
  selected: SelectedResidue | null;
  onClear: () => void;
}) {
  // Hover wins; otherwise fall back to selection; otherwise placeholder.
  const showSelected = !hovered && !!selected;
  const display: { residueLetter: string; chainLabel: string; authSeqId: number } | null =
    hovered ?? (selected
      ? {
          residueLetter: selected.residueLetter,
          chainLabel: selected.chainLabel,
          authSeqId: selected.authSeqId,
        }
      : null);

  if (!display) {
    return (
      <div className="flex items-center gap-1 px-2 py-0.5 border border-dashed border-slate-200 rounded text-[10px] text-slate-400 flex-shrink-0 min-w-[10rem]">
        <span className="italic">hover or click a residue</span>
      </div>
    );
  }

  const baseClasses =
    'flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] flex-shrink-0 min-w-[10rem]';
  const tone = showSelected
    ? 'bg-green-50 border border-green-200 text-green-700'
    : 'bg-slate-50 border border-slate-200 text-slate-600';
  const letterTone = showSelected ? 'text-green-800' : 'text-slate-800';
  const numTone = showSelected ? 'text-green-500' : 'text-slate-400';

  return (
    <div className={`${baseClasses} ${tone}`}>
      <span className={`font-mono font-bold ${letterTone}`}>{display.residueLetter}</span>
      <span>{display.chainLabel}</span>
      <span className={numTone}>#{display.authSeqId}</span>
      {showSelected && (
        <button
          onClick={onClear}
          className="ml-auto text-green-400 hover:text-green-600"
          title="Clear selection"
        >
          <X size={10} />
        </button>
      )}
    </div>
  );
}

// ────────────────────────────────────────────
// Chain Dropdown Header
// ────────────────────────────────────────────

function ChainDropdownHeader({
  chainId,
  chainOptions,
  onChainChange,
  onClose,
  flash,
  inline = false,
}: {
  chainId: string;
  chainOptions: ChainOption[];
  onChainChange: (chainId: string) => void;
  onClose: () => void;
  flash: boolean;
  inline?: boolean;
}) {
  const current = chainOptions.find(o => o.chainId === chainId);

  const wrapperClass = inline
    ? 'flex items-center gap-2 flex-shrink-0'
    : 'flex items-center justify-between px-3 py-1.5 border-b border-gray-100 bg-gray-50/40';

  return (
    <div className={wrapperClass}>
      <div
        className={`flex items-center gap-1.5 transition-colors duration-500 rounded px-1 py-0.5 ${
          flash ? 'bg-blue-100' : 'bg-transparent'
        }`}
      >
        <select
          value={chainId}
          onChange={e => onChainChange(e.target.value)}
          className="text-[11px] font-medium bg-transparent border border-gray-200 rounded px-1.5 py-0.5 cursor-pointer hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-300"
        >
          {chainOptions.map(opt => (
            <option key={opt.chainId} value={opt.chainId}>
              {[opt.chainId, opt.familyLabel, opt.isotype].filter(Boolean).join('  ')}
            </option>
          ))}
        </select>
        {current && (current.organism || current.seqLength) && (
          <span className="text-[10px] text-gray-400 flex items-center gap-1 whitespace-nowrap">
            {current.organism && <span className="italic">{current.organism}</span>}
            {current.seqLength ? <span>{current.seqLength}aa</span> : null}
          </span>
        )}
        {current?.uniprotId && (
          <a
            href={`https://www.uniprot.org/uniprot/${current.uniprotId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-blue-400 hover:text-blue-600"
          >
            {current.uniprotId}
          </a>
        )}
      </div>
      <button
        onClick={onClose}
        className="p-0.5 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
        title="Close sequence panel"
      >
        <X size={14} />
      </button>
    </div>
  );
}
