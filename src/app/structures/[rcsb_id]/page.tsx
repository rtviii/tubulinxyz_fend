'use client';

import { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useAppSelector, useAppDispatch } from '@/store/store';
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
// Resizable panels removed — layout is now floating overlays on full-viewport Molstar
import { addSequence } from '@/store/slices/sequence_registry';
import { setPrimaryChain, hideAllVisibility } from '@/store/slices/annotationsSlice';
import { useGetMasterProfileQuery } from '@/store/tubxz_api';
import { useNightingaleComponents } from '@/hooks/useNightingaleComponents';
import { useViewerSync } from '@/hooks/useViewerSync';
import { useMultiChainAnnotations, ChainAnnotationFetcher } from '@/hooks/useMultiChainAnnotations';
import { createClassificationFromProfile } from '@/services/profile_service';
import { getFamilyForChain, StructureProfile } from '@/lib/profile_utils';
import { StructureSidebar } from '@/components/structure/StructureSidebar';
import { ViewerToolbar } from '@/components/structure/ViewerToolbar';
import { StructureSequencePanel } from '@/components/structure/StructureSequencePanel';
import { MonomerSidebar } from '@/components/monomer/MonomerSidebar';
import { MonomerMSAPanel } from '@/components/monomer/MonomerMSAPanel';
import { API_BASE_URL } from '@/config';
import type { MSAHandle } from '@/components/msa/types';
import { makeChainKey } from '@/lib/chain_key';
// ResidueInfoOverlay available but not currently used
import { useChainFocusSync } from '@/hooks/useChainFocusSync';
import { clearFocus } from '@/store/slices/chainFocusSlice';

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
  const params = useParams();
  const pdbIdFromUrl = (params.rcsb_id as string)?.toUpperCase();
  const dispatch = useAppDispatch();

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

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<StructureProfile | null>(null);
  const [structureSequenceChainId, setStructureSequenceChainId] = useState<string | null>(null);
  const loadedFromUrlRef = useRef<string | null>(null);

  // Derive active family from profile + active chain
  const activeFamily = useMemo(
    () => (activeChainId ? getFamilyForChain(profile, activeChainId) : undefined),
    [activeChainId, profile]
  );

  const fam = activeFamily ?? 'tubulin_alpha';
  const { data: masterData } = useGetMasterProfileQuery(
    { family: fam },
    { skip: !activeFamily }
  );

  const chainKey = loadedStructure && activeChainId
    ? makeChainKey(loadedStructure, activeChainId)
    : '';


  // Sequences scoped to the active family
  const familySequences = useAppSelector(state => selectSequencesForFamily(state, activeFamily));
  const masterSequences = useMemo(
    () => familySequences.filter(s => s.originType === 'master'),
    [familySequences]
  );
  const pdbSequences = useMemo(
    () => familySequences.filter(s => s.originType === 'pdb'),
    [familySequences]
  );
  const allVisibleSequenceIds = useMemo(
    () => [...masterSequences, ...pdbSequences].map(s => s.id),
    [masterSequences, pdbSequences]
  );

  // Annotation fetchers
  const { chainsToFetch, primaryChainKey } = useMultiChainAnnotations(
    loadedStructure,
    activeChainId
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


  const { handleMSAHover, handleMSAHoverEnd, focusLigandSite, focusMutation, handleDisplayRangeChange, clearWindowMask } = useViewerSync({
    chainKey,
    molstarInstance: instance,
    msaRef,
    visibleSequenceIds: allVisibleSequenceIds,
  });


  // Inside the component, after the existing hook calls:
  useStructureHoverSync({
    instanceId: 'structure',
    instance,
    polymerComponents,
    ligandComponents,
    viewMode,
  });
  const { areLoaded: nglLoaded } = useNightingaleComponents();
  // Structure loading
  useEffect(() => {
    if (!isInitialized || !instance || !pdbIdFromUrl) return;
    if (loadedFromUrlRef.current === pdbIdFromUrl) return;

    const load = async () => {
      setIsLoading(true);
      setError(null);
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

  // Register master sequences when family data arrives
  useEffect(() => {
    if (!masterData?.sequences) return;
    masterData.sequences.forEach((seq: any) => {
      dispatch(addSequence({
        id: `master__${fam}__${seq.id}`,
        name: seq.id,
        sequence: seq.sequence,
        originType: 'master',
        family: fam,
      }));
    });
  }, [masterData, fam, dispatch]);

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

  const isMonomerView = viewMode === 'monomer';

  // Clear structure sequence panel when entering monomer view
  useEffect(() => {
    if (isMonomerView) setStructureSequenceChainId(null);
  }, [isMonomerView]);
  const handleClearAllAnnotations = useCallback(() => {
    dispatch(hideAllVisibility());
  }, [dispatch]);

  // ── Sidebar width (resizable via drag handle) ──
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const sidebarDragRef = useRef<{ startX: number; startW: number } | null>(null);

  const onSidebarDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    sidebarDragRef.current = { startX: e.clientX, startW: sidebarWidth };
    const onMove = (ev: MouseEvent) => {
      if (!sidebarDragRef.current) return;
      const newW = sidebarDragRef.current.startW + (ev.clientX - sidebarDragRef.current.startX);
      setSidebarWidth(Math.max(220, Math.min(480, newW)));
    };
    const onUp = () => {
      sidebarDragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [sidebarWidth]);

  // ── Sequence panel height (resizable via drag handle) ──
  const [seqPanelHeight, setSeqPanelHeight] = useState(200);
  const seqDragRef = useRef<{ startY: number; startH: number } | null>(null);

  const onSeqDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    seqDragRef.current = { startY: e.clientY, startH: seqPanelHeight };
    const onMove = (ev: MouseEvent) => {
      if (!seqDragRef.current) return;
      const newH = seqDragRef.current.startH + (seqDragRef.current.startY - ev.clientY);
      setSeqPanelHeight(Math.max(100, Math.min(500, newH)));
    };
    const onUp = () => {
      seqDragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [seqPanelHeight]);

  // ── Lifted sidebar tab (for ligand click detection) ──
  const [sidebarTab, setSidebarTab] = useState<'chains' | 'ligands'>('chains');

  // ── Ligand click detection: click on ligand in 3D → switch sidebar to Ligands tab ──
  // Use a ref for ligandComponents to avoid re-subscribing (BehaviorSubject replays last value)
  const ligandComponentsRef = useRef(ligandComponents);
  useEffect(() => { ligandComponentsRef.current = ligandComponents; }, [ligandComponents]);

  useEffect(() => {
    if (!instance || isMonomerView) return;
    // Skip the first (replayed) emission from BehaviorSubject
    let first = true;
    const unsub = instance.viewer.subscribeToClick(info => {
      if (first) { first = false; return; }
      if (!info) return;
      const isLigand = ligandComponentsRef.current.some(
        l => l.authAsymId === info.chainId && l.authSeqId === info.authSeqId
      );
      if (isLigand) setSidebarTab('ligands');
    });
    return unsub;
  }, [instance, isMonomerView]);

  const showStructureSeqPanel = !isMonomerView && !!structureSequenceChainId;
  const showMonomerPanel = isMonomerView && !!activeChainId;
  const showBottomPanel = showStructureSeqPanel || showMonomerPanel;

  return (
    <div className="h-screen w-screen overflow-hidden bg-gray-200">
      {chainsToFetch.map(chain => (
        <ChainAnnotationFetcher key={chain.chainKey} {...chain} />
      ))}

      {/* ── Full-viewport Molstar viewer (base layer) ── */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full" />

      {(!isInitialized || isLoading) && (
        <LoadingOverlay
          text={isLoading ? 'Loading structure...' : 'Initializing viewer...'}
        />
      )}

      {/* ── Floating sidebar overlay ── */}
      <div
        className="absolute top-3 left-3 z-10 pointer-events-none"
        style={{ width: sidebarWidth, maxHeight: 'calc(100vh - 24px)' }}
      >
        <div className="pointer-events-auto flex" style={{ maxHeight: 'calc(100vh - 24px)' }}>
          <div className="relative overflow-hidden flex-1 bg-white/95 backdrop-blur-sm shadow-lg rounded-xl border border-slate-200/60">
            <div
              className="flex transition-transform duration-300 ease-in-out"
              style={{ transform: isMonomerView ? 'translateX(-100%)' : 'translateX(0)' }}
            >
              <div className="w-full flex-shrink-0 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 24px)' }}>
                <StructureSidebar
                  loadedStructure={loadedStructure}
                  polymerComponents={polymerComponents}
                  ligandComponents={ligandComponents}
                  instance={instance}
                  error={error}
                  profile={profile}
                  onShowSequence={setStructureSequenceChainId}
                  activeSequenceChainId={structureSequenceChainId}
                  activeTab={sidebarTab}
                  onTabChange={setSidebarTab}
                />
              </div>
              <div className="w-full h-full flex-shrink-0 overflow-y-auto">
                <MonomerSidebar
                  activeChainId={activeChainId}
                  polymerComponents={polymerComponents}
                  alignedStructures={alignedStructures}
                  instance={instance}
                  pdbId={loadedStructure}
                  profile={profile}
                  masterLength={masterData?.alignment_length ?? 0}
                  msaRef={msaRef}
                />
              </div>
            </div>
          </div>
          {/* Sidebar resize handle */}
          <div
            className="pointer-events-auto w-1.5 cursor-col-resize bg-transparent hover:bg-blue-400/30 transition-colors"
            onMouseDown={onSidebarDragStart}
          />
        </div>
      </div>

      {/* ── Floating toolbar (centered in viewer area) ── */}
      {!isLoading && isInitialized && !isMonomerView && (
        <div
          className="absolute top-3 z-20 pointer-events-auto flex justify-center"
          style={{ left: sidebarWidth + 12, right: 0 }}
        >
          <ViewerToolbar
            instanceId="structure"
            instance={instance}
            loadedStructure={loadedStructure}
            profile={profile}
          />
        </div>
      )}

      {/* ── Floating bottom panel (sequence / MSA) ── */}
      {showBottomPanel && (
        <div
          className="absolute bottom-3 right-3 z-10 pointer-events-none"
          style={{ left: sidebarWidth + 12, height: seqPanelHeight }}
        >
          <div className="pointer-events-auto h-full flex flex-col bg-white/95 backdrop-blur-sm shadow-lg rounded-xl border border-slate-200/60 overflow-hidden">
            {/* Sequence panel resize handle */}
            <div
              className="h-1.5 cursor-row-resize bg-transparent hover:bg-blue-400/30 transition-colors flex-shrink-0"
              onMouseDown={onSeqDragStart}
            />
            <div className="flex-1 min-h-0 overflow-hidden">
              {showStructureSeqPanel && (
                <StructureSequencePanel
                  chainId={structureSequenceChainId!}
                  instance={instance}
                  profile={profile}
                  onClose={() => setStructureSequenceChainId(null)}
                />
              )}
              {showMonomerPanel && (
                <MonomerMSAPanel
                  profile={profile ?? undefined}
                  pdbId={loadedStructure}
                  chainId={activeChainId!}
                  family={activeFamily}
                  instance={instance}
                  masterSequences={masterSequences}
                  pdbSequences={pdbSequences}
                  alignedStructures={alignedStructures}
                  maxLength={masterData?.alignment_length ?? 0}
                  nglLoaded={nglLoaded}
                  msaRef={msaRef}
                  onResidueHover={handleMSAHover}
                  onResidueLeave={handleMSAHoverEnd}
                  onClearColors={handleClearAllAnnotations}
                  onWindowMaskChange={handleDisplayRangeChange}
                  onWindowMaskClear={clearWindowMask}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}