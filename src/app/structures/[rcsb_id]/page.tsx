'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useAppSelector } from '@/store/store';
import { useMolstarInstance } from '@/components/molstar/services/MolstarInstanceManager';
import { selectLoadedStructure, selectPolymerComponents, selectLigandComponents } from '@/components/molstar/state/selectors';
import { createClassificationFromProfile } from '@/services/profile_service';
import { API_BASE_URL } from '@/config';

// Simple container component for Molstar
function MolstarContainer({ containerRef }: { containerRef: React.RefObject<HTMLDivElement> }) {
  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ position: 'relative' }}
    />
  );
}

export default function StructureProfilePage() {
  const params = useParams();
  const pdbIdFromUrl = (params.rcsb_id as string)?.toUpperCase();

  const molstarContainerRef = useRef<HTMLDivElement>(null);
  const { instance, isInitialized } = useMolstarInstance(molstarContainerRef, 'structure');

  const loadedStructure = useAppSelector(state => selectLoadedStructure(state, 'structure'));
  const polymerComponents = useAppSelector(state => selectPolymerComponents(state, 'structure'));
  const ligandComponents = useAppSelector(state => selectLigandComponents(state, 'structure'));

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedFromUrlRef = useRef<string | null>(null);

  // Load structure when URL changes
  useEffect(() => {
    if (!isInitialized || !instance || !pdbIdFromUrl) return;
    if (loadedFromUrlRef.current === pdbIdFromUrl) return;

    const loadStructure = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Fetch classification from backend
        const response = await fetch(`${API_BASE_URL}/structures/${pdbIdFromUrl}/profile`);
        if (!response.ok) throw new Error('Failed to fetch profile');

        const profileData = await response.json();
        const classification = createClassificationFromProfile(profileData);

        // Load into Molstar
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
    <div className="h-screen w-screen flex overflow-hidden bg-gray-100">
      {/* Sidebar */}
      <div className="w-72 h-full bg-white border-r border-gray-200 p-4 overflow-y-auto">
        <h1 className="text-lg font-semibold mb-4">
          {loadedStructure ?? 'No Structure'}
        </h1>

        {error && (
          <div className="text-red-500 text-sm mb-4 p-2 bg-red-50 rounded">
            {error}
          </div>
        )}

        {/* Polymer Chains */}
        <section className="mb-6">
          <h2 className="text-sm font-medium text-gray-700 mb-2">Chains</h2>
          <div className="space-y-1">
            {polymerComponents.map(chain => (
              <ChainRow
                key={chain.chainId}
                chain={chain}
                instance={instance}
              />
            ))}
          </div>
        </section>

        {/* Ligands */}
        {ligandComponents.length > 0 && (
          <section>
            <h2 className="text-sm font-medium text-gray-700 mb-2">Ligands</h2>
            <div className="space-y-1">
              {ligandComponents.map(ligand => (
                <LigandRow
                  key={ligand.uniqueKey}
                  ligand={ligand}
                  instance={instance}
                />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Viewer */}
      <div className="flex-1 h-full relative">
        <MolstarContainer containerRef={molstarContainerRef} />
        {(!isInitialized || isLoading) && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/75">
            <div className="text-center">
              <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2" />
              <p className="text-gray-600">
                {isLoading ? 'Loading structure...' : 'Initializing viewer...'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Sub-components ---

import { PolymerComponent, LigandComponent } from '@/components/molstar/core/types';
import { MolstarInstance } from '@/components/molstar/services/MolstarInstance';
import { selectComponentState } from '@/components/molstar/state/selectors';
import { Eye, EyeOff, Focus } from 'lucide-react';

function ChainRow({ chain, instance }: { chain: PolymerComponent; instance: MolstarInstance | null }) {
  const componentState = useAppSelector(state => selectComponentState(state, 'structure', chain.chainId));

  const handleToggleVisibility = () => {
    instance?.setChainVisibility(chain.chainId, !componentState.visible);
  };

  const handleFocus = () => {
    instance?.focusChain(chain.chainId);
  };

  const handleMouseEnter = () => {
    instance?.highlightChain(chain.chainId, true);
  };

  const handleMouseLeave = () => {
    instance?.highlightChain(chain.chainId, false);
  };

  return (
    <div
      className={`flex items-center justify-between py-1 px-2 rounded text-sm cursor-pointer transition-colors ${
        componentState.hovered ? 'bg-blue-100' : 'hover:bg-gray-100'
      }`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleFocus}
    >
      <span className="font-mono">{chain.chainId}</span>
      <div className="flex items-center gap-1">
        <button
          onClick={(e) => { e.stopPropagation(); handleFocus(); }}
          className="p-1 text-gray-400 hover:text-gray-700"
        >
          <Focus size={14} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleToggleVisibility(); }}
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

  const handleToggleVisibility = () => {
    instance?.setLigandVisibility(ligand.uniqueKey, !componentState.visible);
  };

  const handleFocus = () => {
    instance?.focusLigand(ligand.uniqueKey);
  };

  const handleMouseEnter = () => {
    instance?.highlightLigand(ligand.uniqueKey, true);
  };

  const handleMouseLeave = () => {
    instance?.highlightLigand(ligand.uniqueKey, false);
  };

  return (
    <div
      className={`flex items-center justify-between py-1 px-2 rounded text-sm cursor-pointer transition-colors ${
        componentState.hovered ? 'bg-blue-100' : 'hover:bg-gray-100'
      }`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleFocus}
    >
      <span className="font-mono text-xs">
        {ligand.compId} ({ligand.authAsymId}:{ligand.authSeqId})
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={(e) => { e.stopPropagation(); handleFocus(); }}
          className="p-1 text-gray-400 hover:text-gray-700"
        >
          <Focus size={14} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleToggleVisibility(); }}
          className="p-1 text-gray-400 hover:text-gray-700"
        >
          {componentState.visible ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
      </div>
    </div>
  );
}
