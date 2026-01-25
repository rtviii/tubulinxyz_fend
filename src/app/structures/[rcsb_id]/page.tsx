// src/app/structures/[rcsb_id]/page_FULL_refactored.tsx
// COMPLETE REFACTORED VERSION using the new SyncDispatcher pattern
// This is the full 800-line implementation with all UI components

'use client';

import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useAppSelector, useAppDispatch } from '@/store/store';
import { useMolstarInstance } from '@/components/molstar/services/MolstarInstanceManager';
import {
  selectLoadedStructure,
  selectPolymerComponents,
  selectLigandComponents,
  selectComponentState,
  selectViewMode,
  selectActiveMonomerChainId,
  selectAlignedStructuresForActiveChain,
} from '@/components/molstar/state/selectors';
import { useChainAnnotationsComposed } from '@/hooks/annotations/useChainAnnotationsComposed';

import { createClassificationFromProfile } from '@/services/profile_service';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  addSequence,
  selectMasterSequences,
  selectPdbSequences,
  selectPositionMapping,

  selectSelectedSequence,

  selectIsChainAligned,
  selectSequenceById,
} from '@/store/slices/sequence_registry';
import { useGetMasterProfileQuery } from '@/store/tubxz_api';
import { useChainAlignment } from '@/hooks/useChainAlignment';
import { useNightingaleComponents } from '@/hooks/useNightingaleComponents';
// import { ResizableMSAContainer, ResizableMSAContainerHandle } from '@/app/msalite/components/ResizableMSAContainer';
import { MSAToolbar } from '@/components/msa/MSAToolbar';
import { API_BASE_URL } from '@/config';
import { PolymerComponent, LigandComponent, AlignedStructure } from '@/components/molstar/core/types';
import { MolstarInstance } from '@/components/molstar/services/MolstarInstance';
import { Eye, EyeOff, Focus, ArrowLeft, Microscope, Plus, X, Loader2 } from 'lucide-react';

// ============================================================
// NEW: Import the refactored sync system
// ============================================================
import { useSync, useSyncHandlers } from '@/hooks/useSync';
import { useBindingSites } from '@/hooks/useBindingSites';
import { BindingSite } from '@/lib/types/sync';
import { AnnotationData, AnnotationPanel, MUTATION_COLOR } from '@/components/msa/AnnotationPanel';
import { ResizableMSAContainer, ResizableMSAContainerHandle } from '@/components/msa/ResizableMSAContainer';
import { SyncDispatcher } from '@/lib/sync/SyncDispatcher';
import { useChainAnnotations } from '@/hooks/useChainAnnotations';
// In page.tsx or a separate constants file
export const TUBULIN_BINDING_SITES: BindingSite[] = [
  {
    id: 'colchicine',
    name: 'Colchicine',
    color: '#e6194b',
    msaRegions: [{ start: 247, end: 260 }, { start: 314, end: 320 }],
  },
  {
    id: 'taxol',
    name: 'Paclitaxel (Taxol)',
    color: '#3cb44b',
    msaRegions: [{ start: 22, end: 28 }, { start: 225, end: 232 }, { start: 272, end: 278 }],
  },
  {
    id: 'vinblastine',
    name: 'Vinblastine',
    color: '#ffe119',
    msaRegions: [{ start: 175, end: 182 }, { start: 212, end: 218 }],
  },
  {
    id: 'gtp',
    name: 'GTP/GDP',
    color: '#4363d8',
    msaRegions: [{ start: 10, end: 20 }, { start: 140, end: 148 }],
  },
  {
    id: 'mapt',
    name: 'MAP/Tau',
    color: '#f58231',
    msaRegions: [{ start: 430, end: 445 }],
  },
];

// Convert the old format to the new format
const BINDING_SITES: BindingSite[] = TUBULIN_BINDING_SITES.map(site => ({
  id: site.id,
  name: site.name,
  color: site.color,
  msaRegions: site.msaRegions,
}));



interface StructureProfile {
  rcsb_id: string;
  entities: Record<string, {
    family?: string;
    [key: string]: any;
  }>;
  polypeptides: Array<{
    auth_asym_id: string;
    entity_id: string;
  }>;
  [key: string]: any;
}

