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

            // ❌ REMOVE direct Molstar call - let the sync hook handle it
            // if (molstarService?.controller && selectedSequence) {
            //   molstarService.controller.clearResidueSelection(selectedSequence.chainId);
            // }
        }
    }, [selectedSequence, isSelectionSyncEnabled, dispatch]); // Remove molstarService from dependencies

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

    // ❌ REMOVE THIS EFFECT - it causes double calls with useMolstarSync hook
    // The sync hook should handle all Molstar communication
    // useEffect(() => {
    //   if (!currentSelection || !molstarService?.controller || !selectedSequence) return;
    //   molstarService.controller.selectResiduesRange(...);
    // }, [currentSelection, molstarService, selectedSequence]);

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
                    key={`${selectedSequence.pdbId}_${selectedSequence.chainId}`}
                    name={selectedSequence.name || `Chain ${selectedSequence.chainId}`}
                    seq={selectedSequence.sequence}
                    viewer="linear"
                    showComplement={false}
                    translations={[]} // Remove translation arrows
                    annotations={[]} // Remove annotation arrows  
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