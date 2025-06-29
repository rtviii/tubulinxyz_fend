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
import { ProtofilamentGrid, GridData, SubunitData } from '@/components/protofilament_grid';
import { buildGridDataFromGql } from '@/services/protofilament_grid_parser';

// A larger list of suggested PDB IDs to be picked from randomly.

// At the top of your page.tsx, you might need to add the Shuffle icon to your imports
// import { Shuffle } from 'lucide-react';

// A larger list of suggested PDB IDs (should already be in your file)
const SUGGESTED_PDB_IDS = ["6WVR", "8QV0", "3JAT", "6O2R", "4TV9", "6U0H", "8VRK", "6E7B", "5J2T", "6FKJ", "4O2B", "6DPU", "1SA0", "6BR1", "7SJ8", "2MZ7", "7SJ9", "6O2T"];

/**
 * SettingsPanel Component: Renders the left-side panel for loading structures.
 */
function SettingsPanel({
    isMolstarReady,
    onStructureSelect
}: {
    isMolstarReady: boolean;
    onStructureSelect: (pdbId: string) => void;
}) {
    const selectedStructure = useAppSelector(selectSelectedStructure);
    const isLoading = useAppSelector(selectIsLoading);
    const error = useAppSelector(selectError);
    const [customPdbId, setCustomPdbId] = useState('');
    const [suggestedPdbId, setSuggestedPdbId] = useState<string | null>(null);

    // Effect to pick one random structure to suggest when the app is ready.
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

    // --- NEW: Function to pick a new random suggestion ---
    const handleRandomize = () => {
        if (SUGGESTED_PDB_IDS.length <= 1) return; // Avoid infinite loop

        let newPdbId;
        do {
            const randomIndex = Math.floor(Math.random() * SUGGESTED_PDB_IDS.length);
            newPdbId = SUGGESTED_PDB_IDS[randomIndex];
        } while (newPdbId === suggestedPdbId); // Make sure it's different

        setSuggestedPdbId(newPdbId);
    };
    
    const isInteractionDisabled = isLoading || !isMolstarReady;

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

                {error && <div className="text-red-500 text-sm p-2 bg-red-50 rounded-md">{error}</div>}
                
                {suggestedPdbId && (
                    <div className="space-y-2">
                        {/* --- NEW: Title with Randomize Button --- */}
                        <div className="flex justify-between items-center">
                            <h3 className="text-md font-medium text-gray-800">Suggested Structure</h3>
                            <button 
                                onClick={handleRandomize}
                                disabled={isInteractionDisabled}
                                className="p-1.5 rounded-full text-gray-500 hover:bg-gray-200 hover:text-gray-800 disabled:opacity-50"
                                title="Get another suggestion"
                            >
                                {/* Replace with a suitable icon, e.g., from lucide-react */}
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

    const [gridData, setGridData] = useState<GridData | null>(null);
    const [selectedGridSubunit, setSelectedGridSubunit] = useState<string | null>(null);
    const [hoveredGridSubunit, setHoveredGridSubunit] = useState<string | null>(null);

    useEffect(() => {
        if (!selectedStructure) {
            setGridData(null);
        }
    }, [selectedStructure]);
    
    const handleStructureSelect = useCallback(async (pdbId: string) => {
        if (!service?.controller) {
            console.warn("Molstar controller not available.");
            return;
        }

        dispatch(selectStructure(pdbId));
        dispatch(setLoading(true));
        dispatch(setError(null));
        setGridData(null);

        try {
            const gqlData = await fetchRcsbGraphQlData(pdbId);
            console.log(`[UI] Fetched GraphQL data for ${pdbId}`, gqlData);
            const classificationMap = createTubulinClassificationMap(gqlData);
            console.log('[UI] Generated Tubulin Classification Map:', classificationMap);
            const newGridData = buildGridDataFromGql(gqlData, classificationMap);
            setGridData(newGridData);
            await service.controller.loadStructure(pdbId, classificationMap);
            // The `stylized_lighting` method you had isn't in the provided MolstarViewer,
            // but you can add it if you have the code for it.
            await service.viewer.representations.stylized_lighting()
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            console.error(`[UI] An error occurred during the loading process for ${pdbId}:`, error);
            dispatch(setError(errorMessage));
        } finally {
            dispatch(setLoading(false));
        }
    }, [service, dispatch]);

    const handleSubunitHover = useCallback((subunit: SubunitData | null) => {
        const controller = service?.controller;
        if (!controller || !selectedStructure) return;

        if (subunit) {
            controller.highlightChain(selectedStructure, subunit.auth_asym_id, true);
            setHoveredGridSubunit(subunit.id);
        } else {
            const prevHovered = gridData?.subunits.find(s => s.id === hoveredGridSubunit);
            if (prevHovered) {
                controller.highlightChain(selectedStructure, prevHovered.auth_asym_id, false);
            }
            setHoveredGridSubunit(null);
        }
    }, [service, selectedStructure, gridData, hoveredGridSubunit]);

    const handleSubunitSelect = useCallback((subunit: SubunitData) => {
        console.log("Selected subunit on grid:", subunit);
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