export default function StructureProfilePageRefactored() {
  const params = useParams();
  const pdbIdFromUrl = (params.rcsb_id as string)?.toUpperCase();
  const dispatch = useAppDispatch();

  const containerRef = useRef<HTMLDivElement>(null);
  const msaRef = useRef<ResizableMSAContainerHandle>(null);

  const { instance, isInitialized } = useMolstarInstance(containerRef, 'structure');


  const selectedSequence = useAppSelector(selectSelectedSequence);
  const loadedStructure = useAppSelector((state) => selectLoadedStructure(state, 'structure'));
  const polymerComponents = useAppSelector((state) => selectPolymerComponents(state, 'structure'));
  const ligandComponents = useAppSelector((state) => selectLigandComponents(state, 'structure'));
  const viewMode = useAppSelector((state) => selectViewMode(state, 'structure'));
  const activeChainId = useAppSelector((state) => selectActiveMonomerChainId(state, 'structure'));
  const alignedStructures = useAppSelector((state) => selectAlignedStructuresForActiveChain(state, 'structure'));

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<StructureProfile | null>(null);
  const loadedFromUrlRef = useRef<string | null>(null);
  const masterSequencesInitialized = useRef(false);

  const { areLoaded: nglLoaded } = useNightingaleComponents();
  const { data: masterData } = useGetMasterProfileQuery();
  const masterSequences = useAppSelector(selectMasterSequences);
  const pdbSequences = useAppSelector(selectPdbSequences);

  const sequenceId = loadedStructure && activeChainId ? `${loadedStructure}_${activeChainId}` : null;
  const positionMapping = useAppSelector((state) =>
    sequenceId ? selectPositionMapping(state, sequenceId) : null
  );

  // Core Sync System
  const dispatcher = useSync(msaRef, instance, activeChainId || '', positionMapping);

  // Fetch Real Data
  // Inside StructureProfilePageRefactored in page.tsx


  const {
    ligandSites,
    mutations,
    bindingSites,
    visibleLigandIds,
    showMutations,
    isLoading: annotationsLoading,
    setShowMutations,
    toggleLigand,
    clearAll,           // <-- use this name
    focusLigandSite,
  } = useChainAnnotationsComposed({
    rcsbId: loadedStructure,
    authAsymId: activeChainId,
    dispatcher,
  });


  const activeSequence = useAppSelector(state =>
    sequenceId ? selectSequenceById(state, sequenceId) : null
  );


  // Transform LigandSites to BindingSites for dispatcher and UI

  const {
    annotationMode,
    setAnnotationMode,
    applyToSelected,
    focusSite,
  } = useBindingSites(dispatcher, bindingSites);

  // Sync Redux state to Dispatcher Visuals
  useEffect(() => {
    if (!dispatcher) return;

    // Toggle Ligand Highlights
    bindingSites.forEach(site => {
      const isVisible = ligandSites.find(ls => ls.id === site.id);
      if (isVisible) {
        dispatcher.addBindingSite(site.id, site.name, site.color, ligandSites.find(ls => ls.id === site.id)?.masterIndices || []);
      } else {
        dispatcher.removeBindingSite(site.id);
      }
    });

    // Toggle Mutation Highlights
    if (showMutations && mutations.length > 0) {
      dispatcher.addMutations(
        'active-mutations',
        mutations.map(m => ({ msaPosition: m.masterIndex, color: MUTATION_COLOR })),
        0
      );
    } else {
      dispatcher.removeMutations('active-mutations');
    }
  }, [ligandSites, showMutations, bindingSites, mutations, dispatcher]);

  const annotationData: AnnotationData = useMemo(() => ({
    bindingSites,
    mutations
  }), [bindingSites, mutations]);

  useEffect(() => {
    if (!masterData?.sequences || masterSequencesInitialized.current) return;
    masterData.sequences.forEach((seq: any) => {
      const name = seq.id.split('|')[0];
      dispatch(addSequence({ id: name, name, sequence: seq.sequence, originType: 'master' }));
    });
    masterSequencesInitialized.current = true;
  }, [masterData, dispatch]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !instance) return;
    const observer = new ResizeObserver(() => {
      requestAnimationFrame(() => instance.viewer.handleResize());
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [instance]);

  useEffect(() => {
    if (!isInitialized || !instance || !pdbIdFromUrl) return;
    if (loadedFromUrlRef.current === pdbIdFromUrl) return;

    const loadStructure = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_BASE_URL}/structures/${pdbIdFromUrl}/profile`);
        if (!response.ok) throw new Error('Failed to fetch profile');
        const profileData = await response.json();
        setProfile(profileData);
        const classification = createClassificationFromProfile(profileData);
        const success = await instance.loadStructure(pdbIdFromUrl, classification);
        if (success) {
          loadedFromUrlRef.current = pdbIdFromUrl;
        } else {
          throw new Error('Failed to load structure');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };
    loadStructure();
  }, [isInitialized, instance, pdbIdFromUrl]);

  const getFamilyForChain = useCallback((chainId: string): string | undefined => {
    if (!profile) return undefined;
    const poly = profile.polypeptides.find(p => p.auth_asym_id === chainId);
    if (!poly) return undefined;
    return profile.entities[poly.entity_id]?.family;
  }, [profile]);






  const isMonomerView = viewMode === 'monomer';

  return (
    <div className="h-screen w-screen overflow-hidden bg-gray-100">
      <ResizablePanelGroup direction="horizontal" className="h-full w-full">
        <ResizablePanel defaultSize={20} minSize={15} maxSize={30} className="bg-white border-r">
          <div className="relative h-full overflow-hidden">
            <div
              className="flex h-full transition-transform duration-300 ease-in-out"
              style={{ transform: isMonomerView ? 'translateX(-100%)' : 'translateX(0)' }}
            >
              <div className="w-full h-full flex-shrink-0">
                <StructureSidebar
                  loadedStructure={loadedStructure}
                  polymerComponents={polymerComponents}
                  ligandComponents={ligandComponents}
                  instance={instance}
                  error={error}
                  profile={profile}
                />
              </div>

              <div className="w-full h-full flex-shrink-0">
                <MonomerSidebar
                  activeChainId={activeChainId}
                  polymerComponents={polymerComponents}
                  alignedStructures={alignedStructures}
                  instance={instance}
                  pdbId={loadedStructure}
                  profile={profile}
                  annotationData={annotationData}

                  activeBindingSites={visibleLigandIds}  // was: new Set(ligandSites.map(l => l.id))
                  onToggleSite={toggleLigand}
                  onFocusSite={focusLigandSite}
                  onToggleMutations={setShowMutations}
                  onClearAll={clearAll}
                  showMutations={showMutations}
                  annotationMode={annotationMode}
                  selectedSequence={selectedSequence}
                  onApplyToSelected={applyToSelected}
                  onSetAnnotationMode={setAnnotationMode}
                />
              </div>
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={80}>
          <ResizablePanelGroup direction="vertical">
            <ResizablePanel defaultSize={isMonomerView ? 50 : 100} minSize={30}>
              <div className="relative w-full h-full min-h-0 bg-gray-200">
                <div ref={containerRef} className="w-full h-full" />
                {(!isInitialized || isLoading) && (
                  <LoadingOverlay text={isLoading ? 'Loading structure...' : 'Initializing viewer...'} />
                )}
              </div>
            </ResizablePanel>

            {isMonomerView && activeChainId && (
              <>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={50} minSize={20}>
                  <div className="h-full border-t border-gray-300 bg-white min-h-0 flex flex-col overflow-hidden">
                    <MonomerMSAPanelRefactored
                      pdbId={loadedStructure}
                      chainId={activeChainId}
                      family={getFamilyForChain(activeChainId)}
                      instance={instance}
                      masterSequences={masterSequences}
                      pdbSequences={pdbSequences}
                      maxLength={masterData?.alignment_length ?? 0}
                      nglLoaded={nglLoaded}
                      msaRef={msaRef}
                      dispatcher={dispatcher}
                      activeSites={new Set(ligandSites.map(l => l.id))}
                      toggleSite={toggleLigand}
                      focusSite={focusLigandSite}
                      clearAll={clearAll}
                      showMutations={showMutations}
                      setShowMutations={setShowMutations}
                    />
                  </div>
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}


function StructureSidebar({
  loadedStructure,
  polymerComponents,
  ligandComponents,
  instance,
  error,
  profile,
}: {
  loadedStructure: string | null;
  polymerComponents: PolymerComponent[];
  ligandComponents: LigandComponent[];
  instance: MolstarInstance | null;
  error: string | null;
  profile: StructureProfile | null;
}) {
  const getFamilyForChain = (chainId: string): string | undefined => {
    if (!profile) return undefined;
    const poly = profile.polypeptides.find(p => p.auth_asym_id === chainId);
    if (!poly) return undefined;
    return profile.entities[poly.entity_id]?.family;
  };

  return (
    <div className="h-full bg-white border-r border-gray-200 p-4 overflow-y-auto">
      <h1 className="text-lg font-semibold mb-4">{loadedStructure ?? 'No Structure'}</h1>
      {error && <div className="text-red-500 text-sm mb-4 p-2 bg-red-50 rounded">{error}</div>}
      <section className="mb-6">
        <h2 className="text-sm font-medium text-gray-700 mb-2">Chains</h2>
        <div className="space-y-1">
          {polymerComponents.map((chain) => (
            <ChainRow
              key={chain.chainId}
              chain={chain}
              instance={instance}
              family={getFamilyForChain(chain.chainId)}
            />
          ))}
        </div>
      </section>
      {ligandComponents.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-gray-700 mb-2">Ligands</h2>
          <div className="space-y-1">
            {ligandComponents.map((ligand) => (
              <LigandRow key={ligand.uniqueKey} ligand={ligand} instance={instance} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function MonomerSidebar({
  activeChainId,
  polymerComponents,
  alignedStructures,
  instance,
  pdbId,
  profile,
  annotationData,
  activeBindingSites,
  showMutations,
  onToggleSite,
  onFocusSite,
  onToggleMutations,
  onClearAll,
  annotationMode,
  selectedSequence,
  onApplyToSelected,
  onSetAnnotationMode,
}: {
  activeChainId: string | null;
  polymerComponents: PolymerComponent[];
  alignedStructures: AlignedStructure[];
  instance: MolstarInstance | null;
  pdbId: string | null;
  profile: StructureProfile | null;
  annotationData: AnnotationData;
  activeBindingSites: Set<string>;
  showMutations: boolean;
  onToggleSite: (siteId: string) => void;
  onFocusSite: (siteId: string) => void;
  onToggleMutations: (enabled: boolean) => void;
  onClearAll: () => void;
  annotationMode: any;
  selectedSequence: any;
  onApplyToSelected: (siteId: string, rowIndex: number) => void;
  onSetAnnotationMode: (mode: any) => void;
}) {
  const [showAlignForm, setShowAlignForm] = useState(false);
  const { alignChain } = useChainAlignment();

  const handleBack = () => instance?.exitMonomerView();

  const handleChainSwitch = (chainId: string) => {
    if (chainId !== activeChainId) instance?.switchMonomerChain(chainId);
  };

  const getFamilyForChain = (chainId: string): string | undefined => {
    if (!profile) return undefined;
    const poly = profile.polypeptides.find(p => p.auth_asym_id === chainId);
    if (!poly) return undefined;
    return profile.entities[poly.entity_id]?.family;
  };

  const activeFamily = (() => {
    if (!profile || !activeChainId) return undefined;
    const poly = profile.polypeptides.find(p => p.auth_asym_id === activeChainId);
    if (!poly) return undefined;
    return profile.entities[poly.entity_id]?.family;
  })();

  const formattedFamily = activeFamily ? formatFamilyShort(activeFamily) : null;

  return (
    <div className="h-full bg-white border-r border-gray-200 p-4 flex flex-col overflow-hidden">
      <div className="flex-shrink-0">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft size={16} />
          Back to structure
        </button>
        <h1 className="text-lg font-semibold mb-1">
          Chain {activeChainId}
          {formattedFamily && (
            <span className="ml-2 text-sm font-normal text-gray-500">({formattedFamily})</span>
          )}
        </h1>
        <p className="text-sm text-gray-500 mb-6">{pdbId}</p>

        <section className="mb-6">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Switch Chain</h2>
          <div className="flex flex-wrap gap-1">
            {polymerComponents.map((chain) => (
              <button
                key={chain.chainId}
                onClick={() => handleChainSwitch(chain.chainId)}
                className={`px-2 py-1 text-xs font-mono rounded ${chain.chainId === activeChainId
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                {chain.chainId}
              </button>
            ))}
          </div>
        </section>

        <section className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Aligned Structures</h2>
            <button
              onClick={() => setShowAlignForm(true)}
              className="p-1 text-gray-400 hover:text-blue-600"
            >
              <Plus size={14} />
            </button>
          </div>
          {showAlignForm && activeChainId && (
            <AlignStructureForm
              targetChainId={activeChainId}
              instance={instance}
              onClose={() => setShowAlignForm(false)}
              alignChain={alignChain}
              targetFamily={getFamilyForChain(activeChainId)}
            />
          )}
          <div className="space-y-1 mt-2">
            {alignedStructures.map((aligned) => (
              <AlignedStructureRow
                key={aligned.id}
                aligned={aligned}
                instance={instance}
              />
            ))}
          </div>
        </section>
      </div>

      <section className="flex-1 min-h-0 border-t pt-4 flex flex-col overflow-hidden">
        <AnnotationPanel
          annotations={annotationData}
          activeBindingSites={activeBindingSites}
          showMutations={showMutations}
          annotationMode={annotationMode}
          selectedSequence={selectedSequence}
          onToggleSite={(id, enabled) => onToggleSite(id)} // Adapted to your redux-based toggle
          onApplyToSelected={onApplyToSelected}
          onFocusSite={onFocusSite}
          onToggleMutations={onToggleMutations}
          onClearAll={onClearAll}
          onSetAnnotationMode={onSetAnnotationMode}
        />
      </section>
    </div>
  );
}

