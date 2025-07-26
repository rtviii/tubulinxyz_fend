// src/components/sequence_viewer.tsx
'use client'
import React, { useState } from 'react';
import { SeqViz } from 'seqviz';
import { useAppSelector, useAppDispatch } from '@/store/store';
import { clearSelectedSequence } from '@/store/slices/sequence_viewer';
// import './seqviz.styles.css'

interface SequenceSelection {
    start: number;
    end: number;
    length: number;
    selectedText: string;
}

export function SequenceViewer() {
    const selectedSequence = useAppSelector(state => state.sequenceViewer.selectedForSequence);
    const isVisible = useAppSelector(state => state.sequenceViewer.isVisible);
    const dispatch = useAppDispatch();
    const [currentSelection, setCurrentSelection] = useState<SequenceSelection | null>(null);

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

    const handleClearSequence = () => {
        dispatch(clearSelectedSequence());
        setCurrentSelection(null);
    };

    // Handle sequence selection events
    const handleSequenceSelection = (selection: any) => {
        console.log('🧬 Sequence Selection Event:', selection);

        if (selection.length > 0) {
            // Convert to 1-based residue numbering (common in biology)
            const startResidue = selection.start + 1;
            const endResidue = selection.end;
            const selectedText = selectedSequence.sequence.slice(selection.start, selection.end);

            console.log(`📍 Chain ${selectedSequence.chainId} residues ${startResidue}-${endResidue}`);
            console.log(`🔤 Selected sequence: ${selectedText}`);

            // Update local state for UI feedback
            setCurrentSelection({
                start: startResidue,
                end: endResidue,
                length: selection.length,
                selectedText
            });

            // You could dispatch this to state for Molstar integration later
            // dispatch(setMolstarSelection({ 
            //   chainId: selectedSequence.chainId, 
            //   startResidue, 
            //   endResidue 
            // }));
        } else {
            setCurrentSelection(null);
        }
    };

    return (
        <div className="h-full flex flex-col bg-white">
            {/* Header */}
            <div className="flex items-center justify-between p-2 border-b bg-gray-50">
                <div className="flex-1">
                    <h3 className="text-sm font-medium text-gray-800">
                        Sequence: {selectedSequence.name || `${selectedSequence.pdbId} Chain ${selectedSequence.chainId}`}
                    </h3>
                    <div className="flex items-center space-x-4 mt-1">
                        <p className="text-xs text-gray-500">
                            {selectedSequence.sequence.length} residues
                        </p>
                        {currentSelection && (
                            <div className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">
                                Selected: {currentSelection.start}-{currentSelection.end} ({currentSelection.length} residues)
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

            {/* SeqViz Container with custom styling */}
            <div className="flex-1 overflow-hidden">
                <style jsx>{`
          :global(.seqviz-linear .bp) {
            font-size: 11px !important;
            padding: 0 1px !important;
          }
          :global(.seqviz-linear .aa) {
            font-size: 11px !important;
            padding: 0 1px !important;
          }
          :global(.seqviz-linear .seq-block) {
            letter-spacing: 0.5px !important;
          }
          :global(.seqviz-linear .translation-arrow) {
            display: none !important;
          }
          :global(.seqviz-linear .primer-arrow) {
            display: none !important;
          }
        `}</style>
                <SeqViz
                    key={`${selectedSequence.pdbId}_${selectedSequence.chainId}`}
                    name={selectedSequence.name || `Chain ${selectedSequence.chainId}`}
                    seq={selectedSequence.sequence}
                    viewer="linear"
                    showComplement={false}
                    translations={[]} // Explicitly disable translations to remove arrows
                    annotations={[]} // Disable annotations
                    primers={[]} // Disable primers
                    enzymes={[]} // Disable enzymes
                    style={{
                        height: '100%',
                        width: '100%',
                        fontSize: '12px', // Smaller font
                        '--seq-font-size': '11px', // Custom CSS variable for sequence
                    }}
                    zoom={{ linear: 20 }} // Higher zoom = more spacing between residues
                    colors={['#3b82f6', '#f97316', '#10b981', '#8b5cf6', '#f59e0b']}
                    onSelection={handleSequenceSelection}
                />
            </div>
        </div>
    );
}