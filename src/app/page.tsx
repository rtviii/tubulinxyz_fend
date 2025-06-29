'use client'
import { useRef, useState } from 'react'; // Import useState
import { useMolstarService, MolstarContext } from '@/components/molstar/molstar_service';
import { MolstarNode } from '@/components/molstar/molstar_spec';
import { useAppDispatch, useAppSelector } from '@/store/store';
import {
  selectStructure,
  selectAvailableStructures,
  selectSelectedStructure,
  selectIsLoading,
  selectError
} from '@/store/slices/tubulin_structures';
import React from 'react';
import { ChainPanel } from '@/components/chain_panel';

// Panel for selecting structures and seeing status
function SettingsPanel({ isMolstarReady }: { isMolstarReady: boolean }) {
  const dispatch = useAppDispatch();
  const availableStructures = useAppSelector(selectAvailableStructures);
  const selectedStructure = useAppSelector(selectSelectedStructure);
  const isLoading = useAppSelector(selectIsLoading);
  const error = useAppSelector(selectError);
  const molstarService = React.useContext(MolstarContext)?.getService('main');

  // --- NEW: State for the custom PDB input field ---
  const [customPdbId, setCustomPdbId] = useState('');

  const handleStructureSelect = async (pdbId: string) => {
    if (!molstarService?.controller || !pdbId) {
      console.warn('Molstar controller not ready or PDB ID is missing.');
      return;
    }
    // The rest of your loading logic is perfect
    dispatch(selectStructure(pdbId));
    await molstarService.controller.loadStructure(pdbId);
    await molstarService.viewer.representations.stylized_lighting()
  };

  // --- NEW: Handler for the form submission ---
  const handleCustomLoad = (e: React.FormEvent) => {
    e.preventDefault(); // Prevents the browser from reloading the page
    const trimmedId = customPdbId.trim();
    if (trimmedId.length === 4) {
      handleStructureSelect(trimmedId);
      setCustomPdbId(''); // Clear input after load
    }
  };


  const isInteractionDisabled = isLoading || !isMolstarReady;

  return (
    <div className="w-80 h-full bg-gray-50 border-r border-gray-200 p-4 overflow-y-auto">
      <div className="space-y-6"> {/* Increased spacing */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Tubulin Viewer</h2>
          <p className="text-sm text-gray-600">Select a default structure or load your own by PDB ID.</p>
        </div>

        {/* --- NEW: Input form for custom PDB ID --- */}
        <div className="space-y-2">
          <h3 className="text-md font-medium text-gray-800">Load Custom Structure</h3>
          <form onSubmit={handleCustomLoad} className="flex items-center space-x-2">
            <input
              type="text"
              placeholder="e.g., 1SA0"
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
              onClick={() => handleStructureSelect(structure.pdbId)}
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

// Main page layout component (no changes needed here)
export default function TubulinViewerPage() {
  const molstarRef = useRef<HTMLDivElement>(null);
  const { isInitialized } = useMolstarService(molstarRef, 'main');

  return (
    <div className="h-screen w-screen flex overflow-hidden">
      <SettingsPanel isMolstarReady={isInitialized} />
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
  );
}
