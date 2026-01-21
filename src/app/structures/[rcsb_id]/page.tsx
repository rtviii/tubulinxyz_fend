// src/app/structures/[rcsb_id]/page.tsx
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
import { createClassificationFromProfile } from '@/services/profile_service';
import {
  addSequence,
  selectMasterSequences,
  selectPdbSequences,
  selectPositionMapping,
  selectIsChainAligned,
} from '@/store/slices/sequence_registry';
import { useGetMasterProfileMsaMasterGetQuery } from '@/store/tubxz_api';
import { useChainAlignment } from '@/app/msalite/hooks/useChainAlignment';
import { useNightingaleComponents } from '@/app/msalite/useNightingaleComponents';
import { highlightResidueInInstance, clearHighlightInInstance } from '@/components/molstar/sync/structureSync';
import { MSAViewerPanel } from '@/app/msalite/components/MSAViewerPanel';
import { AnnotationData } from '@/app/msalite/components/AnnotationPanel';
import { API_BASE_URL } from '@/config';
import { PolymerComponent, LigandComponent, AlignedStructure } from '@/components/molstar/core/types';
import { MolstarInstance } from '@/components/molstar/services/MolstarInstance';
import { Eye, EyeOff, Focus, ArrowLeft, Microscope, Plus, X, Loader2 } from 'lucide-react';

// ============================================================
// Types
// ============================================================

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

// ============================================================
// Main Page
// ============================================================

