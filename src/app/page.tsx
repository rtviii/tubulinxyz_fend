'use client'
import { useRef, useState, useEffect, useCallback } from 'react';
import { useMolstarService, MolstarContext } from '@/components/molstar/molstar_service';
import { MolstarNode } from '@/components/molstar/molstar_spec';
import { useAppDispatch, useAppSelector } from '@/store/store';
import {
  selectStructure,
  selectSelectedStructure,
  selectIsLoading,
  selectError,
  setLoading,
  setError
} from '@/store/slices/tubulin_structures';
import React from 'react';
import { ChainPanel } from '@/components/chain_panel';
import { fetchRcsbGraphQlData } from '@/services/rcsb_graphql_service';
import { createTubulinClassificationMap } from '@/services/gql_parser';
import { ProtofilamentGrid, SubunitData } from '@/components/protofilament_grid';
import { buildGridDataFromGql } from '@/services/protofilament_grid_parser';
import { NonPolymerPanel } from '@/components/nonpolymer_panel';
import { InteractionInfo } from '@/components/molstar/molstar_controller'; // <-- ADD THIS IMPORT
import { TubulinClass } from '@/components/molstar/molstar_preset';

const SUGGESTED_PDB_IDS = ["6WVR", "8QV0", "3JAT", "6O2R", "4TV9", "6U0H", "8VRK", "6E7B", "5J2T", "6FKJ", "4O2B", "6DPU", "1SA0", "6BR1", "7SJ8", "2MZ7", "7SJ9", "6O2T"];


