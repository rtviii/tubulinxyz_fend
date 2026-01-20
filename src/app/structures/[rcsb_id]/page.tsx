'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useAppSelector } from '@/store/store';
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
import { API_BASE_URL } from '@/config';
import { PolymerComponent, LigandComponent, AlignedStructure, ViewMode } from '@/components/molstar/core/types';
import { MolstarInstance } from '@/components/molstar/services/MolstarInstance';
import { Eye, EyeOff, Focus, ArrowLeft, Microscope, Plus, X, Loader2 } from 'lucide-react';

// ============================================================
// Main Page
// ============================================================

export default function StructureProfilePage() {
  const params = useParams();
  const pdbIdFromUrl = (params.rcsb_id as string)?.toUpperCase();

  // Single viewer instance
  const containerRef = useRef<HTMLDivElement>(null);
  const { instance, isInitialized } = useMolstarInstance(containerRef, 'structure');

  // Redux state
  const loadedStructure = useAppSelector((state) => selectLoadedStructure(state, 'structure'));
  const polymerComponents = useAppSelector((state) => selectPolymerComponents(state, 'structure'));
  const ligandComponents = useAppSelector((state) => selectLigandComponents(state, 'structure'));
  const viewMode = useAppSelector((state) => selectViewMode(state, 'structure'));
  const activeChainId = useAppSelector((state) => selectActiveMonomerChainId(state, 'structure'));
  const alignedStructures = useAppSelector((state) => selectAlignedStructuresForActiveChain(state, 'structure'));

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedFromUrlRef = useRef<string | null>(null);

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

  return (
    <div className="h-screen w-screen overflow-hidden bg-gray-100">
      <div className="flex h-full">
        {/* Sidebar - slides between structure and monomer */}
        <div className="relative w-80 h-full flex-shrink-0 overflow-hidden">
          <div
            className="flex h-full transition-transform duration-300 ease-in-out"
            style={{ transform: viewMode === 'monomer' ? 'translateX(-100%)' : 'translateX(0)' }}
          >
            {/* Structure sidebar */}
            <div className="w-80 h-full flex-shrink-0">
              <StructureSidebar
                loadedStructure={loadedStructure}
                polymerComponents={polymerComponents}
                ligandComponents={ligandComponents}
                instance={instance}
                error={error}
              />
            </div>

            {/* Monomer sidebar */}
            <div className="w-80 h-full flex-shrink-0">
              <MonomerSidebar
                activeChainId={activeChainId}
                polymerComponents={polymerComponents}
                alignedStructures={alignedStructures}
                instance={instance}
                pdbId={loadedStructure}
              />
            </div>
          </div>
        </div>

        {/* Single Molstar canvas */}
        <div className="flex-1 h-full relative">
          <div ref={containerRef} className="w-full h-full" />
          {(!isInitialized || isLoading) && (
            <LoadingOverlay text={isLoading ? 'Loading structure...' : 'Initializing viewer...'} />
          )}
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
}: {
  loadedStructure: string | null;
  polymerComponents: PolymerComponent[];
  ligandComponents: LigandComponent[];
  instance: MolstarInstance | null;
  error: string | null;
}) {
  return (
    <div className="h-full bg-white border-r border-gray-200 p-4 overflow-y-auto">
      <h1 className="text-lg font-semibold mb-4">{loadedStructure ?? 'No Structure'}</h1>

      {error && <div className="text-red-500 text-sm mb-4 p-2 bg-red-50 rounded">{error}</div>}

      <section className="mb-6">
        <h2 className="text-sm font-medium text-gray-700 mb-2">Chains</h2>
        <div className="space-y-1">
          {polymerComponents.map((chain) => (
            <ChainRow key={chain.chainId} chain={chain} instance={instance} />
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
}: {
  activeChainId: string | null;
  polymerComponents: PolymerComponent[];
  alignedStructures: AlignedStructure[];
  instance: MolstarInstance | null;
  pdbId: string | null;
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

  return (
    <div className="h-full bg-white border-r border-gray-200 p-4 overflow-y-auto">
      <button
        onClick={handleBack}
        className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4"
      >
        <ArrowLeft size={16} />
        Back to structure
      </button>

      <h1 className="text-lg font-semibold mb-1">Chain {activeChainId}</h1>
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

      {/* Placeholder for annotations */}
      <section>
        <h2 className="text-sm font-medium text-gray-700 mb-2">Annotations</h2>
        <p className="text-xs text-gray-400">Coming soon...</p>
      </section>
    </div>
  );
}

// ============================================================
// Align Structure Form
// ============================================================

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

// ============================================================
// Aligned Structure Row
// ============================================================

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
}: {
  chain: PolymerComponent;
  instance: MolstarInstance | null;
}) {
  const componentState = useAppSelector((state) => selectComponentState(state, 'structure', chain.chainId));

  const handleOpenMonomer = () => {
    instance?.enterMonomerView(chain.chainId);
  };

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
