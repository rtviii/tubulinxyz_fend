'use client';

import { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useAppSelector, useAppDispatch } from '@/store/store';
import { useMolstarInstance } from '@/components/molstar/services/MolstarInstanceManager';
import { selectSequencesForFamily } from '@/store/slices/sequence_registry';
import {
  selectLoadedStructure,
  selectPolymerComponents,
  selectLigandComponents,
  selectViewMode,
  selectActiveMonomerChainId,
  selectAlignedStructuresForActiveChain,
} from '@/components/molstar/state/selectors';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { addSequence } from '@/store/slices/sequence_registry';
import { setPrimaryChain, hideAllVisibility } from '@/store/slices/annotationsSlice';
import { useGetMasterProfileQuery } from '@/store/tubxz_api';
import { useNightingaleComponents } from '@/hooks/useNightingaleComponents';
import { useViewerSync } from '@/hooks/useViewerSync';
import { useMultiChainAnnotations, ChainAnnotationFetcher } from '@/hooks/useMultiChainAnnotations';
import { createClassificationFromProfile } from '@/services/profile_service';
import { getFamilyForChain, StructureProfile } from '@/lib/profile_utils';
import { StructureSidebar } from '@/components/structure/StructureSidebar';
import { MonomerSidebar } from '@/components/monomer/MonomerSidebar';
import { MonomerMSAPanel } from '@/components/monomer/MonomerMSAPanel';
import { API_BASE_URL } from '@/config';
import type { MSAHandle } from '@/components/msa/types';
import { makeChainKey } from '@/lib/chain_key';
import { ResidueInfoOverlay } from '@/components/molstar/overlay/ResidueInfoOverlay';

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

  useEffect(() => {
    if (primaryChainKey && viewMode === 'monomer') {
      dispatch(setPrimaryChain(primaryChainKey));
    } else {
      dispatch(setPrimaryChain(null));
    }
  }, [primaryChainKey, viewMode, dispatch]);


  const { handleMSAHover, handleMSAHoverEnd, focusLigandSite, focusMutation, handleDisplayRangeChange, clearWindowMask } = useViewerSync({
    chainKey,
    molstarInstance: instance,
    msaRef,
    visibleSequenceIds: allVisibleSequenceIds,
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
  const handleClearAllAnnotations = useCallback(() => {
    dispatch(hideAllVisibility());
  }, [dispatch]);

  return (
    <div className="h-screen w-screen overflow-hidden bg-gray-100">
      {chainsToFetch.map(chain => (
        <ChainAnnotationFetcher key={chain.chainKey} {...chain} />
      ))}

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
                  masterLength={masterData?.alignment_length ?? 0}
                  msaRef={msaRef}
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

                {/* <ResidueInfoOverlay
                  instance={instance}
                  getLabel={(info) => {
                    // hook this up to whatever you want - variants, annotations, etc.
                    // returning null just shows the chain/residue line above
                    return null;
                  }}
                /> */}
                {(!isInitialized || isLoading) && (
                  <LoadingOverlay
                    text={isLoading ? 'Loading structure...' : 'Initializing viewer...'}
                  />
                )}
              </div>
            </ResizablePanel>

            {isMonomerView && activeChainId && (
              <>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={50} minSize={20}>
                  <div className="h-full border-t border-gray-300 bg-white min-h-0 flex flex-col overflow-hidden">
                    <MonomerMSAPanel
                      profile={profile ?? undefined}
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
                      onClearColors={handleClearAllAnnotations}
                      onWindowMaskChange={handleDisplayRangeChange}
                      onWindowMaskClear={clearWindowMask}
                    />
                  </div>
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>/o
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}