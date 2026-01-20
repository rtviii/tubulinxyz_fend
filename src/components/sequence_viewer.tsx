// src/components/sequence_viewer.tsx
'use client'
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SeqViz } from 'seqviz';
import { useAppSelector, useAppDispatch } from '@/store/store';
import { clearSelectedSequence } from '@/store/slices/sequence_viewer';
import { setResidueSelection, setResidueHover, clearSelection, clearHover, setSelectionSyncEnabled, setHoverSyncEnabled } from '@/store/slices/sequence_structure_sync';
import { MolstarContext } from '@/components/molstar/molstar_service';

interface SequenceSelection {
    start: number;
    end: number;
    length: number;
    selectedText: string;
}

export function SequenceViewer() {
    // ALL HOOKS MUST BE AT THE TOP - before any conditional logic
    const selectedSequence = useAppSelector(state => state.sequenceViewer.selectedForSequence);
    const isVisible = useAppSelector(state => state.sequenceViewer.isVisible);
    const syncSelection = useAppSelector(state => state.sequenceStructureSync.currentSelection);
    const syncHover = useAppSelector(state => state.sequenceStructureSync.currentHover);
    const isSelectionSyncEnabled = useAppSelector(state => state.sequenceStructureSync.isSelectionSyncEnabled);
    const isHoverSyncEnabled = useAppSelector(state => state.sequenceStructureSync.isHoverSyncEnabled);

    const dispatch = useAppDispatch();
    const molstarService = React.useContext(MolstarContext)?.getService('main');
    const seqVizRef = useRef<HTMLDivElement>(null);

    const [currentSelection, setCurrentSelection] = useState<SequenceSelection | null>(null);
    const [hoveredResidue, setHoveredResidue] = useState<number | null>(null);
    // Create annotation tracks for alpha tubulin chains
    const createAnnotationTracks = useCallback(() => {
        if (!selectedSequence) return [];

        // Only show annotations for alpha tubulin chains (you can customize this logic)
        const isAlphaTubulin = selectedSequence.chainId === 'A' || selectedSequence.name?.toLowerCase().includes('alpha');

        if (!isAlphaTubulin) return [];

        // Disease mutations - individual residues only
        const mutations = [
            { start: 1, end: 1, name: "R2H", color: "#ef4444" },
            { start: 4, end: 4, name: "I5L", color: "#ef4444" },
            { start: 5, end: 5, name: "S6C", color: "#ef4444" },
            { start: 27, end: 27, name: "G28A", color: "#ef4444" },
            { start: 42, end: 42, name: "R43H", color: "#ef4444" },
            { start: 95, end: 95, name: "P96L", color: "#ef4444" },
            { start: 124, end: 124, name: "R125H", color: "#ef4444" },
            { start: 183, end: 183, name: "R184C", color: "#ef4444" },
            { start: 283, end: 283, name: "R284C", color: "#ef4444" },
            { start: 350, end: 350, name: "D351Y", color: "#ef4444" },
        ];

        // Post-translational modifications - individual residues only  
        const ptms = [
            { start: 3, end: 3, name: "Palmitoylation", color: "#8b5cf6" },
            { start: 5, end: 5, name: "Phosphorylation", color: "#8b5cf6" },
            { start: 23, end: 23, name: "Phosphorylation", color: "#8b5cf6" },
            { start: 39, end: 39, name: "Acetylation", color: "#8b5cf6" },
            { start: 56, end: 56, name: "O-GlcNAc", color: "#8b5cf6" },
            { start: 104, end: 104, name: "Methylation", color: "#8b5cf6" },
            { start: 158, end: 158, name: "Phosphorylation", color: "#8b5cf6" },
            { start: 251, end: 251, name: "Ubiquitination", color: "#8b5cf6" },
            { start: 312, end: 312, name: "SUMOylation", color: "#8b5cf6" },
            { start: 390, end: 390, name: "Methylation", color: "#8b5cf6" },
        ];

        // Ligand binding sites - can be ranges
        const ligandSites = [
            { start: 0, end: 4, name: "Pironetin Site", color: "#3b82f6" },
            { start: 8, end: 12, name: "GTP Binding", color: "#3b82f6" },
            { start: 156, end: 164, name: "Taxane Site", color: "#3b82f6" },
            { start: 228, end: 238, name: "Vinca Domain", color: "#3b82f6" },
            { start: 315, end: 325, name: "Maytansine Site", color: "#3b82f6" },
            { start: 348, end: 358, name: "Colchicine Site", color: "#3b82f6" },
        ];

        // Return as simple array of annotations with different colors for different types
        return [
            ...mutations,
            ...ptms,
            ...ligandSites
        ];
    }, [selectedSequence]);

    // Handle sequence selection events from SeqViz
    const handleSequenceSelection = useCallback((selection: any) => {
        console.log('🧬 Sequence Selection Event:', selection);

        if (selection.length > 0) {
            const startResidue = selection.start + 1; // Convert to 1-based
            const endResidue = selection.end;
            const selectedText = selectedSequence?.sequence.slice(selection.start, selection.end) || '';

            console.log(`📍 Chain ${selectedSequence?.chainId} residues ${startResidue}-${endResidue}`);
            console.log(`🔤 Selected sequence: ${selectedText}`);

            // Update local state for UI feedback
            setCurrentSelection({
                start: startResidue,
                end: endResidue,
                length: selection.length,
                selectedText
            });

            // Dispatch to sync state for Molstar integration
            if (isSelectionSyncEnabled && selectedSequence) {
                dispatch(setResidueSelection({
                    pdbId: selectedSequence.pdbId,
                    chainId: selectedSequence.chainId,
                    startResidue,
                    endResidue,
                    source: 'sequence'
                }));
            }
        } else {
            // Clear selection when nothing is selected
            setCurrentSelection(null);
            dispatch(clearSelection());
        }
    }, [selectedSequence, isSelectionSyncEnabled, dispatch]);

    // Listen for selections from Molstar and update SeqViz
    useEffect(() => {
        if (!syncSelection || !selectedSequence || syncSelection.source === 'sequence') return;

        // Only sync if it's for the same chain we're displaying
        if (syncSelection.chainId === selectedSequence.chainId &&
            syncSelection.pdbId === selectedSequence.pdbId) {

            console.log(`🔄 Syncing Molstar selection to sequence: ${syncSelection.startResidue}-${syncSelection.endResidue}`);

            // Update local selection state (convert back to 0-based for UI)
            setCurrentSelection({
                start: syncSelection.startResidue,
                end: syncSelection.endResidue,
                length: syncSelection.endResidue - syncSelection.startResidue + 1,
                selectedText: selectedSequence.sequence.slice(syncSelection.startResidue - 1, syncSelection.endResidue)
            });
        }
    }, [syncSelection, selectedSequence]);

    // Effect to clear selection when component unmounts or sequence changes
    useEffect(() => {
        return () => {
            // Let the sync hook handle Molstar cleanup by dispatching clear action
            dispatch(clearSelection());
        };
    }, [dispatch]);

    const toggleSelectionSync = useCallback(() => {
        dispatch(setSelectionSyncEnabled(!isSelectionSyncEnabled));
    }, [dispatch, isSelectionSyncEnabled]);

    const toggleHoverSync = useCallback(() => {
        dispatch(setHoverSyncEnabled(!isHoverSyncEnabled));
    }, [dispatch, isHoverSyncEnabled]);

    const handleClearSequence = useCallback(() => {
        // Don't call Molstar directly - let the sync hook handle it
        dispatch(clearSelectedSequence());
        dispatch(clearSelection());
        dispatch(clearHover());
        setCurrentSelection(null);
        setHoveredResidue(null);
    }, [dispatch]);

    // Get the annotation tracks
    const annotationTracks = createAnnotationTracks();

    // NOW we can do conditional rendering AFTER all hooks are called
    if (!isVisible || !selectedSequence) {
        return (
            <div className="h-full flex items-center justify-center bg-gray-50 text-gray-500">
                <div className="text-center">
                    <p className="text-sm">No sequence selected</p>
                    <p className="text-xs mt-1">Click "Show Sequence" on a polymer chain to view</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-white">
            {/* Header */}
            <div className="flex items-center justify-between p-2 border-b bg-gray-50">
                <div className="flex-1">
                    <div className="flex items-center space-x-2">
                        <h3 className="text-sm font-medium text-gray-800">
                            Sequence: {selectedSequence.name || `${selectedSequence.pdbId} Chain ${selectedSequence.chainId}`}
                        </h3>
                        {/* Sync Controls */}
                        <div className="flex items-center space-x-1">
                            <button
                                onClick={toggleSelectionSync}
                                className={`text-xs px-2 py-1 rounded ${isSelectionSyncEnabled
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-gray-100 text-gray-500'
                                    }`}
                                title="Toggle selection sync with 3D viewer"
                            >
                                🔗
                            </button>
                            <button
                                onClick={toggleHoverSync}
                                className={`text-xs px-2 py-1 rounded ${isHoverSyncEnabled
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-gray-100 text-gray-500'
                                    }`}
                                title="Toggle hover sync with 3D viewer"
                            >
                                👆
                            </button>
                        </div>
                    </div>
                    <div className="flex items-center space-x-4 mt-1">
                        <p className="text-xs text-gray-500">
                            {selectedSequence.sequence.length} residues
                        </p>
                        {/* Annotation Legend */}
                        {annotationTracks.length > 0 && (
                            <div className="flex items-center space-x-3 text-xs">
                                <div className="flex items-center space-x-1">
                                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                                    <span className="text-gray-600">Mutations</span>
                                </div>
                                <div className="flex items-center space-x-1">
                                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                                    <span className="text-gray-600">PTMs</span>
                                </div>
                                <div className="flex items-center space-x-1">
                                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                    <span className="text-gray-600">Ligand Sites</span>
                                </div>
                            </div>
                        )}
                        {currentSelection && (
                            <div className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">
                                Selected: {currentSelection.start}-{currentSelection.end} ({currentSelection.length} residues)
                            </div>
                        )}
                        {syncSelection && syncSelection.source === 'structure' &&
                            syncSelection.chainId === selectedSequence.chainId && (
                                <div className="text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded">
                                    3D: {syncSelection.startResidue}-{syncSelection.endResidue}
                                </div>
                            )}
                    </div>
                </div>
                <button
                    onClick={handleClearSequence}
                    className="text-gray-400 hover:text-gray-600 p-1"
                    title="Close sequence viewer"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>

            {/* SeqViz Container */}
            <div className="flex-1 overflow-hidden" ref={seqVizRef}>
                <SeqViz
                    name={selectedSequence.name || `Chain ${selectedSequence.chainId}`}
                    seq={selectedSequence.sequence}
                    viewer="linear"
                    showComplement={false}
                    translations={[]} // Remove translation arrows
                    annotations={annotationTracks} // ✨ ADD THE ANNOTATION TRACKS HERE
                    primers={[]} // Remove primer arrows
                    enzymes={[]} // Remove enzyme cut sites
                    highlights={[]} // Remove default highlights
                    style={{ height: '100%', width: '100%' }}
                    zoom={{ linear: 25 }} // More spacing between residues
                    colors={['#3b82f6', '#f97316', '#10b981', '#8b5cf6', '#f59e0b']}
                    onSelection={handleSequenceSelection}
                    // External selection control (if SeqViz supports it)
                    selection={syncSelection && syncSelection.source === 'structure' &&
                        syncSelection.chainId === selectedSequence.chainId ? {
                        start: syncSelection.startResidue - 1, // Convert to 0-based
                        end: syncSelection.endResidue,
                        clockwise: true
                    } : undefined}
                />
            </div>
        </div>
    );
}