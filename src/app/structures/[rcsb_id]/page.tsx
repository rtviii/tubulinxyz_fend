'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useAppSelector } from '@/store/store';
import { useMolstarInstance } from '@/components/molstar/services/MolstarInstanceManager';
import { selectLoadedStructure, selectPolymerComponents, selectLigandComponents, selectComponentState } from '@/components/molstar/state/selectors';
import { createClassificationFromProfile } from '@/services/profile_service';
import { API_BASE_URL } from '@/config';
import { PolymerComponent, LigandComponent } from '@/components/molstar/core/types';
import { MolstarInstance } from '@/components/molstar/services/MolstarInstance';
import { ResidueData } from '@/components/molstar/colors/preset-helpers';
import { Eye, EyeOff, Focus, ArrowLeft, Microscope } from 'lucide-react';

// ============================================================
// Types
// ============================================================

type ViewMode = 'structure' | 'monomer';

interface MonomerAnnotation {
  type: 'mutation' | 'ptm' | 'binding_site';
  authSeqId: number;
  label: string;
}

// ============================================================
// Mock Data
// ============================================================

function getMockAnnotations(chainId: string): MonomerAnnotation[] {
  // Just some fake data for now
  return [
    { type: 'mutation', authSeqId: 45, label: 'V45A - drug resistance' },
    { type: 'mutation', authSeqId: 112, label: 'G112S - stability' },
    { type: 'ptm', authSeqId: 78, label: 'Phospho-Tyr78' },
    { type: 'ptm', authSeqId: 234, label: 'Acetyl-Lys234' },
    { type: 'binding_site', authSeqId: 150, label: 'GTP contact' },
    { type: 'binding_site', authSeqId: 151, label: 'GTP contact' },
    { type: 'binding_site', authSeqId: 152, label: 'GTP contact' },
  ];
}

// ============================================================
// Main Page
// ============================================================

