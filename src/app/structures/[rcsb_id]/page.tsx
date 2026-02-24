// src/app/structures/[rcsb_id]/page.tsx
'use client';

import { VariantsPanel } from '@/components/annotations/VariantsPanel';
import { LigandsPanel } from '@/components/annotations/LigandsPanel';
import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useAppSelector, useAppDispatch } from '@/store/store';
import { useMolstarInstance } from '@/components/molstar/services/MolstarInstanceManager';
import { selectSequencesForFamily } from '@/store/slices/sequence_registry';
import {
  selectLoadedStructure,
  selectPolymerComponents,
  selectLigandComponents,
  selectComponentState,
  selectViewMode,
  selectActiveMonomerChainId,
  selectAlignedStructuresForActiveChain,
} from '@/components/molstar/state/selectors';
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
  selectIsChainAligned,
} from '@/store/slices/sequence_registry';
import { LigandSite, setPrimaryChain, Variant } from '@/store/slices/annotationsSlice';
import { useGetMasterProfileQuery } from '@/store/tubxz_api';
import { useChainAlignment } from '@/hooks/useChainAlignment';
import { useNightingaleComponents } from '@/hooks/useNightingaleComponents';
import { useAnnotationVisibility } from '@/hooks/useAnnotationVisibility';
import { useViewerSync } from '@/hooks/useViewerSync';
import { useMultiChainAnnotations, ChainAnnotationFetcher } from '@/hooks/useMultiChainAnnotations';

import { ResizableMSAContainer } from '@/components/msa/ResizableMSAContainer';
import { MSAToolbar } from '@/components/msa/MSAToolbar';
import { AnnotationPanel } from '@/components/msa/AnnotationPanel';
import { API_BASE_URL } from '@/config';
import type { MSAHandle } from '@/components/msa/types';
import type { PolymerComponent, LigandComponent, AlignedStructure } from '@/components/molstar/core/types';
import type { MolstarInstance } from '@/components/molstar/services/MolstarInstance';
import { Eye, EyeOff, Focus, ArrowLeft, Microscope, Plus, X, Loader2 } from 'lucide-react';

// ============================================================
// Types
// ============================================================

interface StructureProfile {
  rcsb_id: string;
  entities: Record<string, { family?: string;[key: string]: any }>;
  polypeptides: Array<{ auth_asym_id: string; entity_id: string }>;
  [key: string]: any;
}

// ============================================================
// Main Page Component
// ============================================================

