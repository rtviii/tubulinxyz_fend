'use client'
import { useRef, useState, useEffect, useCallback } from 'react';
import { useMolstarService, MolstarContext } from '@/components/molstar/molstar_service';
import { MolstarNode } from '@/components/molstar/molstar_spec';
import { useAppDispatch, useAppSelector } from '@/store/store';
import {
  selectStructure,
  selectAvailableStructures,
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
import { ProtofilamentGrid, GridData, SubunitData } from '@/components/protofilament_grid';
import { buildGridDataFromGql } from '@/services/protofilament_grid_parser';

/**
 * SettingsPanel Component: Renders the left-side panel for loading structures.
 * It is now a "controlled" component, receiving the main loading logic via the `onStructureSelect` prop.
 */
function SettingsPanel({
  isMolstarReady,
  onStructureSelect
}: {
  isMolstarReady: boolean;
  onStructureSelect: (pdbId: string) => void;
}) {
  const dispatch = useAppDispatch();
  const availableStructures = useAppSelector(selectAvailableStructures);
  const selectedStructure = useAppSelector(selectSelectedStructure);
  const isLoading = useAppSelector(selectIsLoading);
  const error = useAppSelector(selectError);
  const [customPdbId, setCustomPdbId] = useState('');

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

  const isInteractionDisabled = isLoading || !isMolstarReady;

  return (
    <div className="w-80 h-full bg-gray-50 border-r border-gray-200 p-4 overflow-y-auto">
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Tubulin Viewer</h2>
          <p className="text-sm text-gray-600">Select a structure or load by PDB ID.</p>
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
        {error && <div className="text-red-500 text-sm p-2 bg-red-50 rounded-md">{error}</div>}
        <div className="space-y-2">
          <h3 className="text-md font-medium text-gray-800">Available Structures</h3>
          {availableStructures.map((structure) => (
            <button
              key={structure.pdbId}
              onClick={() => handleSelect(structure.pdbId)}
              disabled={isInteractionDisabled}
              className={`w-full text-left p-3 rounded-lg border transition-colors ${selectedStructure === structure.pdbId
                ? 'bg-blue-50 border-blue-200 ring-2 ring-blue-500'
                : 'bg-white border-gray-200 hover:bg-gray-100'
                } ${isInteractionDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span className="font-medium text-gray-900">{structure.pdbId.toUpperCase()}</span>
              <p className="text-sm text-gray-600 line-clamp-2">{structure.title}</p>
            </button>
          ))}
        </div>
        {isLoading && <div className="text-sm text-gray-500">Loading...</div>}
      </div>
    </div>
  );
}

/**
 * Main Page Component: Manages the overall layout and state,
 * orchestrating interactions between the settings panel, the 3D viewer, and the 2D grid.
 */
export default function TubulinViewerPage() {
  const molstarRef = useRef<HTMLDivElement>(null);
  const { isInitialized, service } = useMolstarService(molstarRef, 'main');
  const dispatch = useAppDispatch();
  const selectedStructure = useAppSelector(selectSelectedStructure);

  // State for the 2D Protofilament Grid
  const [gridData, setGridData] = useState<GridData | null>(null);
  const [selectedGridSubunit, setSelectedGridSubunit] = useState<string | null>(null);
  const [hoveredGridSubunit, setHoveredGridSubunit] = useState<string | null>(null);

  // Effect to clear the grid when the selected structure is cleared
  useEffect(() => {
    if (!selectedStructure) {
      setGridData(null);
    }
  }, [selectedStructure]);

  // Main orchestration function called by the SettingsPanel
  const handleStructureSelect = useCallback(async (pdbId: string) => {
    if (!service?.controller) {
      console.warn("Molstar controller not available.");
      return;
    }

    dispatch(selectStructure(pdbId));
    dispatch(setLoading(true));
    dispatch(setError(null));
    setGridData(null); // Clear old grid data immediately

    try {
      // 1. Fetch metadata from RCSB
      const gqlData = await fetchRcsbGraphQlData(pdbId);
      console.log(`[UI] Fetched GraphQL data for ${pdbId}`, gqlData);

      // 2. Parse the metadata to create the classification map for coloring
      const classificationMap = createTubulinClassificationMap(gqlData);
      console.log('[UI] Generated Tubulin Classification Map:', classificationMap);

      // 3. Parse the metadata again to generate the data for the 2D grid layout
      const newGridData = buildGridDataFromGql(gqlData, classificationMap);
      setGridData(newGridData);

      // 4. Load the structure into Mol*, passing the classification map for correct coloring
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

  // Callback for when the user hovers over a subunit in the 2D grid
  const handleSubunitHover = useCallback((subunit: SubunitData | null) => {
    const controller = service?.controller;
    if (!controller || !selectedStructure) return;

    // If hovering over a new subunit
    if (subunit) {
      controller.highlightChain(selectedStructure, subunit.auth_asym_id, true);
      setHoveredGridSubunit(subunit.id);
    } else {
      // If the mouse leaves, find the previously hovered subunit to un-highlight it
      const prevHovered = gridData?.subunits.find(s => s.id === hoveredGridSubunit);
      if (prevHovered) {
        controller.highlightChain(selectedStructure, prevHovered.auth_asym_id, false);
      }
      setHoveredGridSubunit(null);
    }
  }, [service, selectedStructure, gridData, hoveredGridSubunit]);

  // Callback for when the user clicks a subunit in the 2D grid
  const handleSubunitSelect = useCallback((subunit: SubunitData) => {
    console.log("Selected subunit on grid:", subunit);
    // This is where you would dispatch a selection action to Redux
    // or trigger other focus/selection events in Mol*
    setSelectedGridSubunit(subunit.id);
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-gray-100">
      <div className="flex flex-1 overflow-hidden">
        <SettingsPanel isMolstarReady={isInitialized} onStructureSelect={handleStructureSelect} />
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
        <ChainPanel />
      </div>
      {/* The 2D Protofilament Grid component is rendered at the bottom */}
      <div className="flex-shrink-0 border-t bg-white shadow-inner">
        <ProtofilamentGrid
          gridData={gridData}
          onSubunitHover={handleSubunitHover}
          onSubunitSelect={handleSubunitSelect}
          hoveredSubunitId={hoveredGridSubunit}
          selectedSubunitId={selectedGridSubunit}
        />
      </div>
    </div>
  );
}