export default function StructureProfilePage() {
  const params = useParams();
  const pdbIdFromUrl = (params.rcsb_id as string)?.toUpperCase();

  // View state
  const [activeView, setActiveView] = useState<ViewMode>('structure');
  const [selectedChain, setSelectedChain] = useState<{ chainId: string; pdbId: string } | null>(null);

  // Structure viewer
  const structureContainerRef = useRef<HTMLDivElement>(null);
  const { instance: structureInstance, isInitialized: structureReady } = useMolstarInstance(structureContainerRef, 'structure');

  // Monomer viewer
  const monomerContainerRef = useRef<HTMLDivElement>(null);
  const { instance: monomerInstance, isInitialized: monomerReady } = useMolstarInstance(monomerContainerRef, 'monomer');

  // Monomer state
  const [monomerSequence, setMonomerSequence] = useState<ResidueData[]>([]);
  const [monomerLoading, setMonomerLoading] = useState(false);

  // Redux state
  const loadedStructure = useAppSelector(state => selectLoadedStructure(state, 'structure'));
  const polymerComponents = useAppSelector(state => selectPolymerComponents(state, 'structure'));
  const ligandComponents = useAppSelector(state => selectLigandComponents(state, 'structure'));

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedFromUrlRef = useRef<string | null>(null);

  // Load structure on URL change
  useEffect(() => {
    if (!structureReady || !structureInstance || !pdbIdFromUrl) return;
    if (loadedFromUrlRef.current === pdbIdFromUrl) return;

    const loadStructure = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`${API_BASE_URL}/structures/${pdbIdFromUrl}/profile`);
        if (!response.ok) throw new Error('Failed to fetch profile');

        const profileData = await response.json();
        const classification = createClassificationFromProfile(profileData);

        const success = await structureInstance.loadStructure(pdbIdFromUrl, classification);
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
  }, [structureReady, structureInstance, pdbIdFromUrl]);

  // Open monomer view
  const openMonomerView = useCallback(async (chainId: string) => {
    if (!monomerReady || !monomerInstance || !pdbIdFromUrl) return;

    setSelectedChain({ chainId, pdbId: pdbIdFromUrl });
    setActiveView('monomer');
    setMonomerLoading(true);

    try {
      const result = await monomerInstance.loadMonomerChain(pdbIdFromUrl, chainId);
      if (result) {
        setMonomerSequence(result.sequence);
      }
    } catch (err) {
      console.error('Failed to load monomer:', err);
    } finally {
      setMonomerLoading(false);
    }
  }, [monomerReady, monomerInstance, pdbIdFromUrl]);

  // Back to structure view
  const backToStructure = useCallback(() => {
    setActiveView('structure');
  }, []);

  return (
    <div className="h-screen w-screen overflow-hidden bg-gray-100">
      {/* Carousel container */}
      <div
        className="flex h-full transition-transform duration-300 ease-in-out"
        style={{ transform: activeView === 'monomer' ? 'translateX(-100%)' : 'translateX(0)' }}
      >
        {/* Slide 1: Structure View */}
        <div className="w-screen h-full flex-shrink-0 flex">
          <StructureSidebar
            loadedStructure={loadedStructure}
            polymerComponents={polymerComponents}
            ligandComponents={ligandComponents}
            instance={structureInstance}
            error={error}
            onOpenMonomer={openMonomerView}
          />
          <div className="flex-1 h-full relative">
            <div ref={structureContainerRef} className="w-full h-full" />
            {(!structureReady || isLoading) && <LoadingOverlay text={isLoading ? 'Loading structure...' : 'Initializing viewer...'} />}
          </div>
        </div>

        {/* Slide 2: Monomer View */}
        <div className="w-screen h-full flex-shrink-0 flex">
          <MonomerSidebar
            selectedChain={selectedChain}
            sequence={monomerSequence}
            instance={monomerInstance}
            onBack={backToStructure}
          />
          <div className="flex-1 h-full relative">
            <div ref={monomerContainerRef} className="w-full h-full" />
            {(!monomerReady || monomerLoading) && <LoadingOverlay text={monomerLoading ? 'Loading chain...' : 'Initializing viewer...'} />}
          </div>
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
  onOpenMonomer,
}: {
  loadedStructure: string | null;
  polymerComponents: PolymerComponent[];
  ligandComponents: LigandComponent[];
  instance: MolstarInstance | null;
  error: string | null;
  onOpenMonomer: (chainId: string) => void;
}) {
  return (
    <div className="w-72 h-full bg-white border-r border-gray-200 p-4 overflow-y-auto">
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
              onOpenMonomer={() => onOpenMonomer(chain.chainId)}
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

function MonomerSidebar({
  selectedChain,
  sequence,
  instance,
  onBack,
}: {
  selectedChain: { chainId: string; pdbId: string } | null;
  sequence: ResidueData[];
  instance: MolstarInstance | null;
  onBack: () => void;
}) {
  const annotations = selectedChain ? getMockAnnotations(selectedChain.chainId) : [];

  const handleAnnotationClick = (authSeqId: number) => {
    instance?.focusResidue(selectedChain?.chainId ?? '', authSeqId);
  };

  const handleAnnotationHover = (authSeqId: number, hover: boolean) => {
    if (hover) {
      instance?.highlightResidue(selectedChain?.chainId ?? '', authSeqId, true);
    } else {
      instance?.clearHighlight();
    }
  };

  const groupedAnnotations = {
    mutations: annotations.filter(a => a.type === 'mutation'),
    ptms: annotations.filter(a => a.type === 'ptm'),
    binding_sites: annotations.filter(a => a.type === 'binding_site'),
  };

  return (
    <div className="w-80 h-full bg-white border-r border-gray-200 p-4 overflow-y-auto">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4"
      >
        <ArrowLeft size={16} />
        Back to structure
      </button>

      <h1 className="text-lg font-semibold mb-1">
        Chain {selectedChain?.chainId}
      </h1>
      <p className="text-sm text-gray-500 mb-4">
        {selectedChain?.pdbId} - {sequence.length} residues
      </p>

      {/* Annotations */}
      <div className="space-y-4">
        {groupedAnnotations.mutations.length > 0 && (
          <AnnotationSection
            title="Mutations"
            annotations={groupedAnnotations.mutations}
            color="bg-red-100 text-red-800"
            onHover={handleAnnotationHover}
            onClick={handleAnnotationClick}
          />
        )}

        {groupedAnnotations.ptms.length > 0 && (
          <AnnotationSection
            title="PTMs"
            annotations={groupedAnnotations.ptms}
            color="bg-purple-100 text-purple-800"
            onHover={handleAnnotationHover}
            onClick={handleAnnotationClick}
          />
        )}

        {groupedAnnotations.binding_sites.length > 0 && (
          <AnnotationSection
            title="Binding Sites"
            annotations={groupedAnnotations.binding_sites}
            color="bg-blue-100 text-blue-800"
            onHover={handleAnnotationHover}
            onClick={handleAnnotationClick}
          />
        )}
      </div>

      {/* Mini sequence display */}
      <div className="mt-6">
        <h2 className="text-sm font-medium text-gray-700 mb-2">Sequence</h2>
        <div className="font-mono text-xs text-gray-600 break-all leading-relaxed">
          {sequence.slice(0, 100).map(([aa]) => aa).join('')}
          {sequence.length > 100 && '...'}
        </div>
      </div>
    </div>
  );
}

function AnnotationSection({
  title,
  annotations,
  color,
  onHover,
  onClick,
}: {
  title: string;
  annotations: MonomerAnnotation[];
  color: string;
  onHover: (authSeqId: number, hover: boolean) => void;
  onClick: (authSeqId: number) => void;
}) {
  return (
    <div>
      <h3 className="text-sm font-medium text-gray-700 mb-1">{title}</h3>
      <div className="space-y-1">
        {annotations.map((ann, i) => (
          <div
            key={i}
            className={`text-xs px-2 py-1 rounded cursor-pointer ${color}`}
            onMouseEnter={() => onHover(ann.authSeqId, true)}
            onMouseLeave={() => onHover(ann.authSeqId, false)}
            onClick={() => onClick(ann.authSeqId)}
          >
            <span className="font-mono mr-1">{ann.authSeqId}</span>
            {ann.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Shared Components
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

function ChainRow({
  chain,
  instance,
  onOpenMonomer,
}: {
  chain: PolymerComponent;
  instance: MolstarInstance | null;
  onOpenMonomer: () => void;
}) {
  const componentState = useAppSelector(state => selectComponentState(state, 'structure', chain.chainId));

  return (
    <div
      className={`flex items-center justify-between py-1 px-2 rounded text-sm cursor-pointer transition-colors ${componentState.hovered ? 'bg-blue-100' : 'hover:bg-gray-100'
        }`}
      onMouseEnter={() => instance?.highlightChain(chain.chainId, true)}
      onMouseLeave={() => instance?.highlightChain(chain.chainId, false)}
      onClick={() => instance?.focusChain(chain.chainId)}
    >
      <span className="font-mono">{chain.chainId}</span>
      <div className="flex items-center gap-1">
        <button
          onClick={(e) => { e.stopPropagation(); onOpenMonomer(); }}
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

function LigandRow({ ligand, instance }: { ligand: LigandComponent; instance: MolstarInstance | null }) {
  const componentState = useAppSelector(state => selectComponentState(state, 'structure', ligand.uniqueKey));

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