function MonomerMSAPanelRefactored({
  pdbId,
  chainId,
  family,
  instance,
  masterSequences,
  pdbSequences,
  maxLength,
  nglLoaded,
  msaRef,
  dispatcher,  // <-- Receive from parent instead of creating new one
  activeSites,
  toggleSite,
  focusSite,
  clearAll,
  showMutations,
  setShowMutations,
}: {
  pdbId: string | null;
  chainId: string;
  family?: string;
  instance: MolstarInstance | null;
  masterSequences: any[];
  pdbSequences: any[];
  maxLength: number;
  nglLoaded: boolean;
  msaRef: React.RefObject<ResizableMSAContainerHandle>;
  dispatcher: SyncDispatcher | null;  // <-- Add type
  activeSites: Set<string>;
  toggleSite: (id: string, e: boolean) => void;
  focusSite: (id: string) => void;
  clearAll: () => void;
  showMutations: boolean;
  setShowMutations: (e: boolean) => void;
}) {
  const { alignChain, isAligning } = useChainAlignment();
  const sequenceId = pdbId ? `${pdbId}_${chainId}` : null;

  const isAligned = useAppSelector((state) =>
    pdbId ? selectIsChainAligned(state, pdbId, chainId) : false
  );

  const positionMapping = useAppSelector((state) =>
    sequenceId ? selectPositionMapping(state, sequenceId) : null
  );

  const { handleResidueHover, handleResidueLeave, handleResidueClick } = useSyncHandlers(
    dispatcher,
    chainId,
    positionMapping
  );

  const alignmentAttemptedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const key = pdbId && chainId ? `${pdbId}_${chainId}` : null;

    // Guards
    if (!instance || !pdbId || !chainId) return;
    if (isAligned || isAligning) return;
    if (key && alignmentAttemptedRef.current.has(key)) return;

    // Mark as attempted BEFORE the async call
    if (key) {
      alignmentAttemptedRef.current.add(key);
    }

    alignChain(pdbId, chainId, instance, family).catch(err => {
      console.error('Auto-align failed:', err);
      // On failure, allow retry by removing from attempted set
      if (key) {
        alignmentAttemptedRef.current.delete(key);
      }
    });
  }, [instance, pdbId, chainId, family, isAligned, isAligning, alignChain]);

  // useEffect(() => {
  //   // Only align if we have the data and it's not already aligned/aligning
  //   if (!instance || !pdbId || !chainId || isAligned || isAligning) return;

  //   alignChain(pdbId, chainId, instance, family).catch(err => {
  //     console.error('Auto-align failed:', err);
  //   });
  // }, [instance, pdbId, chainId, family, isAligned, isAligning, alignChain]);

  const allSequences = useMemo(() => [
    ...masterSequences.map((seq) => ({
      id: seq.id,
      name: seq.name,
      sequence: seq.sequence,
      originType: seq.originType as 'master',
    })),
    ...pdbSequences.map((seq) => ({
      id: seq.id,
      name: seq.name,
      sequence: seq.sequence,
      originType: seq.originType as 'pdb',
      family: seq.family,
    })),
  ], [masterSequences, pdbSequences]);

  const handleReset = useCallback(() => {
    clearAll();
    setShowMutations(false);
    dispatcher?.setColorScheme('clustal2');
  }, [dispatcher, clearAll, setShowMutations]);

  if (!nglLoaded || maxLength === 0 || isAligning) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2" />
          <p className="text-sm text-gray-500">{isAligning ? `Aligning ${pdbId}:${chainId}...` : 'Loading...'}</p>
        </div>
      </div>
    );
  }

  // In MonomerMSAPanelRefactored, add right before the return:

  console.log('[MonomerMSAPanel] Debug:', {
    masterSequences: masterSequences.length,
    pdbSequences: pdbSequences.length,
    allSequences: allSequences.length,
    isAligning,
    isAligned,
    pdbId,
    chainId,
  });
  return (
    <div className="h-full flex flex-col bg-white overflow-hidden">
      <div className="flex-shrink-0 px-4 py-2 border-b bg-gray-50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-800">Sequence Alignment</span>
          <span className="text-xs text-gray-400 font-mono">{pdbId}:{chainId}</span>
        </div>
      </div>
      <div className="flex-shrink-0 px-3 py-1.5 border-b bg-white">
        <MSAToolbar
          currentScheme={dispatcher?.getCurrentColorScheme() || 'clustal2'}  // Now correct!
          maxLength={maxLength}
          onSchemeChange={(s) => { clearAll(); dispatcher?.setColorScheme(s); }}
          onJumpToRange={(s, e) => dispatcher?.dispatch({ type: 'JUMP_TO_RANGE', start: s, end: e })}
          onReset={handleReset}
          compact={true}
        />
      </div>
      <div className="flex-1 min-h-0 p-2">
        <ResizableMSAContainer
          ref={msaRef}
          sequences={allSequences}
          maxLength={maxLength}
          colorScheme={dispatcher?.getCurrentColorScheme() || 'clustal2'}  // Now correct!
          onResidueHover={handleResidueHover}
          onResidueLeave={handleResidueLeave}
          onResidueClick={handleResidueClick}
        />
      </div>
    </div>
  );
}