export default function StructureProfilePage() {
  const params = useParams();
  const pdbIdFromUrl = (params.rcsb_id as string)?.toUpperCase();
  const dispatch = useAppDispatch();

  const containerRef = useRef<HTMLDivElement>(null);
  const { instance, isInitialized } = useMolstarInstance(containerRef, 'structure');

  // Redux state
  const loadedStructure = useAppSelector((state) => selectLoadedStructure(state, 'structure'));
  const polymerComponents = useAppSelector((state) => selectPolymerComponents(state, 'structure'));
  const ligandComponents = useAppSelector((state) => selectLigandComponents(state, 'structure'));
  const viewMode = useAppSelector((state) => selectViewMode(state, 'structure'));
  const activeChainId = useAppSelector((state) => selectActiveMonomerChainId(state, 'structure'));
  const alignedStructures = useAppSelector((state) => selectAlignedStructuresForActiveChain(state, 'structure'));

  // Local state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<StructureProfile | null>(null);
  const loadedFromUrlRef = useRef<string | null>(null);
  const masterSequencesInitialized = useRef(false);

  // MSA setup
  const { areLoaded: nglLoaded } = useNightingaleComponents();
  const { data: masterData } = useGetMasterProfileMsaMasterGetQuery();
  const masterSequences = useAppSelector(selectMasterSequences);

  // Initialize master sequences once
  useEffect(() => {
    if (!masterData?.sequences || masterSequencesInitialized.current) return;
    masterData.sequences.forEach((seq: any) => {
      const name = seq.id.split('|')[0];
      dispatch(addSequence({ id: name, name, sequence: seq.sequence, originType: 'master' }));
    });
    masterSequencesInitialized.current = true;
  }, [masterData, dispatch]);

  // Load structure on URL change
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
        setProfile(profileData); // Store for MSA use

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

  // Helper to get family for a chain
  const getFamilyForChain = useCallback((chainId: string): string | undefined => {
    if (!profile) return undefined;
    const poly = profile.polypeptides.find(p => p.auth_asym_id === chainId);
    if (!poly) return undefined;
    return profile.entities[poly.entity_id]?.family;
  }, [profile]);

  const isMonomerView = viewMode === 'monomer';

  return (
    <div className="h-screen w-screen overflow-hidden bg-gray-100">
      <div className="flex h-full">
        {/* Sidebar */}
        <div className="relative w-80 h-full flex-shrink-0 overflow-hidden">
          <div
            className="flex h-full transition-transform duration-300 ease-in-out"
            style={{ transform: isMonomerView ? 'translateX(-100%)' : 'translateX(0)' }}
          >
            <div className="w-80 h-full flex-shrink-0">
              <StructureSidebar
                loadedStructure={loadedStructure}
                polymerComponents={polymerComponents}
                ligandComponents={ligandComponents}
                instance={instance}
                error={error}
                profile={profile}
              />
            </div>
            <div className="w-80 h-full flex-shrink-0">
              <MonomerSidebar
                activeChainId={activeChainId}
                polymerComponents={polymerComponents}
                alignedStructures={alignedStructures}
                instance={instance}
                pdbId={loadedStructure}
                profile={profile}
              />
            </div>
          </div>
        </div>

        {/* Main content area */}
        <div className="flex-1 h-full flex flex-col">
          {/* Molstar viewer */}
          <div
            className={`relative transition-all duration-300 ${isMonomerView ? 'h-1/2' : 'h-full'}`}
          >
            <div ref={containerRef} className="w-full h-full" />
            {(!isInitialized || isLoading) && (
              <LoadingOverlay text={isLoading ? 'Loading structure...' : 'Initializing viewer...'} />
            )}
          </div>
          {isMonomerView && activeChainId && (
            <div className="h-1/2 border-t border-gray-300 bg-white">
              <MonomerMSAPanel
                pdbId={loadedStructure}
                chainId={activeChainId}
                family={getFamilyForChain(activeChainId)}
                instance={instance}
                masterSequences={masterSequences}
                maxLength={masterData?.alignment_length ?? 0}
                nglLoaded={nglLoaded}
                profile={profile}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Monomer MSA Panel
// ============================================================




// Make sure these are at the top of src/app/structures/[rcsb_id]/page.tsx
import { ResizableMSAContainer, ResizableMSAContainerHandle } from '@/app/msalite/components/ResizableMSAContainer';
import { MSAToolbar } from '@/app/msalite/components/MSAToolbar';
import { BindingSitePanel, TUBULIN_BINDING_SITES } from '@/app/msalite/components/BindingSitePanel';
import { useBindingSiteSync } from '@/app/msalite/hooks/useBindingSiteSync';

function MonomerMSAPanel({
  pdbId,
  chainId,
  family,
  instance,
  masterSequences,
  maxLength,
  nglLoaded,
  profile,
}: {
  pdbId           : string | null;
  chainId         : string;
  family         ?: string;
  instance        : MolstarInstance | null;
  masterSequences : any[];
  maxLength       : number;
  nglLoaded       : boolean;
  profile         : StructureProfile | null;
}) {
  const msaRef                        = useRef<ResizableMSAContainerHandle>(null);
  const [colorScheme, setColorScheme] = useState('clustal2');
  const { alignChain, isAligning }    = useChainAlignment();
  const sequenceId                    = pdbId ? `${pdbId}_${chainId}` : null;
  const isAligned                     = useAppSelector((state) => 
    pdbId ? selectIsChainAligned(state, pdbId, chainId) : false
  );
  const pdbSequences    = useAppSelector(selectPdbSequences);
  const positionMapping = useAppSelector((state) => 
    sequenceId ? selectPositionMapping(state, sequenceId) : null
  );

  // Auto-align when entering monomer view
  useEffect(() => {
    if (!instance || !pdbId || !chainId || isAligned || isAligning) return;
    
    alignChain(pdbId, chainId, instance, family).catch(err => {
      console.error('Auto-align failed:', err);
    });
  }, [instance, pdbId, chainId, family, isAligned, isAligning, alignChain]);

  // MSA redraw callback
  const triggerMsaRedraw = useCallback(() => {
    msaRef.current?.setColorScheme('custom-position');
    msaRef.current?.redraw();
    setColorScheme('custom-position');
  }, []);

  // Binding site sync
  const { activeSites, toggleSite, focusSite, clearAll } = useBindingSiteSync({
    sites: TUBULIN_BINDING_SITES,
    chainId,
    positionMapping,
    molstarInstance: instance,
    onMsaRedraw: triggerMsaRedraw,
  });

  // Build sequences for display
  const allSequences = useMemo(() => [
    ...masterSequences.map((seq) => ({ 
      id        : seq.id,
      name      : seq.name,
      sequence  : seq.sequence,
      originType: seq.originType as 'master',
    })),
    ...pdbSequences.map((seq) => ({ 
      id        : seq.id,
      name      : seq.name,
      sequence  : seq.sequence,
      originType: seq.originType as 'pdb',
      family    : seq.family,
    })),
  ], [masterSequences, pdbSequences]);

  const handleResidueHover = useCallback((seqId: string, msaPosition: number) => {
    if (!instance || !positionMapping) return;
    if (seqId !== sequenceId) return;
    
    const authSeqId = positionMapping[msaPosition];
    if (authSeqId !== undefined) {
      highlightResidueInInstance(instance, chainId, authSeqId, true);
    }
  }, [instance, chainId, sequenceId, positionMapping]);

  const handleResidueLeave = useCallback(() => {
    clearHighlightInInstance(instance);
  }, [instance]);

  const handleResidueClick = useCallback((seqId: string, msaPosition: number) => {
    if (!instance || !positionMapping) return;
    if (seqId !== sequenceId) return;
    
    const authSeqId = positionMapping[msaPosition];
    if (authSeqId !== undefined) {
      instance.focusResidue(chainId, authSeqId);
    }
  }, [instance, chainId, sequenceId, positionMapping]);

  const handleJumpToRange = useCallback((start: number, end: number) => {
    msaRef.current?.jumpToRange(start, end);
    
    if (instance && positionMapping) {
      const startAuth = positionMapping[start];
      const endAuth = positionMapping[end];
      if (startAuth !== undefined && endAuth !== undefined) {
        instance.focusResidueRange(chainId, startAuth, endAuth);
      }
    }
  }, [instance, chainId, positionMapping]);

  const handleSchemeChange = useCallback((scheme: string) => {
    clearAll();
    setColorScheme(scheme);
    msaRef.current?.setColorScheme(scheme);
    msaRef.current?.redraw();
  }, [clearAll]);

  const handleReset = useCallback(() => {
    clearAll();
    setColorScheme('clustal2');
    msaRef.current?.setColorScheme('clustal2');
    msaRef.current?.redraw();
  }, [clearAll]);

  if (!nglLoaded || maxLength === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2" />
          <p className="text-sm text-gray-500">Loading MSA components...</p>
        </div>
      </div>
    );
  }

  if (isAligning) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2" />
          <p className="text-sm text-gray-500">Aligning {pdbId}:{chainId}...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="flex-shrink-0 px-3 py-2 border-b bg-gray-50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700">
            {pdbId}:{chainId} Alignment
          </span>
          <span className="text-xs text-gray-500">
            {allSequences.length} seq, {maxLength} pos
          </span>
        </div>
        {activeSites.size > 0 && (
          <button
            onClick={handleReset}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Clear coloring
          </button>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex-shrink-0 px-3 py-1.5 border-b bg-gray-50/50">
        <MSAToolbar
          currentScheme={colorScheme}
          maxLength={maxLength}
          onSchemeChange={handleSchemeChange}
          onJumpToRange={handleJumpToRange}
          onReset={handleReset}
          compact={true}
        />
      </div>

      {/* Main content: MSA + Binding sites panel */}
      <div className="flex-1 min-h-0 flex">
        {/* MSA viewer */}
        <div className="flex-1 min-w-0 p-2">
          <ResizableMSAContainer
            ref={msaRef}
            sequences={allSequences}
            maxLength={maxLength}
            colorScheme={colorScheme}
            onResidueHover={handleResidueHover}
            onResidueLeave={handleResidueLeave}
            onResidueClick={handleResidueClick}
          />
        </div>

        {/* Binding sites panel */}
        <div className="w-48 flex-shrink-0 border-l bg-gray-50 p-2 overflow-y-auto">
          <div className="text-xs font-medium text-gray-600 mb-2">Binding Sites</div>
          <BindingSitePanel
            sites={TUBULIN_BINDING_SITES}
            activeSites={activeSites}
            onSiteToggle={toggleSite}
            onSiteFocus={focusSite}
          />
        </div>
      </div>
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
  // Helper to get family for chain
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

// ============================================================
// Monomer Sidebar
// ============================================================

function MonomerSidebar({
  activeChainId,
  polymerComponents,
  alignedStructures,
  instance,
  pdbId,
  profile,
}: {
  activeChainId: string | null;
  polymerComponents: PolymerComponent[];
  alignedStructures: AlignedStructure[];
  instance: MolstarInstance | null;
  pdbId: string | null;
  profile: StructureProfile | null;
}) {
  const [showAlignForm, setShowAlignForm] = useState(false);

  const handleBack = () => {
    instance?.exitMonomerView();
  };

  const handleChainSwitch = (chainId: string) => {
    if (chainId !== activeChainId) {
      instance?.switchMonomerChain(chainId);
    }
  };

  // Get family for active chain
  const activeFamily = (() => {
    if (!profile || !activeChainId) return undefined;
    const poly = profile.polypeptides.find(p => p.auth_asym_id === activeChainId);
    if (!poly) return undefined;
    return profile.entities[poly.entity_id]?.family;
  })();

  const formattedFamily = activeFamily ? formatFamilyShort(activeFamily) : null;

  return (
    <div className="h-full bg-white border-r border-gray-200 p-4 overflow-y-auto">
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
      <p className="text-sm text-gray-500 mb-4">{pdbId}</p>

      {/* Chain switcher */}
      <section className="mb-6">
        <h2 className="text-sm font-medium text-gray-700 mb-2">Switch Chain</h2>
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

      {/* Aligned structures */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-medium text-gray-700">Aligned Structures</h2>
          <button
            onClick={() => setShowAlignForm(true)}
            className="p-1 text-gray-400 hover:text-blue-600"
            title="Add aligned structure"
          >
            <Plus size={16} />
          </button>
        </div>

        {alignedStructures.length === 0 && !showAlignForm && (
          <p className="text-xs text-gray-400">No aligned structures</p>
        )}

        {showAlignForm && activeChainId && (
          <AlignStructureForm
            targetChainId={activeChainId}
            instance={instance}
            onClose={() => setShowAlignForm(false)}
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

      {/* Annotations placeholder */}
      <section>
        <h2 className="text-sm font-medium text-gray-700 mb-2">Annotations</h2>
        <p className="text-xs text-gray-400">Coming soon...</p>
      </section>
    </div>
  );
}

// ============================================================
// Helper Components (same as before)
// ============================================================

function formatFamilyShort(family: string): string {
  const tubulinMatch = family.match(/^tubulin_(\w+)$/);
  if (tubulinMatch) {
    return tubulinMatch[1].charAt(0).toUpperCase() + tubulinMatch[1].slice(1);
  }
  const mapMatch = family.match(/^map_(\w+)/);
  if (mapMatch) {
    return mapMatch[1].toUpperCase();
  }
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

function ChainRow({
  chain,
  instance,
  family,
}: {
  chain: PolymerComponent;
  instance: MolstarInstance | null;
  family?: string;
}) {
  const componentState = useAppSelector((state) => selectComponentState(state, 'structure', chain.chainId));

  const handleOpenMonomer = () => {
    instance?.enterMonomerView(chain.chainId);
  };

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
          onClick={(e) => {
            e.stopPropagation();
            handleOpenMonomer();
          }}
          className="p-1 text-gray-400 hover:text-blue-600"
          title="Open monomer view"
        >
          <Microscope size={14} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            instance?.focusChain(chain.chainId);
          }}
          className="p-1 text-gray-400 hover:text-gray-700"
        >
          <Focus size={14} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            instance?.setChainVisibility(chain.chainId, !componentState.visible);
          }}
          className="p-1 text-gray-400 hover:text-gray-700"
        >
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
          onClick={(e) => {
            e.stopPropagation();
            instance?.focusLigand(ligand.uniqueKey);
          }}
          className="p-1 text-gray-400 hover:text-gray-700"
        >
          <Focus size={14} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            instance?.setLigandVisibility(ligand.uniqueKey, !componentState.visible);
          }}
          className="p-1 text-gray-400 hover:text-gray-700"
        >
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
}: {
  targetChainId: string;
  instance: MolstarInstance | null;
  onClose: () => void;
}) {
  const [sourcePdbId, setSourcePdbId] = useState('');
  const [sourceChainId, setSourceChainId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instance || !sourcePdbId.trim() || !sourceChainId.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const result = await instance.loadAlignedStructure(
        targetChainId,
        sourcePdbId.trim().toUpperCase(),
        sourceChainId.trim().toUpperCase()
      );

      if (result) {
        onClose();
      } else {
        setError('Failed to load or align structure');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
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

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading || !sourcePdbId.trim() || !sourceChainId.trim()}
          className="flex-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-1"
        >
          {loading && <Loader2 size={12} className="animate-spin" />}
          Align
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

function AlignedStructureRow({
  aligned,
  instance,
}: {
  aligned: AlignedStructure;
  instance: MolstarInstance | null;
}) {
  const handleToggleVisibility = () => {
    instance?.setAlignedStructureVisible(aligned.targetChainId, aligned.id, !aligned.visible);
  };

  const handleRemove = () => {
    instance?.removeAlignedStructureById(aligned.targetChainId, aligned.id);
  };

  return (
    <div className="flex items-center justify-between py-1 px-2 rounded text-sm bg-red-50">
      <div className="flex-1 min-w-0">
        <span className="font-mono text-xs">
          {aligned.sourcePdbId}:{aligned.sourceChainId}
        </span>
        {aligned.rmsd !== null && (
          <span className="text-xs text-gray-500 ml-2">RMSD: {aligned.rmsd.toFixed(2)}</span>
        )}
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={handleToggleVisibility}
          className="p-1 text-gray-400 hover:text-gray-700"
        >
          {aligned.visible ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
        <button
          onClick={handleRemove}
          className="p-1 text-gray-400 hover:text-red-600"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}