export default function StructureProfilePage() {
  const params = useParams();
  const pdbIdFromUrl = (params.rcsb_id as string)?.toUpperCase();
  const dispatch = useAppDispatch();

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const msaRef = useRef<MSAHandle>(null);

  // Molstar instance
  const { instance, isInitialized } = useMolstarInstance(containerRef, 'structure');

  // Redux state
  const loadedStructure = useAppSelector(state => selectLoadedStructure(state, 'structure'));
  const polymerComponents = useAppSelector(state => selectPolymerComponents(state, 'structure'));
  const ligandComponents = useAppSelector(state => selectLigandComponents(state, 'structure'));
  const viewMode = useAppSelector(state => selectViewMode(state, 'structure'));
  const activeChainId = useAppSelector(state => selectActiveMonomerChainId(state, 'structure'));
  const alignedStructures = useAppSelector(state => selectAlignedStructuresForActiveChain(state, 'structure'));

  // Local state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<StructureProfile | null>(null);
  const loadedFromUrlRef = useRef<string | null>(null);
  const masterSequencesInitialized = useRef(false);

  // MSA data
  const { areLoaded: nglLoaded } = useNightingaleComponents();

  // ========================================
  // Active family + keys
  // ========================================

  const activeFamily = useMemo(() => {
    if (!activeChainId || !profile) return undefined;
    const poly = profile.polypeptides.find(
      p => p.auth_asym_id === activeChainId
    );
    return poly ? profile.entities[poly.entity_id]?.family : undefined;
  }, [activeChainId, profile]);


  const fam = activeFamily ?? 'tubulin_alpha';
  const { data: masterData } = useGetMasterProfileQuery(
    { family: fam },
    { skip: !activeFamily }
  );

  const chainKey =
    loadedStructure && activeChainId
      ? `${loadedStructure}_${activeChainId}`
      : '';

  const alignmentKey =
    loadedStructure && activeChainId
      ? `${loadedStructure}_${activeChainId}__${activeFamily ?? 'unknown'}`
      : '';



  const familySequences = useAppSelector(state =>
    selectSequencesForFamily(state, activeFamily)
  );

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


  // Position mapping for current chain
  const positionMapping = useAppSelector(state =>
    chainKey ? selectPositionMapping(state, chainKey) : null
  );

  // ============================================================
  // Multi-chain annotation fetching
  // ============================================================

  const { chainsToFetch, primaryChainKey } = useMultiChainAnnotations(
    loadedStructure,
    activeChainId
  );

  // Set primary chain when entering monomer view
  useEffect(() => {
    if (primaryChainKey && viewMode === 'monomer') {
      dispatch(setPrimaryChain(primaryChainKey));
    } else {
      dispatch(setPrimaryChain(null));
    }
  }, [primaryChainKey, viewMode, dispatch]);

  // ============================================================
  // Annotation visibility for primary chain
  // ============================================================

  const {
    ligandSites,
    variants,
    showVariants,
    visibleLigandIds,
    setShowVariants,
    toggleLigand,
    showAll,
    hideAll,
    clearAll,
  } = useAnnotationVisibility(chainKey);
  // ============================================================
  // Viewer synchronization
  // ============================================================

const {
  handleMSAHover,
  handleMSAHoverEnd,
  focusLigandSite,
  focusMutation,
} = useViewerSync({
  chainKey,
  molstarInstance: instance,
  msaRef,
  visibleSequenceIds: allVisibleSequenceIds,  // <-- Fixed
});
  ;


  // ============================================================
  // Structure loading
  // ============================================================

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

  // ============================================================
  // Master sequences initialization
  // ============================================================

  useEffect(() => {
    if (!masterData?.sequences) return;

    masterData.sequences.forEach((seq: any) => {
      dispatch(addSequence({
        id: `master__${fam}__${seq.id}`,     // unique per family
        name: seq.id,
        sequence: seq.sequence,
        originType: 'master',
        family: fam,
      }));
    });
  }, [masterData, fam, dispatch]);


  // ============================================================
  // Resize handling
  // ============================================================

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !instance) return;
    const observer = new ResizeObserver(() => {
      requestAnimationFrame(() => instance.viewer.handleResize());
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [instance]);

  // ============================================================
  // Helper functions
  // ============================================================

  const getFamilyForChain = useCallback((chainId: string): string | undefined => {
    if (!profile) return undefined;
    const poly = profile.polypeptides.find(p => p.auth_asym_id === chainId);
    if (!poly) return undefined;
    return profile.entities[poly.entity_id]?.family;
  }, [profile]);

  const isMonomerView = viewMode === 'monomer';

  // ============================================================
  // Render
  // ============================================================

  return (
    <div className="h-screen w-screen overflow-hidden bg-gray-100">
      {/* Annotation fetchers for all aligned chains */}
      {chainsToFetch.map(chain => (
        <ChainAnnotationFetcher key={chain.chainKey} {...chain} />
      ))}

      <ResizablePanelGroup direction="horizontal" className="h-full w-full">
        {/* Sidebar */}
        <ResizablePanel defaultSize={20} minSize={15} maxSize={30} className="bg-white border-r">
          <div className="relative h-full overflow-hidden">
            <div
              className="flex h-full transition-transform duration-300 ease-in-out"
              style={{ transform: isMonomerView ? 'translateX(-100%)' : 'translateX(0)' }}
            >
              {/* Structure sidebar */}
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

              {/* Monomer sidebar */}
              <div className="w-full h-full flex-shrink-0">
                <MonomerSidebar
                  activeChainId={activeChainId}
                  polymerComponents={polymerComponents}
                  alignedStructures={alignedStructures}
                  instance={instance}
                  pdbId={loadedStructure}

                  loadedStructure={loadedStructure}   // <-- ADD THIS
                  profile={profile}
                  // Annotation controls

                  ligandSites={ligandSites}
                  variants={variants}
                  visibleLigandIds={visibleLigandIds}
                  showVariants={showVariants}
                  onToggleLigand={toggleLigand}
                  onFocusLigand={focusLigandSite}
                  onToggleVariants={setShowVariants}
                  onFocusVariant={focusMutation}
                  onShowAllLigands={showAll}
                  onHideAllLigands={hideAll}
                  onClearAll={clearAll}
                />
              </div>
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Main content */}
        <ResizablePanel defaultSize={80}>
          <ResizablePanelGroup direction="vertical">
            {/* 3D Viewer */}
            <ResizablePanel defaultSize={isMonomerView ? 50 : 100} minSize={30}>
              <div className="relative w-full h-full min-h-0 bg-gray-200">
                <div ref={containerRef} className="w-full h-full" />
                {(!isInitialized || isLoading) && (
                  <LoadingOverlay text={isLoading ? 'Loading structure...' : 'Initializing viewer...'} />
                )}
              </div>
            </ResizablePanel>

            {/* MSA Panel (monomer view only) */}
            {isMonomerView && activeChainId && (
              <>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={50} minSize={20}>
                  <div className="h-full border-t border-gray-300 bg-white min-h-0 flex flex-col overflow-hidden">
                    <MonomerMSAPanel
                      pdbId={loadedStructure}
                      chainId={activeChainId}
                      family={activeFamily}
                      instance={instance}
                      masterSequences={masterSequences}
                      pdbSequences={pdbSequences}
                      maxLength={masterData?.alignment_length ?? 0}
                      nglLoaded={nglLoaded}
                      msaRef={msaRef}
                      onResidueHover={handleMSAHover}
                      onResidueLeave={handleMSAHoverEnd}
                      onClearColors={clearAll}
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

// ============================================================
// Structure Sidebar
// ============================================================

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

      {error && (
        <div className="text-red-500 text-sm mb-4 p-2 bg-red-50 rounded">{error}</div>
      )}

      <section className="mb-6">
        <h2 className="text-sm font-medium text-gray-700 mb-2">Chains</h2>
        <div className="space-y-1">
          {polymerComponents.map(chain => (
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
            {ligandComponents.map(ligand => (
              <LigandRow key={ligand.uniqueKey} ligand={ligand} instance={instance} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ============================================================
// Monomer Sidebar
// ============================================================

interface MonomerSidebarProps {
  activeChainId: string | null;
  polymerComponents: PolymerComponent[];
  alignedStructures: AlignedStructure[];
  instance: MolstarInstance | null;
  pdbId: string | null;
  profile: StructureProfile | null;
  loadedStructure: string | null; // <-- ADD THIS
  // Annotations
  ligandSites: Array<LigandSite>;
  variants: Array<Variant>;
  visibleLigandIds: Set<string>;
  showVariants: boolean;
  onToggleLigand: (siteId: string) => void;
  onFocusLigand: (siteId: string) => void;
  onToggleVariants: (enabled: boolean) => void;
  onFocusVariant: (masterIndex: number) => void;
  onShowAllLigands: () => void;
  onHideAllLigands: () => void;
  onClearAll: () => void;
}

function MonomerSidebar({
  activeChainId,
  polymerComponents,
  alignedStructures,
  instance,
  pdbId,
  profile,
  ligandSites,
  variants,
  visibleLigandIds,
  showVariants,
  loadedStructure,
  onToggleLigand,
  onFocusLigand,
  onToggleVariants,
  onFocusVariant,
  onShowAllLigands,
  onHideAllLigands,
  onClearAll
}: MonomerSidebarProps) {
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

  const activeFamily = activeChainId ? getFamilyForChain(activeChainId) : undefined;

  const formattedFamily = activeFamily
    ? formatFamilyShort(activeFamily)
    : null;

  const alignmentKey =
    loadedStructure && activeChainId
      ? `${loadedStructure}_${activeChainId}__${activeFamily ?? 'unknown'}`
      : '';



  return (
    <div className="h-full bg-white border-r border-gray-200 p-4 flex flex-col overflow-hidden">
      {/* Header */}
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

        {/* Chain switcher */}
        <section className="mb-6">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Switch Chain
          </h2>
          <div className="flex flex-wrap gap-1">
            {polymerComponents.map(chain => (
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

        {/* Aligned structures */}
        <section className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Aligned Structures
            </h2>
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
            {alignedStructures.map(aligned => (
              <AlignedStructureRow
                key={aligned.id}
                aligned={aligned}
                instance={instance}
              />
            ))}
          </div>
        </section>
      </div>

      {/* Annotations panel */}
      {/* Annotations panel */}
      <section className="flex-1 min-h-0 border-t pt-4 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Annotations
          </h2>
          <button
            onClick={onClearAll}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Clear all
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4">
          <VariantsPanel
            variants={variants}
            showVariants={showVariants}
            onToggleVariants={onToggleVariants}
            onFocusVariant={onFocusVariant}
          />

          <LigandsPanel
            ligandSites={ligandSites}
            visibleLigandIds={visibleLigandIds}
            onToggleLigand={onToggleLigand}
            onFocusLigand={onFocusLigand}
            onShowAll={onShowAllLigands}
            onHideAll={onHideAllLigands}
          />

          {ligandSites.length === 0 && variants.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">
              No annotations available
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

// ============================================================
// MSA Panel
// ============================================================

interface MonomerMSAPanelProps {
  pdbId: string | null;
  chainId: string;
  family?: string;
  instance: MolstarInstance | null;
  masterSequences: any[];
  pdbSequences: any[];
  maxLength: number;
  nglLoaded: boolean;
  msaRef: React.RefObject<MSAHandle>;
  onResidueHover: (position: number) => void;
  onResidueLeave: () => void;
  onClearColors: () => void;
}

function MonomerMSAPanel({
  pdbId,
  chainId,
  family,
  instance,
  masterSequences,
  pdbSequences,
  maxLength,
  nglLoaded,
  msaRef,
  onResidueHover,
  onResidueLeave,
  onClearColors,
}: MonomerMSAPanelProps) {
  const { alignChain, isAligning } = useChainAlignment();
  const [colorScheme, setColorScheme] = useState('custom-position');


  const isAligned = useAppSelector(state =>
    pdbId ? selectIsChainAligned(state, pdbId, chainId) : false
  );

  const alignmentAttemptedRef = useRef<Set<string>>(new Set());

  // Auto-align on mount
  useEffect(() => {
    const key = pdbId && chainId
      ? `${pdbId}_${chainId}__${family ?? 'unknown'}`
      : null;

    if (!instance || !pdbId || !chainId) return;
    if (isAligned || isAligning) return;
    if (key && alignmentAttemptedRef.current.has(key)) return;

    if (key) alignmentAttemptedRef.current.add(key);

    alignChain(pdbId, chainId, instance, family).catch(err => {
      console.error('Auto-align failed:', err);
      if (key) alignmentAttemptedRef.current.delete(key);
    });
  }, [instance, pdbId, chainId, family, isAligned, isAligning, alignChain]);

  // In MonomerMSAPanel, change allSequences to just use the full objects:
  const allSequences = useMemo(() => [
    ...masterSequences,
    ...pdbSequences,
  ], [masterSequences, pdbSequences]);
console.log('[MonomerMSAPanel]', {
  family,
  allSequencesCount: allSequences.length,
  allSequences: allSequences.map(s => ({ id: s.id, family: s.family, name: s.name.substring(0, 20) })),
});
  useEffect(() => {
    console.log('[MSAPanel Debug]', {
      family,
      masterCount: masterSequences.length,
      pdbCount: pdbSequences.length,
      masterFamilies: masterSequences.map(s => ({ id: s.id, family: s.family })),
      pdbFamilies: pdbSequences.map(s => ({ id: s.id, family: s.family })),
    });
  }, [family, masterSequences, pdbSequences]);

  const handleSchemeChange = useCallback((scheme: string) => {
    setColorScheme(scheme);
    onClearColors();
    msaRef.current?.setColorScheme(scheme);
  }, [msaRef, onClearColors]);

  const handleJumpToRange = useCallback((start: number, end: number) => {
    msaRef.current?.jumpToRange(start, end);
  }, [msaRef]);

  const handleReset = useCallback(() => {
    onClearColors();
    setColorScheme('clustal2');
    msaRef.current?.setColorScheme('clustal2');
  }, [msaRef, onClearColors]);

  // Event handlers for MSA
  const handleResidueHover = useCallback((seqId: string, position: number) => {
    onResidueHover(position);
  }, [onResidueHover]);

  const handleResidueLeave = useCallback(() => {
    onResidueLeave();
  }, [onResidueLeave]);

  if (!nglLoaded || maxLength === 0 || isAligning) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2" />
          <p className="text-sm text-gray-500">
            {isAligning ? `Aligning ${pdbId}:${chainId}...` : 'Loading...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-2 border-b bg-gray-50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-800">Sequence Alignment</span>
          <span className="text-xs text-gray-400 font-mono">{pdbId}:{chainId}</span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex-shrink-0 px-3 py-1.5 border-b bg-white">
        <MSAToolbar
          currentScheme={colorScheme}
          maxLength={maxLength}
          onSchemeChange={handleSchemeChange}
          onJumpToRange={handleJumpToRange}
          onReset={handleReset}
          compact
        />
      </div>

      {/* MSA Container */}
      <div className="flex-1 min-h-0 p-2">
        <ResizableMSAContainer
          key={`msa-${family ?? 'none'}`}
          ref={msaRef}
          sequences={allSequences}
          maxLength={maxLength}
          colorScheme={colorScheme}
          onResidueHover={handleResidueHover}
          onResidueLeave={handleResidueLeave}
        />

      </div>
    </div>
  );
}

// ============================================================
// Helper Components
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

function formatFamilyShort(family: string): string {
  const tubulinMatch = family.match(/^tubulin_(\w+)$/);
  if (tubulinMatch) return tubulinMatch[1].charAt(0).toUpperCase() + tubulinMatch[1].slice(1);
  const mapMatch = family.match(/^map_(\w+)/);
  if (mapMatch) return mapMatch[1].toUpperCase();
  return family;
}

function ChainRow({
  chain,
  instance,
  family
}: {
  chain: PolymerComponent;
  instance: MolstarInstance | null;
  family?: string;
}) {
  const componentState = useAppSelector(state =>
    selectComponentState(state, 'structure', chain.chainId)
  );
  const familyLabel = family ? formatFamilyShort(family) : null;

  return (
    <div
      className={`flex items-center justify-between py-1 px-2 rounded text-sm cursor-pointer transition-colors ${componentState.hovered ? 'bg-blue-100' : 'hover:bg-gray-100'
        }`}
      onMouseEnter={() => instance?.highlightChain(chain.chainId, true)}
      onMouseLeave={() => instance?.highlightChain(chain.chainId, false)}
      onClick={() => instance?.focusChain(chain.chainId)}
    >
      <div className="flex items-center gap-2">
        <span className="font-mono">{chain.chainId}</span>
        {familyLabel && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
            {familyLabel}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={(e) => { e.stopPropagation(); instance?.enterMonomerView(chain.chainId); }}
          className="p-1 text-gray-400 hover:text-blue-600"
          title="Open monomer view"
        >
          <Microscope size={14} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); instance?.focusChain(chain.chainId); }}
          className="p-1 text-gray-400 hover:text-gray-700"
        >
          <Focus size={14} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); instance?.setChainVisibility(chain.chainId, !componentState.visible); }}
          className="p-1 text-gray-400 hover:text-gray-700"
        >
          {componentState.visible ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
      </div>
    </div>
  );
}

function LigandRow({
  ligand,
  instance
}: {
  ligand: LigandComponent;
  instance: MolstarInstance | null;
}) {
  const componentState = useAppSelector(state =>
    selectComponentState(state, 'structure', ligand.uniqueKey)
  );

  return (
    <div
      className={`flex items-center justify-between py-1 px-2 rounded text-sm cursor-pointer transition-colors ${componentState.hovered ? 'bg-blue-100' : 'hover:bg-gray-100'
        }`}
      onMouseEnter={() => instance?.highlightLigand(ligand.uniqueKey, true)}
      onMouseLeave={() => instance?.highlightLigand(ligand.uniqueKey, false)}
      onClick={() => instance?.focusLigand(ligand.uniqueKey)}
    >
      <span className="font-mono text-xs">
        {ligand.compId} ({ligand.authAsymId}:{ligand.authSeqId})
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={(e) => { e.stopPropagation(); instance?.focusLigand(ligand.uniqueKey); }}
          className="p-1 text-gray-400 hover:text-gray-700"
        >
          <Focus size={14} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); instance?.setLigandVisibility(ligand.uniqueKey, !componentState.visible); }}
          className="p-1 text-gray-400 hover:text-gray-700"
        >
          {componentState.visible ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
      </div>
    </div>
  );
}

function LigandSiteRow({
  site,
  isVisible,
  onToggle,
  onFocus,
}: {
  site: { id: string; ligandId: string; ligandName: string; color: string };
  isVisible: boolean;
  onToggle: () => void;
  onFocus: () => void;
}) {
  return (
    <div className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-gray-50">
      <div className="flex items-center gap-2">
        <div
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: site.color }}
        />
        <span className="text-sm truncate" title={site.ligandName}>
          {site.ligandId}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={onFocus}
          className="p-1 text-gray-400 hover:text-blue-600"
          title="Focus"
        >
          <Focus size={14} />
        </button>
        <button
          onClick={onToggle}
          className="p-1 text-gray-400 hover:text-gray-700"
        >
          {isVisible ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
      </div>
    </div>
  );
}


function AlignedStructureRow({
  aligned,
  instance
}: {
  aligned: AlignedStructure;
  instance: MolstarInstance | null;
}) {
  return (
    <div className="flex items-center justify-between py-1 px-2 rounded text-sm bg-red-50">
      <div className="flex-1 min-w-0">
        <span className="font-mono text-xs">
          {aligned.sourcePdbId}:{aligned.sourceChainId}
        </span>
        {aligned.rmsd !== null && (
          <span className="text-xs text-gray-500 ml-2">
            RMSD: {aligned.rmsd.toFixed(2)}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => instance?.setAlignedStructureVisible(
            aligned.targetChainId,
            aligned.id,
            !aligned.visible
          )}
          className="p-1 text-gray-400 hover:text-gray-700"
        >
          {aligned.visible ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
        <button
          onClick={() => instance?.removeAlignedStructureById(aligned.targetChainId, aligned.id)}
          className="p-1 text-gray-400 hover:text-red-600"
        >
          <X size={14} />
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
  targetFamily,
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
      // 3D structural alignment
      const structuralResult = await instance.loadAlignedStructure(targetChainId, pdbId, chainId);

      if (structuralResult) {
        // Sequence alignment (triggers annotation fetch via ChainAnnotationFetcher)
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
          value={sourcePdbId}
          onChange={(e) => setSourcePdbId(e.target.value)}
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
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="px-2 py-1 text-xs bg-gray-200 rounded hover:bg-gray-300"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}