'use client';

import { Suspense, useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useAppSelector, useAppDispatch, useAppStore } from '@/store/store';
import { selectIsChainAligned, selectPositionMapping, clearPdbSequences } from '@/store/slices/sequence_registry';
import { useMolstarInstance } from '@/components/molstar/services/MolstarInstanceManager';

import { useStructureHoverSync } from '@/hooks/useStructureHoverSync';
import { selectSequencesForFamily } from '@/store/slices/sequence_registry';
import {
  selectLoadedStructure,
  selectPolymerComponents,
  selectLigandComponents,
  selectViewMode,
  selectActiveMonomerChainId,
  selectAlignedStructuresForActiveChain,
} from '@/components/molstar/state/selectors';
import { setPrimaryChain, hideAllVisibility } from '@/store/slices/annotationsSlice';
import { useGetMasterProfileQuery, tubxz_api } from '@/store/tubxz_api';
import { useChainAlignment } from '@/hooks/useChainAlignment';
import { useViewerSync } from '@/hooks/useViewerSync';
import { useResolveTracks } from '@/hooks/useResolveTracks';
import { useMultiChainAnnotations, ChainAnnotationFetcher } from '@/hooks/useMultiChainAnnotations';
import { createClassificationFromProfile } from '@/services/profile_service';
import { getFamilyForChain, StructureProfile } from '@/lib/profile_utils';
import { ViewerToolbar } from '@/components/structure/ViewerToolbar';
import { MonomerToolbar } from '@/components/structure/MonomerToolbar';
import { ChainAnchorPill } from '@/components/structure/ChainAnchorPill';
import { ViewerLayoutBar, type LayoutState } from '@/components/structure/ViewerLayoutBar';
import { AlignmentDialog } from '@/components/monomer/AlignmentDialog';
import { BindingSiteCard, type ActiveBindingSite } from '@/components/structure/BindingSiteCard';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import type { ImperativePanelHandle } from 'react-resizable-panels';
import { SequenceAlignmentPanel, type MSAContextMenuEvent } from '@/components/msa/SequenceAlignmentPanel';
import { ResiduePopupLayer } from '@/components/residue_popup/ResiduePopup';
import type { ResiduePopupTarget } from '@/components/residue_popup/types';
import { API_BASE_URL } from '@/config';
import type { MSAHandle } from '@/components/msa/types';
import { makeChainKey } from '@/lib/chain_key';
// ResidueInfoOverlay available but not currently used
import { useChainFocusSync } from '@/hooks/useChainFocusSync';
import { clearFocus } from '@/store/slices/chainFocusSlice';
import {
  AssistantTargetProvider,
  type AssistantTargetValue,
} from '@/components/assistant/AssistantTargetContext';
import { dispatchViewerActions } from '@/components/assistant/viewerCommandDispatcher';
import type { ViewerResponse } from '@/components/assistant/types';
import type { ActionCard, EntityRef } from '@/components/assistant/globalTypes';
import { ViewerAssistantPanel } from '@/components/assistant/ViewerAssistantPanel';
import {
  searchParamsToStructureView,
  type AlignedChainRef,
  type StructureViewParams,
} from '@/lib/url_state';

// ============================================================
// Loading overlay
// ============================================================

function LoadingOverlay({ text }: { text: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-white/75">
      <div className="text-center">
        <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2" />
        <p className="text-gray-600">{text}</p>
      </div>
    </div>
  );
}

// ============================================================
// Page
// ============================================================

export default function StructureProfilePage() {
  return (
    <Suspense fallback={<div className="h-screen w-screen bg-gray-200" />}>
      <StructureProfilePageInner />
    </Suspense>
  );
}

function StructureProfilePageInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const pdbIdFromUrl = (params.rcsb_id as string)?.toUpperCase();
  const dispatch = useAppDispatch();

  // Snapshot the URL state at mount. Subsequent URL changes don't re-trigger
  // hydration — that prevents loops with router writebacks.
  const [urlInitialState] = useState<StructureViewParams>(() =>
    searchParamsToStructureView(searchParams)
  );
  const urlHydratedRef = useRef(false);
  const [pendingAligns, setPendingAligns] = useState<AlignedChainRef[]>([]);
  const [pendingRange, setPendingRange] = useState<
    { start: number; end: number } | null
  >(null);
  // One-shot guards so the URL-range focus + MSA jump each fire once per mount.
  const rangeFocusedRef = useRef(false);
  const rangeMsaJumpedRef = useRef(false);

  // In-page assistant: surfaced entities + last summary from /nl_query/viewer.
  const [viewerEntities, setViewerEntities] = useState<EntityRef[]>([]);
  const [viewerSummary, setViewerSummary] = useState<string>('');
  const [viewerNavCard, setViewerNavCard] = useState<ActionCard | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const msaRef = useRef<MSAHandle>(null);

  const { instance, isInitialized } = useMolstarInstance(containerRef, 'structure');

  // Redux state
  const loadedStructure = useAppSelector(state => selectLoadedStructure(state, 'structure'));
  const polymerComponents = useAppSelector(state => selectPolymerComponents(state, 'structure'));
  const ligandComponents = useAppSelector(state => selectLigandComponents(state, 'structure'));
  const viewMode = useAppSelector(state => selectViewMode(state, 'structure'));
  const activeChainId = useAppSelector(state => selectActiveMonomerChainId(state, 'structure'));
  const alignedStructures = useAppSelector(state =>
    selectAlignedStructuresForActiveChain(state, 'structure')
  );
  const activeChainKey = activeChainId ? makeChainKey(pdbIdFromUrl, activeChainId) : null;
  const activePositionMapping = useAppSelector(state =>
    activeChainKey ? selectPositionMapping(state, activeChainKey) : null
  );

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<StructureProfile | null>(null);
  const [structureSequenceChainId, setStructureSequenceChainId] = useState<string | null>(null);
  const loadedFromUrlRef = useRef<string | null>(null);

  const isMonomerView = viewMode === 'monomer';

  // The "effective" chain for the sequence panel: monomer mode uses Redux,
  // structure mode uses local state.
  const sequencePanelChainId = isMonomerView ? activeChainId : structureSequenceChainId;

  // Derive active family from profile + effective chain
  const activeFamily = useMemo(
    () => (sequencePanelChainId ? getFamilyForChain(profile, sequencePanelChainId) : undefined),
    [sequencePanelChainId, profile]
  );

  // Only fetch master data at page level in monomer mode (for MonomerSidebar's masterLength).
  // In structure mode, the panel handles its own master data to avoid RTK Query cache interference.
  const fam = (activeFamily ?? 'tubulin_alpha') as import('@/store/tubxz_api').TubulinFamily;
  const { data: masterData } = useGetMasterProfileQuery(
    { family: fam },
    { skip: !activeFamily || !isMonomerView }
  );

  const chainKey = loadedStructure && sequencePanelChainId
    ? makeChainKey(loadedStructure, sequencePanelChainId)
    : '';


  // PDB sequences scoped to the active family (for useViewerSync color rules).
  // Master sequences are now local to the panel and never enter Redux.
  const familySequences = useAppSelector(state => selectSequencesForFamily(state, activeFamily));
  const pdbSequences = useMemo(
    () => familySequences.filter(s => s.originType === 'pdb'),
    [familySequences]
  );

  // Display sequence IDs (including auxiliaries) emitted by SequenceAlignmentPanel.
  // This must match the actual MSA display order for correct color rule row indexing.
  // Fallback to basic masters+pdb order until the panel emits.
  const masterSequenceIds = useMemo(() => {
    if (!masterData?.sequences || !activeFamily) return [];
    return masterData.sequences.map((seq: any, i: number) => `master__${activeFamily}__${seq.id}`);
  }, [masterData, activeFamily]);

  const fallbackVisibleIds = useMemo(
    () => [...masterSequenceIds, ...pdbSequences.map(s => s.id)],
    [masterSequenceIds, pdbSequences]
  );

  const [displaySequenceIds, setDisplaySequenceIds] = useState<string[]>(fallbackVisibleIds);
  const [displaySequencesForSync, setDisplaySequencesForSync] = useState<import('@/store/slices/sequence_registry').MsaSequence[]>([]);
  const [expandedChainKeys, setExpandedChainKeys] = useState<Set<string>>(() => new Set());
  // Once the MSA panel emits its richer (spacer + aux rows) sequence list, it
  // becomes the authoritative source. Otherwise the fallback effect below kept
  // overwriting it whenever PDB/annotation state churned, dropping the spacer
  // row and shifting downstream color-rule row indices by 1 -- i.e., paints
  // landed on the spacer (invisible) row instead of the PDB chain row.
  const hasPanelEmittedRef = useRef(false);

  // Seed displaySequenceIds from fallback until the panel takes over.
  useEffect(() => {
    if (hasPanelEmittedRef.current) return;
    setDisplaySequenceIds(fallbackVisibleIds);
  }, [fallbackVisibleIds]);

  const handleDisplaySequencesChange = useCallback((seqs: import('@/store/slices/sequence_registry').MsaSequence[]) => {
    hasPanelEmittedRef.current = true;
    setDisplaySequencesForSync(seqs);
    setDisplaySequenceIds(seqs.map(s => s.id));
  }, []);

  // Annotation fetchers.
  // In easy mode the page has no "primary" monomer chain — without seeding
  // the fetcher with the structure's polymer chain ids the ligand pills
  // stay empty until the user opens the MSA panel. Preload every polymer
  // chain when in easy mode so ligands surface as soon as the structure
  // is loaded.
  const preloadChainIds = useMemo(
    () => (isMonomerView ? [] : polymerComponents.map(p => p.chainId)),
    [isMonomerView, polymerComponents]
  );
  const { chainsToFetch, primaryChainKey } = useMultiChainAnnotations(
    loadedStructure,
    activeChainId,
    preloadChainIds,
  );
  useChainFocusSync({
    instance,
    primaryPdbId: loadedStructure,
    primaryChainId: activeChainId,
    alignedStructures,
  });

  useEffect(() => {
    if (primaryChainKey && viewMode === 'monomer') {
      dispatch(setPrimaryChain(primaryChainKey));
    } else {
      dispatch(setPrimaryChain(null));
      dispatch(clearFocus());  // <-- add this
    }
  }, [primaryChainKey, viewMode, dispatch]);


  const chainRowMapRef = useRef<Record<string, { chainKey: string; displayRow: number }>>({});

  const handleMolstarResidueSelect = useCallback((ck: string, masterIdx: number, authSeqId: number) => {
    msaRef.current?.selectResidueByChainKey(ck, masterIdx, authSeqId);
  }, [msaRef]);

  // Auto-resolve any annotation tracks that haven't been fetched yet.
  useResolveTracks();

  const { handleMSAHover, handleMSAHoverEnd, handleDisplayRangeChange, clearWindowMask, lastHoveredMolstarResidueRef } = useViewerSync({
    chainKey,
    molstarInstance: instance,
    msaRef,
    visibleSequenceIds: displaySequenceIds,
    displaySequences: displaySequencesForSync,
    chainRowMap: chainRowMapRef.current,
    expandedChainKeys,
    onMolstarResidueSelect: handleMolstarResidueSelect,
  });

  // ── Alignment dialog state (lifted so MSA labels and popups can trigger it) ──
  const [alignDialogOpen, setAlignDialogOpen] = useState(false);
  const handleOpenAlignDialog = useCallback(() => setAlignDialogOpen(true), []);

  // ── Active binding-site state (lifted so toolbox + card can stay in sync) ──
  const [activeBindingSite, setActiveBindingSite] = useState<ActiveBindingSite | null>(null);

  const handleActivateBindingSite = useCallback(async (
    target: Omit<ActiveBindingSite, 'contacts'>
  ) => {
    if (!instance) return;
    const contacts = await instance.focusLigandBindingSite(target.uniqueKey);
    if (contacts === null) return;
    setActiveBindingSite({ ...target, contacts });
  }, [instance]);

  const handleDeactivateBindingSite = useCallback(async () => {
    await instance?.clearBindingSite();
    setActiveBindingSite(null);
  }, [instance]);

  // Wipe binding-site state if we navigate to a different structure — the
  // Molstar component refs we hold would be stale after reload.
  useEffect(() => {
    setActiveBindingSite(null);
  }, [loadedStructure]);

  // ── Direct alignment from popup "+" buttons ──
  const { alignChainFromProfile } = useChainAlignment();
  const store = useAppStore();
  const handleDirectAlign = useCallback(async (pdbId: string, entityOrChainId: string) => {
    if (!instance || !activeChainId) return;
    const masterLen = masterData?.alignment_length ?? 0;
    if (!masterLen) return;

    // Fetch profile imperatively via RTK Query
    const result = dispatch(tubxz_api.endpoints.getStructureProfile.initiate({ rcsbId: pdbId }));
    try {
      const sourceProfile = await result.unwrap();
      const family = activeFamily;

      // Resolve entity_id to auth_asym_id: the variant stores entity_id (e.g. "1"),
      // but loadAlignedStructure needs auth_asym_id (e.g. "A").
      // Look up via polypeptide instances (which have both entity_id and auth_asym_id).
      let authAsymId = entityOrChainId;
      const polyInstance = sourceProfile.polypeptides?.find(
        (p: any) => p.entity_id === entityOrChainId
      );
      if (polyInstance?.auth_asym_id) {
        authAsymId = polyInstance.auth_asym_id;
      }

      // Block duplicates: is this chain already aligned into the viewer?
      if (selectIsChainAligned(store.getState(), pdbId, authAsymId)) {
        alert(`${pdbId}:${authAsymId} is already loaded in the view.`);
        return;
      }

      const ok = await instance.loadAlignedStructure(activeChainId, pdbId, authAsymId, family);
      if (!ok) return;

      const alignResult = alignChainFromProfile(sourceProfile, authAsymId, masterLen);
      if (alignResult && family) {
        const alignedId = `${pdbId}_${authAsymId}_on_${activeChainId}`;
        instance.styleAlignedChainAsGhost(activeChainId, alignedId, family);
      }
    } catch { /* profile fetch failed */ }
    finally { result.unsubscribe(); }
  }, [instance, activeChainId, activeFamily, masterData, dispatch, alignChainFromProfile, store]);

  // Add an already-resolved (rcsb_id, auth_asym_id) chain to the current
  // alignment in place — used by the assistant's AlignChain action. Mirrors
  // handleDirectAlign but takes a resolved auth_asym_id and stays silent (no
  // alert); no-op if the chain is already aligned.
  const alignChainById = useCallback(async (pdbId: string, authAsymId: string) => {
    if (!instance || !activeChainId) return;
    const masterLen = masterData?.alignment_length ?? 0;
    if (!masterLen) return;
    const family = activeFamily;
    // No-op if the resolver picked the primary chain itself (e.g. "add bovine"
    // while already viewing the bovine structure) or a chain already aligned.
    if (pdbId.toUpperCase() === (loadedStructure ?? '').toUpperCase() && authAsymId === activeChainId) return;
    if (selectIsChainAligned(store.getState(), pdbId, authAsymId)) return;
    const result = dispatch(tubxz_api.endpoints.getStructureProfile.initiate({ rcsbId: pdbId }));
    try {
      const sourceProfile = await result.unwrap();
      const ok = await instance.loadAlignedStructure(activeChainId, pdbId, authAsymId, family);
      if (!ok) return;
      const alignResult = alignChainFromProfile(sourceProfile, authAsymId, masterLen);
      if (alignResult && family) {
        const alignedId = `${pdbId}_${authAsymId}_on_${activeChainId}`;
        instance.styleAlignedChainAsGhost(activeChainId, alignedId, family);
      }
    } catch { /* profile fetch / align failed */ }
    finally { result.unsubscribe(); }
  }, [instance, activeChainId, activeFamily, masterData, dispatch, alignChainFromProfile, store, loadedStructure]);

  // ── Residue popups (multi-popup, unified for MSA + Molstar) ──
  const [popups, setPopups] = useState<ResiduePopupTarget[]>([]);

  const addPopup = useCallback((target: ResiduePopupTarget) => {
    setPopups(prev => {
      const filtered = prev.filter(p => p.id !== target.id);
      return [...filtered, target];
    });
  }, []);

  const removePopup = useCallback((id: string) => {
    setPopups(prev => prev.filter(p => p.id !== id));
  }, []);

  const clearPopups = useCallback(() => setPopups([]), []);

  const handleFocusResidue = useCallback((target: ResiduePopupTarget) => {
    // Focus in Molstar
    if (instance && target.chainId && target.authSeqId !== undefined) {
      instance.focusResidue(target.chainId, target.authSeqId);
    }
    // Center MSA around this column
    const WINDOW = 15;
    const col = target.masterIndex;
    msaRef.current?.jumpToRange(Math.max(1, col - WINDOW), col + WINDOW);
  }, [instance]);

  // Right-click popup: track mousedown position, only open popup on mouseup if no drag occurred.
  // We can't use onContextMenu because on macOS it fires on mousedown (before any drag).
  const rightMouseDownPos = useRef<{ x: number; y: number } | null>(null);

  const handleContainerMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 2) {
      rightMouseDownPos.current = { x: e.clientX, y: e.clientY };
    }
  }, []);

  const handleContainerMouseUp = useCallback((e: React.MouseEvent) => {
    if (e.button !== 2) return;
    const down = rightMouseDownPos.current;
    rightMouseDownPos.current = null;
    if (!down) return;

    // If the mouse moved more than 5px, it was a camera drag — don't open popup
    const dx = e.clientX - down.x;
    const dy = e.clientY - down.y;
    if (dx * dx + dy * dy > 25) return;

    const hovered = lastHoveredMolstarResidueRef.current;
    if (!hovered || !hovered.position3d) return;

    const { chainId: hovChainId, authSeqId, masterIdx, position3d } = hovered;
    let residueLetter = '?';
    let chainLabel = `${loadedStructure}:${hovChainId}`;
    const seq = pdbSequences.find(s => s.chainRef?.chainId === hovChainId);
    if (seq) {
      residueLetter = seq.sequence[masterIdx - 1] ?? '?';
      if (seq.chainRef) chainLabel = `${seq.chainRef.pdbId}:${seq.chainRef.chainId}`;
    }

    addPopup({
      id: `${chainLabel}:${authSeqId}`,
      residueLetter,
      label: chainLabel,
      masterIndex: masterIdx,
      authSeqId,
      chainId: hovChainId,
      pdbId: seq?.chainRef?.pdbId ?? loadedStructure ?? undefined,
      family: activeFamily ?? undefined,
      anchor: { mode: 'anchored', position3d },
    });
  }, [lastHoveredMolstarResidueRef, pdbSequences, loadedStructure, addPopup, instance, activeFamily]);

  // Suppress browser context menu on the viewer so it doesn't flash during right-clicks
  const handleSuppressContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  // MSA right-click → anchored (if structural + 3D position available) or static
  const handleMSAContextMenu = useCallback((event: MSAContextMenuEvent) => {
    if (event.structural && instance) {
      // Structural sequence: try to get 3D center for anchored popup
      const { chainLabel, authSeqId, chainId: cId, pdbId: sPdbId } = event.structural;
      const position3d = instance.getResidueCenterPosition(cId, authSeqId);
      if (position3d) {
        addPopup({
          id: `${chainLabel}:${authSeqId}`,
          residueLetter: event.residueLetter,
          label: chainLabel,
          masterIndex: event.masterIndex,
          authSeqId,
          chainId: cId,
          pdbId: sPdbId,
          family: activeFamily ?? undefined,
          anchor: { mode: 'anchored', position3d },
        });
        return;
      }
    }
    // Non-structural or no 3D position: static popup
    const label = event.structural?.chainLabel ?? event.sequenceName ?? 'Unknown';
    const idKey = event.structural
      ? `${event.structural.chainLabel}:${event.structural.authSeqId}`
      : `${event.sequenceName}:${event.masterIndex}`;

    addPopup({
      id: idKey,
      residueLetter: event.residueLetter,
      label,
      masterIndex: event.masterIndex,
      authSeqId: event.structural?.authSeqId,
      chainId: event.structural?.chainId,
      pdbId: event.structural?.pdbId,
      family: activeFamily ?? undefined,
      anchor: { mode: 'static', screenX: event.screenX, screenY: event.screenY },
    });
  }, [instance, addPopup, activeFamily]);


  // Inside the component, after the existing hook calls:
  useStructureHoverSync({
    instanceId: 'structure',
    instance,
    polymerComponents,
    ligandComponents,
    viewMode,
  });
  // Structure loading
  useEffect(() => {
    if (!isInitialized || !instance || !pdbIdFromUrl) return;
    if (loadedFromUrlRef.current === pdbIdFromUrl) return;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      // Start each structure view from a clean slate. The Redux store is
      // session-long (root layout), so PDB sequences from prior structure views
      // linger here — showing as stale MSA rows and, worse, making
      // selectIsChainAligned report the URL's aligned chains as already loaded
      // so pendingAligns skips re-adding them to the freshly-rebuilt 3D scene.
      dispatch(clearPdbSequences());
      try {
        const res = await fetch(`${API_BASE_URL}/structures/${pdbIdFromUrl}/profile`);
        if (!res.ok) throw new Error('Failed to fetch profile');
        const profileData: StructureProfile = await res.json();
        setProfile(profileData);
        const classification = createClassificationFromProfile(profileData);
        const ok = await instance.loadStructure(pdbIdFromUrl, classification);
        if (ok) {
          loadedFromUrlRef.current = pdbIdFromUrl;

          await instance.setStructureGhostColors(true);  // add this

          // Apply URL-driven state once. Mode + chain happen now; aligns and
          // range get staged for later effects (they depend on masterData /
          // activeChainId becoming available).
          if (!urlHydratedRef.current) {
            urlHydratedRef.current = true;
            if (urlInitialState.mode === 'monomer' && urlInitialState.chain) {
              try {
                await instance.enterMonomerView(urlInitialState.chain);
              } catch (e) {
                console.warn('[url-hydration] enterMonomerView failed:', e);
              }
            }
            if (urlInitialState.align?.length) {
              setPendingAligns(urlInitialState.align);
            }
            if (urlInitialState.range) {
              setPendingRange(urlInitialState.range);
            }
          }
        } else {
          throw new Error('Failed to load structure');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [isInitialized, instance, pdbIdFromUrl]);

  // Apply URL-pending residue range. Two independent steps:
  //  - Molstar 3D focus: fires as soon as the active chain is set.
  useEffect(() => {
    if (!pendingRange || !activeChainId || !instance || rangeFocusedRef.current) return;
    instance.focusResidueRange(activeChainId, pendingRange.start, pendingRange.end);
    rangeFocusedRef.current = true;
  }, [pendingRange, activeChainId, instance]);

  //  - MSA scroll: waits for the active chain's position mapping (registered
  //    after the MSA mounts), converts the auth_seq_id range to master-index
  //    columns, and jumps the MSA viewport. Clears pendingRange once it runs.
  useEffect(() => {
    if (!pendingRange || rangeMsaJumpedRef.current) return;
    const msa = msaRef.current;
    // Wait (without consuming the one-shot flag) until a non-empty mapping and
    // the MSA handle are both available, so a late-arriving mapping still jumps.
    if (!msa || !activePositionMapping || Object.keys(activePositionMapping).length === 0) return;
    const masters: number[] = [];
    for (const [masterStr, authSeqId] of Object.entries(activePositionMapping)) {
      if (authSeqId >= pendingRange.start && authSeqId <= pendingRange.end) {
        masters.push(parseInt(masterStr, 10));
      }
    }
    if (masters.length > 0) {
      masters.sort((a, b) => a - b);
      const PAD = 5;
      msa.jumpToRange(Math.max(1, masters[0] - PAD), masters[masters.length - 1] + PAD);
    }
    rangeMsaJumpedRef.current = true;
    setPendingRange(null);
  }, [pendingRange, activePositionMapping]);

  // Apply URL-pending alignments once masterData is loaded for the active
  // family. This mirrors the handleDirectAlign flow used by residue popups:
  // fetch source profile, resolve entity_id → auth_asym_id, load aligned
  // structure into Molstar, register the chain with the MSA.
  useEffect(() => {
    if (pendingAligns.length === 0) return;
    if (!instance || !activeChainId || !activeFamily) return;
    const masterLen = masterData?.alignment_length ?? 0;
    if (!masterLen) return;

    let cancelled = false;
    (async () => {
      for (const ref of pendingAligns) {
        if (cancelled) return;
        const sub = dispatch(
          tubxz_api.endpoints.getStructureProfile.initiate({ rcsbId: ref.pdbId })
        );
        try {
          const sourceProfile = await sub.unwrap();
          let authAsymId = ref.authAsymId;
          const polyInstance = sourceProfile.polypeptides?.find(
            (p: any) => p.entity_id === ref.authAsymId
          );
          if (polyInstance?.auth_asym_id) authAsymId = polyInstance.auth_asym_id;

          if (selectIsChainAligned(store.getState(), ref.pdbId, authAsymId)) continue;

          const ok = await instance.loadAlignedStructure(
            activeChainId,
            ref.pdbId,
            authAsymId,
            activeFamily
          );
          if (!ok) continue;

          const alignResult = alignChainFromProfile(sourceProfile, authAsymId, masterLen);
          if (alignResult) {
            const alignedId = `${ref.pdbId}_${authAsymId}_on_${activeChainId}`;
            instance.styleAlignedChainAsGhost(activeChainId, alignedId, activeFamily);
          }
        } catch (e) {
          console.warn('[url-hydration] align failed for', ref, e);
        } finally {
          sub.unsubscribe();
        }
      }
      if (!cancelled) setPendingAligns([]);
    })();

    return () => { cancelled = true; };
  }, [pendingAligns, instance, activeChainId, activeFamily, masterData, dispatch, store, alignChainFromProfile]);

  // Master sequence registration is now handled by SequenceAlignmentPanel.
  // The page still fetches masterData for MonomerSidebar's masterLength prop.

  // Resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !instance) return;
    const observer = new ResizeObserver(() => {
      requestAnimationFrame(() => instance.viewer.handleResize());
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [instance]);

  // Clear structure sequence panel when entering monomer view
  useEffect(() => {
    if (isMonomerView) setStructureSequenceChainId(null);
  }, [isMonomerView]);
  const handleClearAllAnnotations = useCallback(() => {
    dispatch(hideAllVisibility());
  }, [dispatch]);

  // ── Auto-switch chain in sequence panel on 3D click ──
  const structureSeqChainRef = useRef(structureSequenceChainId);
  structureSeqChainRef.current = structureSequenceChainId;
  const polymerChainIds = useMemo(
    () => new Set(polymerComponents.map(p => p.chainId)),
    [polymerComponents]
  );
  const polymerChainIdsRef = useRef(polymerChainIds);
  polymerChainIdsRef.current = polymerChainIds;

  useEffect(() => {
    if (!instance?.viewer || isMonomerView) return;
    const unsub = instance.viewer.subscribeToClick(info => {
      if (!info) return;
      const currentChain = structureSeqChainRef.current;
      // Only auto-switch if the panel is open and the click is on a different polymer chain
      if (currentChain && info.chainId !== currentChain && polymerChainIdsRef.current.has(info.chainId)) {
        setStructureSequenceChainId(info.chainId);
      }
    });
    return unsub;
  }, [instance, isMonomerView]);

  const showStructureSeqPanel = !isMonomerView && !!structureSequenceChainId;
  const showMonomerPanel = isMonomerView && !!activeChainId;
  const showBottomPanel = showStructureSeqPanel || showMonomerPanel;

  // ── Resizable panel refs + layout state ──
  const molstarPanelRef = useRef<ImperativePanelHandle>(null);
  const msaPanelRef = useRef<ImperativePanelHandle>(null);
  const DEFAULT_MOLSTAR_SIZE = 66;
  const DEFAULT_MSA_SIZE = 34;
  const [layoutState, setLayoutState] = useState<LayoutState>('split');

  const handlePanelLayout = useCallback((sizes: number[]) => {
    const [molstarSize, msaSize] = sizes;
    if (molstarSize === 0 || (msaSize ?? 0) > 99.9) setLayoutState('msa-only');
    else if ((msaSize ?? 0) === 0) setLayoutState('molstar-only');
    else setLayoutState('split');
  }, []);

  // Auto expand/collapse MSA panel based on whether the bottom panel should be visible.
  // In structure (easy) mode, it starts collapsed until a chain is clicked; in monomer
  // mode it follows activeChainId. We keep the molstar panel expanded across the toggle.
  useEffect(() => {
    const msa = msaPanelRef.current;
    if (!msa) return;
    if (showBottomPanel) {
      if (msa.isCollapsed()) {
        msa.expand(DEFAULT_MSA_SIZE);
        msa.resize(DEFAULT_MSA_SIZE);
      }
    } else {
      if (!msa.isCollapsed()) msa.collapse();
    }
    // showBottomPanel is derived above; refs are stable
  }, [showBottomPanel]);

  // Easy mode: when the user opens MSA via the layout bar (no chain selected yet),
  // default to the first polymer chain so the panel has content to render.
  useEffect(() => {
    if (isMonomerView) return;
    if (layoutState === 'molstar-only') return;
    if (structureSequenceChainId) return;
    if (polymerComponents.length === 0) return;
    setStructureSequenceChainId(polymerComponents[0].chainId);
  }, [layoutState, isMonomerView, structureSequenceChainId, polymerComponents]);

  // ── Assistant target: enables the cross-page PillChatInput to drive this viewer ──
  const assistantValue = useMemo<AssistantTargetValue | null>(() => {
    if (!instance || !loadedStructure) return null;
    return {
      target: 'viewer',
      placeholder: 'Ask about this structure...',
      handle: async (text, signal) => {
        const body = {
          text,
          view_context: {
            rcsb_id: loadedStructure,
            chain_ids: polymerComponents.map(p => p.chainId),
            ligand_keys: ligandComponents.map(l => l.uniqueKey),
            view_mode: viewMode,
            active_monomer_chain: activeChainId,
            active_family: activeFamily,
          },
        };
        const resp = await fetch(`${API_BASE_URL}/nl_query/viewer`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
          signal,
        });
        if (!resp.ok) {
          const txt = await resp.text().catch(() => '');
          return { error: `HTTP ${resp.status}: ${txt.slice(0, 200)}` };
        }
        const data = (await resp.json()) as ViewerResponse;
        if (data.kind === 'clarify') {
          // Backend may also attach a nav card alongside the clarification —
          // surface it in the panel so the user has a concrete next step.
          setViewerEntities([]);
          setViewerSummary('');
          setViewerNavCard(data.card ?? null);
          return { clarification: data.clarification };
        }
        if (data.kind === 'nav_card') {
          // Navigation intent — show the card, skip viewer actions entirely.
          setViewerEntities([]);
          setViewerSummary(data.summary ?? '');
          setViewerNavCard(data.card);
          return { summary: data.summary || 'Suggested action ready.' };
        }
        const reports = await dispatchViewerActions(instance, data.actions, { alignChain: alignChainById });
        // Surface entities + summary in the side panel regardless of action
        // success — partial action failure shouldn't kill the panel.
        setViewerEntities(data.entities ?? []);
        setViewerSummary(data.summary ?? '');
        setViewerNavCard(null);
        const failed = reports.filter(r => !r.ok);
        if (failed.length > 0) {
          const detail = failed
            .map(r => `${r.action.type}: ${r.error ?? 'unknown'}`)
            .join('; ');
          return { error: `${failed.length}/${reports.length} failed — ${detail}` };
        }
        return { summary: data.summary || `${reports.length} action(s) applied` };
      },
    };
  }, [
    instance,
    loadedStructure,
    polymerComponents,
    ligandComponents,
    viewMode,
    activeChainId,
    activeFamily,
    alignChainById,
  ]);

  return (
    <AssistantTargetProvider value={assistantValue}>
    <div className="h-screen w-screen overflow-hidden bg-gray-200 relative">
      {chainsToFetch.map(chain => (
        <ChainAnnotationFetcher key={chain.chainKey} {...chain} />
      ))}

      {/* ── Resizable split: Molstar (top) | MSA (bottom) ── */}
      <ResizablePanelGroup
        direction="vertical"
        className="h-screen w-screen"
        onLayout={handlePanelLayout}
      >
        <ResizablePanel
          ref={molstarPanelRef}
          defaultSize={DEFAULT_MOLSTAR_SIZE}
          minSize={20}
          collapsible
          collapsedSize={0}
        >
          <div
            ref={containerRef}
            className="w-full h-full relative"
            onMouseDown={handleContainerMouseDown}
            onMouseUp={handleContainerMouseUp}
            onContextMenu={handleSuppressContextMenu}
          />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel
          ref={msaPanelRef}
          defaultSize={isMonomerView ? DEFAULT_MSA_SIZE : 0}
          minSize={15}
          collapsible
          collapsedSize={0}
        >
          <div className="h-full w-full bg-white border-t border-slate-200/60 overflow-hidden">
            {showBottomPanel && sequencePanelChainId && (
              <SequenceAlignmentPanel
                ref={msaRef}
                chainId={sequencePanelChainId}
                onChainChange={chainId => {
                  if (isMonomerView) {
                    instance?.enterMonomerView(chainId);
                  } else {
                    setStructureSequenceChainId(chainId);
                  }
                }}
                profile={profile}
                instance={instance}
                polymerComponents={polymerComponents}
                pdbId={loadedStructure}
                onClose={() => {
                  if (isMonomerView) {
                    instance?.exitMonomerView();
                  } else {
                    setStructureSequenceChainId(null);
                  }
                }}
                alignedStructures={isMonomerView ? alignedStructures : undefined}
                onResidueHover={handleMSAHover}
                onResidueLeave={handleMSAHoverEnd}
                onChainRowMapChange={(map) => { chainRowMapRef.current = map; }}
                onClearColors={handleClearAllAnnotations}
                onWindowMaskChange={handleDisplayRangeChange}
                onWindowMaskClear={clearWindowMask}
                onResidueContextMenu={handleMSAContextMenu}
                onDisplaySequencesChange={handleDisplaySequencesChange}
                onExpandedChainKeysChange={setExpandedChainKeys}
                onAddAlignment={isMonomerView ? handleOpenAlignDialog : undefined}
              />
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      {(!isInitialized || isLoading) && (
        <LoadingOverlay
          text={isLoading ? 'Loading structure...' : 'Initializing viewer...'}
        />
      )}

      {/* ── Top-left column: ChainAnchorPill + BindingSiteCard (when active).
              ChainAnchorPill gets a higher z-index so its hover popovers
              escape the backdrop-blur stacking context and paint above the
              BindingSiteCard sibling below. ── */}
      {!isLoading && isInitialized && (
        <div className="absolute top-3 left-3 z-20 pointer-events-auto flex flex-col gap-2 items-start">
          <div className="relative z-30">
            <ChainAnchorPill
              loadedStructure={loadedStructure}
              profile={profile}
              polymerComponents={polymerComponents}
              instance={instance}
              activeChainId={activeChainId}
              isMonomerView={isMonomerView}
              msaRef={msaRef}
              activeBindingSite={activeBindingSite}
              onActivateBindingSite={handleActivateBindingSite}
              onDeactivateBindingSite={handleDeactivateBindingSite}
            />
          </div>
          {activeBindingSite && (
            <div className="relative z-10">
              <BindingSiteCard
                site={activeBindingSite}
                instance={instance}
                onClose={handleDeactivateBindingSite}
              />
            </div>
          )}
        </div>
      )}

      {/* ── Top-center: stripped global nav pill ── */}
      {!isLoading && isInitialized && (
        <div className="absolute top-3 left-0 right-0 z-20 pointer-events-none flex justify-center">
          <div className="pointer-events-auto">
            {isMonomerView ? (
              <MonomerToolbar
                instanceId="structure"
                instance={instance}
                loadedStructure={loadedStructure}
                profile={profile}
                activeChainId={activeChainId}
              />
            ) : (
              <ViewerToolbar
                instanceId="structure"
                instance={instance}
                loadedStructure={loadedStructure}
                profile={profile}
                defaultMonomerChainId={
                  structureSequenceChainId ?? polymerComponents[0]?.chainId ?? null
                }
              />
            )}
          </div>
        </div>
      )}

      {/* ── Top-right: ViewerLayoutBar (segmented Molstar / Split / MSA) ──
          In easy mode the bar is always visible so the user can expand the
          MSA on demand even before clicking a chain. */}
      {!isLoading && isInitialized && (
        <div className="absolute top-3 right-3 z-20 pointer-events-auto">
          <ViewerLayoutBar
            molstarPanelRef={molstarPanelRef}
            msaPanelRef={msaPanelRef}
            layoutState={layoutState}
            defaultMolstarSize={DEFAULT_MOLSTAR_SIZE}
            defaultMsaSize={DEFAULT_MSA_SIZE}
          />
        </div>
      )}

      {/* ── In-page assistant panel (entities + summary from /nl_query/viewer) ── */}
      {(viewerEntities.length > 0 || viewerSummary || viewerNavCard) && (
        <ViewerAssistantPanel
          entities={viewerEntities}
          summary={viewerSummary}
          navCard={viewerNavCard}
          instance={instance}
          onDismiss={() => {
            setViewerEntities([]);
            setViewerSummary('');
            setViewerNavCard(null);
          }}
        />
      )}

      {/* ── AlignmentDialog (lifted from MonomerSidebar) ── */}
      {alignDialogOpen && activeChainId && isMonomerView && (
        <AlignmentDialog
          targetChainId={activeChainId}
          targetFamily={activeFamily}
          instance={instance}
          masterLength={masterData?.alignment_length ?? 0}
          alignedStructures={alignedStructures}
          primaryPdbId={loadedStructure}
          onClose={() => setAlignDialogOpen(false)}
        />
      )}

      <ResiduePopupLayer popups={popups} instance={instance} onClose={removePopup} onCloseAll={clearPopups} onFocusResidue={handleFocusResidue} onAlignChain={isMonomerView ? handleDirectAlign : undefined} />
    </div>
    </AssistantTargetProvider>
  );
}