function formatFamilyShort(family: string): string {
  const tubulinMatch = family.match(/^tubulin_(\w+)$/);
  if (tubulinMatch) return tubulinMatch[1].charAt(0).toUpperCase() + tubulinMatch[1].slice(1);
  const mapMatch = family.match(/^map_(\w+)/);
  if (mapMatch) return mapMatch[1].toUpperCase();
  return family;
}

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

function ChainRow({ chain, instance, family }: { chain: PolymerComponent; instance: MolstarInstance | null; family?: string; }) {
  const componentState = useAppSelector((state) => selectComponentState(state, 'structure', chain.chainId));
  const familyLabel = family ? formatFamilyShort(family) : null;
  return (
    <div
      className={`flex items-center justify-between py-1 px-2 rounded text-sm cursor-pointer transition-colors ${componentState.hovered ? 'bg-blue-100' : 'hover:bg-gray-100'}`}
      onMouseEnter={() => instance?.highlightChain(chain.chainId, true)}
      onMouseLeave={() => instance?.highlightChain(chain.chainId, false)}
      onClick={() => instance?.focusChain(chain.chainId)}
    >
      <div className="flex items-center gap-2">
        <span className="font-mono">{chain.chainId}</span>
        {familyLabel && <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{familyLabel}</span>}
      </div>
      <div className="flex items-center gap-1">
        <button onClick={(e) => { e.stopPropagation(); instance?.enterMonomerView(chain.chainId); }} className="p-1 text-gray-400 hover:text-blue-600" title="Open monomer view">
          <Microscope size={14} />
        </button>
        <button onClick={(e) => { e.stopPropagation(); instance?.focusChain(chain.chainId); }} className="p-1 text-gray-400 hover:text-gray-700">
          <Focus size={14} />
        </button>
        <button onClick={(e) => { e.stopPropagation(); instance?.setChainVisibility(chain.chainId, !componentState.visible); }} className="p-1 text-gray-400 hover:text-gray-700">
          {componentState.visible ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
      </div>
    </div>
  );
}

function LigandRow({ ligand, instance }: { ligand: LigandComponent; instance: MolstarInstance | null }) {
  const componentState = useAppSelector((state) => selectComponentState(state, 'structure', ligand.uniqueKey));
  return (
    <div
      className={`flex items-center justify-between py-1 px-2 rounded text-sm cursor-pointer transition-colors ${componentState.hovered ? 'bg-blue-100' : 'hover:bg-gray-100'}`}
      onMouseEnter={() => instance?.highlightLigand(ligand.uniqueKey, true)}
      onMouseLeave={() => instance?.highlightLigand(ligand.uniqueKey, false)}
      onClick={() => instance?.focusLigand(ligand.uniqueKey)}
    >
      <span className="font-mono text-xs">{ligand.compId} ({ligand.authAsymId}:{ligand.authSeqId})</span>
      <div className="flex items-center gap-1">
        <button onClick={(e) => { e.stopPropagation(); instance?.focusLigand(ligand.uniqueKey); }} className="p-1 text-gray-400 hover:text-gray-700">
          <Focus size={14} />
        </button>
        <button onClick={(e) => { e.stopPropagation(); instance?.setLigandVisibility(ligand.uniqueKey, !componentState.visible); }} className="p-1 text-gray-400 hover:text-gray-700">
          {componentState.visible ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
      </div>
    </div>
  );
}

function AlignStructureForm({
  targetChainId,
  instance,
  onClose,
  alignChain,
  targetFamily
}: {
  targetChainId: string;
  instance: MolstarInstance | null;
  onClose: () => void;
  alignChain: (pdbId: string, chainId: string, inst: MolstarInstance, family?: string) => Promise<any>;
  targetFamily?: string;
}) {
  const [sourcePdbId, setSourcePdbId] = useState('');
  const [sourceChainId, setSourceChainId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const pdbId = sourcePdbId.trim().toUpperCase();
    const chainId = sourceChainId.trim().toUpperCase();

    if (!instance || !pdbId || !chainId) return;

    setLoading(true);
    setError(null);

    try {
      // 1. Structural Alignment (Molstar side)
      // This performs the 3D superposition relative to the targetChainId
      const structuralResult = await instance.loadAlignedStructure(targetChainId, pdbId, chainId);

      if (structuralResult) {
        // 2. Sequence Alignment (MSA side)
        // This triggers the backend call you mentioned to fetch gapped sequence/mapping
        // We pass the targetFamily so the backend knows which Master sequence to use
        await alignChain(pdbId, chainId, instance, targetFamily);
        onClose();
      } else {
        setError('Failed to load or align structure in 3D');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error during alignment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-2 bg-gray-50 rounded space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="PDB ID"
          value={sourcePdbId} onChange={(e) => setSourcePdbId(e.target.value)}
          className="flex-1 px-2 py-1 text-xs border rounded"
          disabled={loading}
        />
        <input
          type="text"
          placeholder="Chain"
          value={sourceChainId}
          onChange={(e) => setSourceChainId(e.target.value)}
          className="w-16 px-2 py-1 text-xs border rounded"
          disabled={loading}
        />
      </div>
      {error && <p className="text-[10px] text-red-500 leading-tight">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading || !sourcePdbId.trim() || !sourceChainId.trim()}
          className="flex-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-1"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : 'Align'}
        </button>
        <button type="button" onClick={onClose} disabled={loading} className="px-2 py-1 text-xs bg-gray-200 rounded hover:bg-gray-300">
          Cancel
        </button>
      </div>
    </form>
  );
}
function AlignedStructureRow({ aligned, instance }: { aligned: AlignedStructure; instance: MolstarInstance | null; }) {
  const handleToggleVisibility = () => instance?.setAlignedStructureVisible(aligned.targetChainId, aligned.id, !aligned.visible);
  const handleRemove = () => instance?.removeAlignedStructureById(aligned.targetChainId, aligned.id);
  return (
    <div className="flex items-center justify-between py-1 px-2 rounded text-sm bg-red-50">
      <div className="flex-1 min-w-0">
        <span className="font-mono text-xs">{aligned.sourcePdbId}:{aligned.sourceChainId}</span>
        {aligned.rmsd !== null && <span className="text-xs text-gray-500 ml-2">RMSD: {aligned.rmsd.toFixed(2)}</span>}
      </div>
      <div className="flex items-center gap-1">
        <button onClick={handleToggleVisibility} className="p-1 text-gray-400 hover:text-gray-700">
          {aligned.visible ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
        <button onClick={handleRemove} className="p-1 text-gray-400 hover:text-red-600">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}