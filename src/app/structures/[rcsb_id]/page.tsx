'use client'
import { useRef, useState, useEffect, useCallback } from 'react';
import { useMolstarService } from '@/components/molstar/molstar_service';
import { MolstarNode } from '@/components/molstar/molstar_spec';
import { useAppSelector } from '@/store/store';
import React from 'react';
import { EntitiesPanel } from '@/components/entities_panel';
import { useParams } from 'next/navigation';
// import { SubunitData } from '@/components/protofilament_grid';
// import { SequenceViewer } from '@/components/sequence_viewer';
import { useMolstarSync } from '@/hooks/useMolstarSync';
import { TubulinClassification } from '@/components/molstar/colors/molstar_preset';
import { createClassificationFromProfile } from '@/services/profile_service';
import { API_BASE_URL } from '@/config';

const SUGGESTED_PDB_IDS = ["6WVR", "8QV0", "3JAT", "6O2R", "4TV9", "6U0H", "8VRK", "6E7B", "5J2T", "6FKJ", "4O2B", "6DPU", "1SA0", "6BR1", "7SJ8", "2MZ7", "7SJ9", "6O2T"];

function SettingsPanel({
  isMolstarReady,
  currentStructure,
  isLoading,
  error,
  onStructureSelect,
  onBackendStructureSelect,
}: {
  isMolstarReady: boolean;
  currentStructure: string | null;
  isLoading: boolean;
  error: string | null;
  onStructureSelect: (pdbId: string) => void;
  onBackendStructureSelect: (filename: string) => void;
}) {
  const [customPdbId, setCustomPdbId] = useState('');
  const [suggestedPdbId, setSuggestedPdbId] = useState<string | null>(null);

  useEffect(() => {
    if (isMolstarReady && !suggestedPdbId) {
      const randomIndex = Math.floor(Math.random() * SUGGESTED_PDB_IDS.length);
      setSuggestedPdbId(SUGGESTED_PDB_IDS[randomIndex]);
    }
  }, [isMolstarReady, suggestedPdbId]);

  const handleSelect = (pdbId: string) => {
    if (pdbId) onStructureSelect(pdbId);
  };

  const handleCustomLoad = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedId = customPdbId.trim().toUpperCase();
    if (trimmedId.length === 4) {
      handleSelect(trimmedId);
      setCustomPdbId('');
    }
  };

  const handleRandomize = () => {
    if (SUGGESTED_PDB_IDS.length <= 1) return;
    let newPdbId;
    do {
      const randomIndex = Math.floor(Math.random() * SUGGESTED_PDB_IDS.length);
      newPdbId = SUGGESTED_PDB_IDS[randomIndex];
    } while (newPdbId === suggestedPdbId);
    setSuggestedPdbId(newPdbId);
  };

  const isInteractionDisabled = isLoading || !isMolstarReady;

  return (
    <div className="w-80 h-full bg-gray-50 border-r border-gray-200 p-3 overflow-y-auto">
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-1">Tubulin Viewer</h2>
          <p className="text-xs text-gray-600">Load a structure by PDB ID or try our suggestion.</p>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-800">Load Custom Structure</h3>
          <form onSubmit={handleCustomLoad} className="flex items-center space-x-2">
            <input
              type="text"
              placeholder="e.g., 6O2T"
              value={customPdbId}
              onChange={(e) => setCustomPdbId(e.target.value)}
              maxLength={4}
              className="flex-grow w-full px-2 py-1.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
              disabled={isInteractionDisabled}
            />
            <button
              type="submit"
              className="px-3 py-1.5 text-sm font-semibold text-white bg-blue-600 rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
              disabled={isInteractionDisabled || customPdbId.trim().length !== 4}
            >
              Load
            </button>
          </form>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-800">Load from Backend</h3>
          <p className="text-xs text-gray-500">Load structures with computed residue annotations.</p>
          <button
            onClick={() => onBackendStructureSelect('7sj7_with_metadata.cif')}
            disabled={isInteractionDisabled}
            className="w-full px-3 py-1.5 text-sm font-semibold text-white bg-purple-600 rounded-md shadow-sm hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Load 7SJ7 with Metadata
          </button>
        </div>

        {error && <div className="text-red-500 text-sm p-2 bg-red-50 rounded-md">{error}</div>}

        {suggestedPdbId && (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-medium text-gray-800">Suggested Structure</h3>
              <button
                onClick={handleRandomize}
                disabled={isInteractionDisabled}
                className="p-1.5 rounded-full text-gray-500 hover:bg-gray-200 hover:text-gray-800 disabled:opacity-50"
                title="Get another suggestion"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 3 21 3 21 8"></polyline><line x1="4" y1="20" x2="21" y2="3"></line><polyline points="8 21 3 21 3 16"></polyline><line x1="15" y1="15" x2="21" y2="21"></line><line x1="4" y1="4" x2="9" y2="9"></line></svg>
              </button>
            </div>
            <button
              onClick={() => handleSelect(suggestedPdbId)}
              disabled={isInteractionDisabled}
              className={`w-full text-left p-2 rounded-lg border transition-colors ${currentStructure === suggestedPdbId ? 'bg-blue-50 border-blue-200 ring-2 ring-blue-500' : 'bg-white border-gray-200 hover:bg-gray-100'} ${isInteractionDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span className="font-medium text-sm text-gray-900">{suggestedPdbId}</span>
              <p className="text-xs text-gray-400">Randomly selected example</p>
            </button>
          </div>
        )}
        {isLoading && <div className="text-sm text-gray-500">Loading...</div>}
      </div>
    </div>
  );
}

export default function TubulinViewerPage() {
  const molstarRef = useRef<HTMLDivElement>(null);
  const loadedPdbFromUrl = useRef<string | null>(null);
  const { isInitialized, service } = useMolstarService(molstarRef, 'main');
  
  // Use molstarRefs.currentStructure instead of tubulin_structures slice
  const currentStructure = useAppSelector(state => state.molstarRefs.currentStructure);
  
  // Local UI state for this page
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useMolstarSync();

  const params = useParams();
  const [selectedGridSubunit, setSelectedGridSubunit] = useState<string | null>(null);
  const [hoveredGridSubunit, setHoveredGridSubunit] = useState<string | null>(null);
  // const [hoveredSubunitData, setHoveredSubunitData] = useState<SubunitData | null>(null);
  const [classificationMap, setClassificationMap] = useState<TubulinClassification | null>(null);

  const loadStructureWithCleanup = useCallback(async (
    pdbId: string,
    loadFunction: () => Promise<void>,
    source: 'url' | 'manual' | 'backend'
  ) => {
    if (!service?.controller) {
      console.log('Service or controller not ready');
      return false;
    }

    console.log(`Loading structure ${pdbId} from ${source}...`);

    try {
      await service.controller.clearCurrentStructure();
    } catch (clearError) {
      console.warn('Error during structure cleanup:', clearError);
    }

    setIsLoading(true);
    setError(null);

    try {
      await loadFunction();

      if (source === 'url') {
        loadedPdbFromUrl.current = pdbId;
      } else {
        loadedPdbFromUrl.current = null;
      }

      console.log(`Successfully loaded ${pdbId} from ${source}`);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
      setError(errorMessage);
      console.error(`Failed to load ${pdbId} from ${source}:`, err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [service]);

  const loadStructureFromUrl = useCallback(async (pdbId: string) => {
    if (loadedPdbFromUrl.current === pdbId) return true;

    return await loadStructureWithCleanup(pdbId, async () => {
      const response = await fetch(`${API_BASE_URL}/structures/${pdbId}/profile`);
      if (!response.ok) throw new Error("Failed to fetch profile");
      const profileData = await response.json();
      const map = createClassificationFromProfile(profileData);

      setClassificationMap(map);

      await service!.controller.loadStructure(pdbId, map);
      await service!.viewer.representations.stylized_lighting();
    }, 'url');
  }, [loadStructureWithCleanup, service]);

  useEffect(() => {
    if (!isInitialized || !service?.controller) {
      return;
    }

    const pdbIdFromUrl = (params.rcsb_id as string)?.toUpperCase();
    if (!pdbIdFromUrl) {
      return;
    }

    if (loadedPdbFromUrl.current !== pdbIdFromUrl) {
      loadStructureFromUrl(pdbIdFromUrl);
    }
  }, [isInitialized, service?.controller, params.rcsb_id, loadStructureFromUrl]);

  const handleStructureSelect = useCallback(async (pdbId: string) => {
    return await loadStructureWithCleanup(pdbId, async () => {
      const response = await fetch(`${API_BASE_URL}/structures/${pdbId}/profile`);
      if (!response.ok) throw new Error("Failed to fetch structure profile.");

      const profileData = await response.json();
      const map = createClassificationFromProfile(profileData);

      setClassificationMap(map);

      await service!.controller.loadStructure(pdbId, map);
      await service!.viewer.representations.stylized_lighting();
    }, 'manual');
  }, [loadStructureWithCleanup, service]);

  const handleBackendStructureSelect = useCallback(async (filename: string) => {
    return await loadStructureWithCleanup(filename.split('_')[0].toUpperCase(), async () => {
      await service!.controller.loadStructureFromBackend(filename, {});
      await service!.viewer.representations.stylized_lighting();
    }, 'backend');
  }, [loadStructureWithCleanup, service]);


  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-gray-100">
      <div className="flex flex-1 overflow-hidden">
        <SettingsPanel
          isMolstarReady={isInitialized}
          currentStructure={currentStructure}
          isLoading={isLoading}
          error={error}
          onStructureSelect={handleStructureSelect}
          onBackendStructureSelect={handleBackendStructureSelect}
        />
        <div className="flex-1 h-full bg-white relative">
          <MolstarNode ref={molstarRef} />
          {!isInitialized && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-75 z-10">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-gray-600">Initializing Molstar...</p>
              </div>
            </div>
          )}
        </div>
        <div className="flex">
          <EntitiesPanel
            onSubunitHover={()=>{}}
            onSubunitSelect={()=>{}}
            hoveredSubunitId={hoveredGridSubunit}
            selectedSubunitId={selectedGridSubunit}
          />
        </div>
      </div>
    </div>
  );
}