function SettingsPanel({
  isMolstarReady,
  onStructureSelect,
  onBackendStructureSelect, // New prop
  onCreateGtpInterface,
  onCreateGtpSurroundings,
  onGetInterfaceData
}: {
  isMolstarReady: boolean;
  onStructureSelect: (pdbId: string) => void;
  onBackendStructureSelect: (filename: string) => void; // New prop type
  onCreateGtpInterface: () => void;
  onCreateGtpSurroundings: () => void;
  onGetInterfaceData: () => void;
}) {

  const selectedStructure = useAppSelector(selectSelectedStructure);
  const isLoading = useAppSelector(selectIsLoading);
  const error = useAppSelector(selectError);
  const [customPdbId, setCustomPdbId] = useState('');
  const [suggestedPdbId, setSuggestedPdbId] = useState<string | null>(null);

  useEffect(() => {
    if (isMolstarReady && !suggestedPdbId) {
      const randomIndex = Math.floor(Math.random() * SUGGESTED_PDB_IDS.length);
      setSuggestedPdbId(SUGGESTED_PDB_IDS[randomIndex]);
    }
  }, [isMolstarReady, suggestedPdbId]);

  const handleSelect = (pdbId: string) => {
    if (pdbId) {
      onStructureSelect(pdbId);
    }
  };

  const handleCustomLoad = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedId = customPdbId.trim().toUpperCase();
    if (trimmedId.length === 4) {
      handleSelect(trimmedId);
      setCustomPdbId('');
    }
  };

  const handleBackendLoad = () => {
    onBackendStructureSelect('7sj7_with_metadata.cif');
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
  const isLigandInteractionDisabled = isLoading || !isMolstarReady || !selectedStructure;

  return (
    <div className="w-80 h-full bg-gray-50 border-r border-gray-200 p-4 overflow-y-auto">
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Tubulin Viewer</h2>
          <p className="text-sm text-gray-600">Load a structure by PDB ID or try our suggestion.</p>
        </div>

        <div className="space-y-2">
          <h3 className="text-md font-medium text-gray-800">Load Custom Structure</h3>
          <form onSubmit={handleCustomLoad} className="flex items-center space-x-2">
            <input
              type="text"
              placeholder="e.g., 6O2T"
              value={customPdbId}
              onChange={(e) => setCustomPdbId(e.target.value)}
              maxLength={4}
              className="flex-grow w-full px-3 py-2 text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
              disabled={isInteractionDisabled}
            />
            <button
              type="submit"
              className="px-4 py-2 font-semibold text-white bg-blue-600 rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
              disabled={isInteractionDisabled || customPdbId.trim().length !== 4}
            >
              Load
            </button>
          </form>
        </div>

        {/* NEW: Backend Loading Section */}
        <div className="space-y-2">
          <h3 className="text-md font-medium text-gray-800">Load from Backend</h3>
          <p className="text-xs text-gray-500">Load structures with computed residue annotations.</p>
          <button
            onClick={handleBackendLoad}
            disabled={isInteractionDisabled}
            className="w-full px-4 py-2 font-semibold text-white bg-purple-600 rounded-md shadow-sm hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Load 7SJ7 with Metadata
          </button>
        </div>

        {error && <div className="text-red-500 text-sm p-2 bg-red-50 rounded-md">{error}</div>}

        {suggestedPdbId && (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <h3 className="text-md font-medium text-gray-800">Suggested Structure</h3>
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
              className={`w-full text-left p-3 rounded-lg border transition-colors ${selectedStructure === suggestedPdbId
                ? 'bg-blue-50 border-blue-200 ring-2 ring-blue-500'
                : 'bg-white border-gray-200 hover:bg-gray-100'
                } ${isInteractionDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span className="font-medium text-gray-900">{suggestedPdbId}</span>
              <p className="text-sm text-gray-400">Randomly selected example</p>
            </button>
          </div>
        )}

        {isLoading && <div className="text-sm text-gray-500">Loading...</div>}

        <div className="space-y-2 pt-4 border-t border-gray-200">
          <h3 className="text-md font-medium text-gray-800">Ligand Interactions</h3>
          <p className="text-xs text-gray-500">Visualize GTP interactions. Load a structure first.</p>
          <button
            onClick={onCreateGtpSurroundings}
            disabled={isLigandInteractionDisabled}
            className="w-full px-4 py-2 font-semibold text-white bg-teal-600 rounded-md shadow-sm hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Show GTP 5Å Surroundings
          </button>
          <button
            onClick={onCreateGtpInterface}
            disabled={isLigandInteractionDisabled}
            className="w-full px-4 py-2 font-semibold text-white bg-indigo-600 rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Show GTP Interface Bonds
          </button>
          <button
            onClick={onGetInterfaceData}
            disabled={isLigandInteractionDisabled}
            className="w-full px-4 py-2 font-semibold text-white bg-orange-600 rounded-md shadow-sm hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Get Interface Data
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Main Page Component
 */
export default function TubulinViewerPage() {
  const molstarRef = useRef<HTMLDivElement>(null);
  const { isInitialized, service } = useMolstarService(molstarRef, 'main');
  const dispatch = useAppDispatch();
  const selectedStructure = useAppSelector(selectSelectedStructure);

  const [selectedGridSubunit, setSelectedGridSubunit] = useState<string | null>(null);
  const [hoveredGridSubunit, setHoveredGridSubunit] = useState<string | null>(null);
  const [interactionData, setInteractionData] = useState<InteractionInfo[]>([]);


  const handleStructureSelect = useCallback(async (pdbId: string) => {
    if (!service?.controller) {
      console.warn("Molstar controller not available.");
      return;
    }

    dispatch(selectStructure(pdbId));
    dispatch(setLoading(true));
    dispatch(setError(null));

    try {
      const gqlData = await fetchRcsbGraphQlData(pdbId);
      const classificationMap = createTubulinClassificationMap(gqlData);
      await service.controller.loadStructure(pdbId, classificationMap);
      await service.viewer.representations.stylized_lighting()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      console.error(`[UI] An error occurred during the loading process for ${pdbId}:`, error);
      dispatch(setError(errorMessage));
    } finally {
      dispatch(setLoading(false));
    }
  }, [service, dispatch]);

  // NEW: Backend structure handler
  const handleBackendStructureSelect = useCallback(async (filename: string) => {
    if (!service?.controller) {
      console.warn("Molstar controller not available.");
      return;
    }

    // Extract PDB ID for state management
    const pdbId = filename.split('_')[0].toUpperCase();
    dispatch(selectStructure(pdbId));
    dispatch(setLoading(true));
    dispatch(setError(null));

    try {
      // For now, use a dummy classification map since we're loading from backend
      const dummyClassificationMap = {
        A: TubulinClass.Alpha,
        B: TubulinClass.Beta
      };

      await service.controller.loadStructureFromBackend(filename, dummyClassificationMap);
      await service.viewer.representations.stylized_lighting();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      console.error(`[UI] An error occurred during backend loading for ${filename}:`, error);
      dispatch(setError(errorMessage));
    } finally {
      dispatch(setLoading(false));
    }
  }, [service, dispatch]);
  const [hoveredSubunitData, setHoveredSubunitData] = useState<SubunitData | null>(null);

  const handleSubunitHover = useCallback((subunit: SubunitData | null) => {
    const controller = service?.controller;
    if (!controller || !selectedStructure) return;

    if (hoveredSubunitData) {
      controller.highlightChain(selectedStructure, hoveredSubunitData.auth_asym_id, false);
    }

    if (subunit) {
      controller.highlightChain(selectedStructure, subunit.auth_asym_id, true);
      setHoveredGridSubunit(subunit.id);
      setHoveredSubunitData(subunit);
    } else {
      setHoveredGridSubunit(null);
      setHoveredSubunitData(null);
    }
  }, [service, selectedStructure, hoveredSubunitData]);

  const handleSubunitSelect = useCallback((subunit: SubunitData) => {
    setSelectedGridSubunit(subunit.id);
    const controller = service?.controller;
    if (controller && selectedStructure) {
      try {
        controller.focusChain(selectedStructure, subunit.auth_asym_id);
      } catch (error) {
        console.error("Error focusing chain:", error);
        controller.highlightChain(selectedStructure, subunit.auth_asym_id, true);
      }
    }
  }, [service, selectedStructure]);

  const handleCreateGtpInterface = useCallback(async () => {
    if (!service?.controller) {
      console.warn("Molstar controller not available.");
      return;
    }
    dispatch(setLoading(true));
    dispatch(setError(null));
    try {
      // This now calls the more specific interface bonds method
      await service.controller.createLigandInterfaceBonds('GTP');
    } catch (e) {
      console.error("Failed to create GTP interface component", e);
      const errorMessage = e instanceof Error ? e.message : 'Failed to create GTP interface';
      dispatch(setError(errorMessage));
    } finally {
      dispatch(setLoading(false));
    }
  }, [service, dispatch]);

  // New handler for surroundings
  const handleCreateGtpSurroundings = useCallback(async () => {
    if (!service?.controller) {
      console.warn("Molstar controller not available.");
      return;
    }
    dispatch(setLoading(true));
    dispatch(setError(null));
    try {
      await service.controller.createLigandSurroundings('GTP');
    } catch (e) {
      console.error("Failed to create GTP surroundings component", e);
      const errorMessage = e instanceof Error ? e.message : 'Failed to create GTP surroundings';
      dispatch(setError(errorMessage));
    } finally {
      dispatch(setLoading(false));
    }
  }, [service, dispatch]);

  const handleGetInterfaceData = useCallback(async () => {
    if (!service?.controller) return;
    dispatch(setLoading(true));
    setInteractionData([]);
    try {
      const data = await service.controller.getLigandInterfaceData('GTP');
      if (data) setInteractionData(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to get interface data';
      dispatch(setError(msg));
    } finally {
      dispatch(setLoading(false));
    }
  }, [service, dispatch]);

  const handleInteractionClick = (interaction: InteractionInfo) => {
    if (service?.controller) {
      service.controller.focusOnInteraction(interaction.partnerA.loci, interaction.partnerB.loci);
    }
  };
  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-gray-100">
      <div className="flex flex-1 overflow-hidden">
        <SettingsPanel
          isMolstarReady={isInitialized}
          onStructureSelect={handleStructureSelect}
          onBackendStructureSelect={handleBackendStructureSelect} // Pass the new handler
          onCreateGtpInterface={handleCreateGtpInterface}
          onCreateGtpSurroundings={handleCreateGtpSurroundings}
          onGetInterfaceData={handleGetInterfaceData}
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
        <div className="flex flex-col h-full">
          <div className="flex-1 min-h-0 overflow-hidden">
            <ChainPanel />
          </div>
          <div className="border-t border-gray-200"></div>
          <div className="flex-1 min-h-0 overflow-hidden">
            <NonPolymerPanel />
          </div>
        </div>
      </div>
      <div className="flex-shrink-0 border-t bg-white shadow-inner" style={{ maxHeight: '25vh', display: 'flex' }}>
        <div className="flex-1 h-full overflow-auto p-2">
          <h3 className="text-md font-medium text-gray-800 mb-2">Interaction Data</h3>
          {interactionData.length > 0 ? (
            <ul className="text-xs space-y-1">
              {interactionData.map((interaction, index) => (
                <li
                  key={index}
                  className="p-1 bg-gray-50 rounded hover:bg-blue-100 cursor-pointer"
                  onClick={() => handleInteractionClick(interaction)}
                >
                  <span className="font-semibold text-blue-700">{interaction.type}: </span>
                  <span>{interaction.partnerA.label}</span>
                  <span className="mx-2 text-gray-400">&harr;</span>
                  <span>{interaction.partnerB.label}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-gray-500">Click "Get Interface Data" to populate.</p>
          )}
        </div>
        <div className="flex-1 h-full overflow-auto border-l">
          <ProtofilamentGrid
            pdbId={selectedStructure}
            onSubunitHover={handleSubunitHover}
            onSubunitSelect={handleSubunitSelect}
            hoveredSubunitId={hoveredGridSubunit}
            selectedSubunitId={selectedGridSubunit}
          />
        </div>
      </div>
    </div>
  );
}
