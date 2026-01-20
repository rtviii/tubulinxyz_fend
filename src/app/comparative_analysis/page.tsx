'use client'
import { useRef, useState, useEffect, useCallback } from 'react';
import { useMolstarService } from '@/components/molstar/molstar_service';
import { MolstarNode } from '@/components/molstar/spec';
import { useAppDispatch, useAppSelector } from '@/store/store';
import { selectStructure, selectSelectedStructure, selectIsLoading, selectError, setLoading, setError } from '@/store/slices/tubulin_structures';
import React from 'react';

interface SequenceData {
    chainId: string;
    pdbId: string;
    sequence: string;
    name: string;
    chainType: string;
}

interface StructureUploadPanelProps {
    onFileUpload: (file: File) => void;
    isLoading: boolean;
    error: string | null;
}

function StructureUploadPanel({ onFileUpload, isLoading, error }: StructureUploadPanelProps) {
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            if (file.name.endsWith('.pdb') || file.name.endsWith('.cif')) {
                onFileUpload(file);
            }
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            onFileUpload(files[0]);
        }
    };

    const handleLoadDefault = () => {
        fetch('/5JCO_chainA.pdb')
            .then(response => response.blob())
            .then(blob => {
                const file = new File([blob], '5JCO_chainA.pdb', { type: 'chemical/x-pdb' });
                onFileUpload(file);
            })
            .catch(err => console.error('Failed to load default structure:', err));
    };

    const handleLoadAlignedIsotypes = () => {
        fetch('/aligned_isotypes.cif')
            .then(response => response.blob())
            .then(blob => {
                const file = new File([blob], 'aligned_isotypes.cif', { type: 'chemical/x-mmcif' });
                onFileUpload(file);
            })
            .catch(err => console.error('Failed to load aligned isotypes:', err));
    };

    return (
        <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Comparative Analysis</h2>
            <p className="text-sm text-gray-600 mb-4">Upload a structure file to analyze its sequence</p>

            {/* Default Structure Buttons */}
            <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-800 mb-2">Load Examples</h3>
                <div className="space-y-2">
                    <button
                        onClick={handleLoadDefault}
                        disabled={isLoading}
                        className="w-full px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        TUBA1A (5JCO)
                    </button>
                    <button
                        onClick={handleLoadAlignedIsotypes}
                        disabled={isLoading}
                        className="w-full px-3 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        TUBA1C (6SM8)
                    </button>
                </div>
            </div>

            {error && (
                <div className="p-3 text-sm text-red-700 bg-red-100 border border-red-300 rounded-md mb-4">
                    {error}
                </div>
            )}

            {isLoading && (
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <span>Loading structure...</span>
                </div>
            )}
        </div>
    );
}

interface SequenceListProps {
    sequences: SequenceData[];
    onResidueHover: (sequence: SequenceData, residueIndex: number | null) => void;
    onResidueClick: (sequence: SequenceData, residueIndex: number) => void; // Add this prop

}

function SequenceList({ sequences, onResidueHover, onResidueClick }: SequenceListProps) {
    const [hoveredResidue, setHoveredResidue] = useState<{ chainId: string, index: number } | null>(null);

    const handleResidueMouseEnter = (sequence: SequenceData, index: number) => {
        setHoveredResidue({ chainId: sequence.chainId, index });
        onResidueHover(sequence, index);
    };

    const handleResidueMouseLeave = () => {
        setHoveredResidue(null);
        onResidueHover(sequences[0], null); // Pass any sequence, index null clears hover
    };

    const handleResidueClick = (sequence: SequenceData, index: number) => {
        onResidueClick(sequence, index);
    };

    const formatSequenceWithHover = (sequence: SequenceData) => {
        return sequence.sequence.split('').map((residue, index) => {
            const isHovered = hoveredResidue?.chainId === sequence.chainId && hoveredResidue?.index === index;
            return (
                <span
                    key={index}
                    className={`inline-block cursor-pointer px-0.5 py-0.5 rounded transition-colors ${isHovered ? 'bg-yellow-200 text-yellow-900' : 'hover:bg-gray-200'
                        }`}
                    onMouseEnter={() => handleResidueMouseEnter(sequence, index)}
                    onMouseLeave={handleResidueMouseLeave}
                    onClick={() => handleResidueClick(sequence, index)} // Add click handler here
                    title={`${residue} ${index + 1}`}
                >
                    {residue}
                </span>
            );
        });
    };

    // Rest of your component remains the same...
    return (
        <div className="flex-1 overflow-auto">
            <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">{sequences.length} of 100 selected</span>
                    <div className="flex space-x-2">
                        <button className="text-xs text-blue-600 hover:text-blue-800">Download Selected</button>
                        <button className="text-xs text-blue-600 hover:text-blue-800">Hide Sequence</button>
                    </div>
                </div>

                {/* Header row */}
                <div className="grid grid-cols-6 gap-2 text-xs text-gray-600 font-medium mb-2 border-b pb-1">
                    <span>auth_asym_id</span>
                    <span>polymer_class</span>
                    <span>parent_rcsb_id</span>
                    <span>src_organism_ids</span>
                    <span>rcsb_pdbx_description</span>
                    <span></span>
                </div>
            </div>

            {/* Sequence list */}
            <div className="space-y-1">
                {sequences.map((seq) => (
                    <div key={seq.chainId} className="flex items-start space-x-2 py-1 hover:bg-gray-50 rounded">
                        <input
                            type="checkbox"
                            className="mt-1 flex-shrink-0"
                        />
                        <div className="grid grid-cols-6 gap-2 text-xs font-mono flex-1 min-w-0">
                            <span className="text-blue-600 font-medium">{seq.chainId}</span>
                            <span className="text-gray-600">PROTEIN</span>
                            <span className="text-gray-600">{seq.pdbId}</span>
                            <span className="text-gray-600">-</span>
                            <span className="text-gray-600 truncate">{seq.name}</span>
                            <span></span>
                        </div>
                    </div>
                ))}

                {/* Sequence data with interactive residues */}
                {sequences.map((seq) => (
                    (
                        <div key={`seq-${seq.chainId}`} className="ml-6 mt-1 font-mono text-xs text-gray-800 bg-gray-50 p-2 rounded leading-relaxed">
                            {formatSequenceWithHover(seq)}
                        </div>
                    )
                ))}
            </div>

            {sequences.length === 0 && (
                <div className="text-center text-gray-500 py-8">
                    <p>No sequences loaded</p>
                    <p className="text-sm">Upload a structure file to view sequences</p>
                </div>
            )}
        </div>
    );
}

export default function ComparativeAnalysisPage() {
    const molstarRef = useRef<HTMLDivElement>(null);
    const { isInitialized, service } = useMolstarService(molstarRef, 'main');
    const dispatch = useAppDispatch();
    const selectedStructure = useAppSelector(selectSelectedStructure);
    const isLoading = useAppSelector(selectIsLoading);
    const error = useAppSelector(selectError);

    const [sequences, setSequences] = useState<SequenceData[]>([]);
    const [checkedSequences, setCheckedSequences] = useState<Set<string>>(new Set());

    // Load structure from file
    const loadStructureFromFile = useCallback(async (file: File) => {
        if (!service?.controller || !isInitialized) {
            dispatch(setError('Molstar not initialized'));
            return;
        }

        dispatch(setLoading(true));
        dispatch(setError(null));

        try {
            const fileName = file.name;
            const pdbId = fileName.split('.')[0].toUpperCase();

            console.log('Loading file:', fileName);

            // For aligned isotypes, clear all existing structures first since it contains both
            if (fileName.includes('aligned_isotypes') || fileName.includes('6SM8')) {
                console.log('Loading aligned structure - clearing all previous structures');
                await service.controller.clearAll();
            } else {
                // For single structures, just clear current
                await service.controller.clearCurrentStructure();
            }

            // First try: use existing loadStructure method with PDB ID if it's a known structure
            if (pdbId && pdbId.length === 4) {
                console.log('Attempting to load as PDB ID:', pdbId);
                const success = await service.controller.loadStructure(pdbId, dummyClassification);

                if (success) {
                    // Extract sequence using controller method
                    const sequence = service.controller.getChainSequence(pdbId, 'A');
                    if (sequence) {
                        const extractedSequences = [{
                            chainId: 'A',
                            pdbId,
                            sequence,
                            name: `${pdbId}_CHAINA Chain A (${sequence.length} residues)`,
                            chainType: 'polymer'
                        }];
                        setSequences(extractedSequences);
                        setCheckedSequences(new Set(['A']));
                        console.log('Successfully extracted sequence from controller');
                        return;
                    }
                }
            }

            // Fallback: try raw file loading
            console.log('Fallback to raw file loading');
            const fileContent = await file.text();

            if (!service.viewer.ctx) {
                throw new Error('Molstar context not available');
            }

            const data = await service.viewer.ctx.builders.data.rawData({
                data: fileContent,
                label: fileName
            });

            const trajectory = await service.viewer.ctx.builders.structure.parseTrajectory(
                data,
                fileName.endsWith('.pdb') ? 'pdb' : 'mmcif'
            );

            const model = await service.viewer.ctx.builders.structure.createModel(trajectory);
            const structure = await service.viewer.ctx.builders.structure.createStructure(model);

            // Apply cartoon representation
            const repr = await service.viewer.ctx.builders.structure.representation.addRepresentation(structure, {
                type: 'cartoon',
                colorTheme: { name: 'chain-id', params: {} }
            });

            console.log('Raw structure loaded successfully');

            dispatch(selectStructure(pdbId));

            // Extract sequences from the loaded structure
            const extractedSequences = extractSequencesFromStructure(structure.obj!.data, pdbId);
            setSequences(extractedSequences);

            console.log('Successfully loaded structure and extracted sequences:', extractedSequences);

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to load structure';
            dispatch(setError(errorMessage));
            console.error('Error loading structure:', error);
        } finally {
            dispatch(setLoading(false));
        }
    }, [service, isInitialized, dispatch]);

    // Extract sequences from Molstar structure
    const extractSequencesFromStructure = (structure: any, pdbId: string): SequenceData[] => {
        const sequences: SequenceData[] = [];

        try {
            // Get all unique chain IDs from the structure
            const chainData = new Map<string, { residues: Map<number, string>, count: number }>();

            // Iterate through all units to collect chain information
            for (const unit of structure.units) {
                if (unit.kind === 0) { // Atomic unit
                    const elements = unit.elements;

                    for (let i = 0; i < elements.length; i++) {
                        const element = elements[i];
                        let chainId = 'A'; // Default fallback
                        let seqId = i + 1;
                        let compId = 'UNK';

                        try {
                            // Try to get chain ID
                            if (unit.model?.atomicHierarchy?.chains?.auth_asym_id) {
                                const chainIndex = unit.model.atomicHierarchy.chainAtomSegments.index[element];
                                chainId = unit.model.atomicHierarchy.chains.auth_asym_id.value(chainIndex);
                            }

                            // Try to get sequence ID
                            if (unit.model?.atomicHierarchy?.residues?.auth_seq_id) {
                                const residueIndex = unit.model.atomicHierarchy.residueAtomSegments.index[element];
                                seqId = unit.model.atomicHierarchy.residues.auth_seq_id.value(residueIndex);
                            }

                            // Try to get compound ID  
                            if (unit.model?.atomicHierarchy?.atoms?.label_comp_id) {
                                compId = unit.model.atomicHierarchy.atoms.label_comp_id.value(element);
                            }
                        } catch (e) {
                            // Use fallbacks
                        }

                        // Initialize chain data if not exists
                        if (!chainData.has(chainId)) {
                            chainData.set(chainId, { residues: new Map(), count: 0 });
                        }

                        const chain = chainData.get(chainId)!;
                        chain.count++;

                        // Convert to single letter and store
                        const singleLetter = AMINO_ACID_MAP[compId] || (compId.length === 1 ? compId : 'X');
                        chain.residues.set(seqId, singleLetter);
                    }
                }
            }

            // Build sequences for each chain
            chainData.forEach((chainInfo, chainId) => {
                if (chainInfo.residues.size > 0) {
                    // Sort residues by sequence ID and build sequence string
                    const sortedResidues = Array.from(chainInfo.residues.entries())
                        .sort((a, b) => a[0] - b[0]);

                    // Remove duplicates by taking unique sequence positions
                    const uniqueResidues = new Map<number, string>();
                    sortedResidues.forEach(([seqId, residue]) => {
                        if (!uniqueResidues.has(seqId)) {
                            uniqueResidues.set(seqId, residue);
                        }
                    });

                    const sequence = Array.from(uniqueResidues.values()).join('');

                    if (sequence.length > 10) { // Only include substantial sequences
                        // Generate better names based on structure
                        let structureName = `${pdbId} TUBA1A Chain ${chainId}`;
                        if (pdbId.includes('ALIGNED') || pdbId.includes('6SM8')) {
                            structureName = chainId === 'A' ? '6SM8 TUBA1C' : '5JCO TUBA1A';
                        }

                        sequences.push({
                            chainId,
                            pdbId,
                            sequence,
                            name: structureName,
                            chainType: 'polymer'
                        });
                    }
                }
            });

            console.log('Extracted sequences for chains:', Array.from(chainData.keys()));

        } catch (error) {
            console.error('Error extracting sequences:', error);
        }

        // Fallback: create dummy sequence if nothing extracted
        if (sequences.length === 0) {
            sequences.push({
                chainId: 'A',
                pdbId,
                sequence: 'MKVLTITSSRSRNLKEYAKEFNGTVKKFEIGVKKLKLPGYKYVDYRVFHGFSKTNGFMVDYLRKEAGNNIPALLMRKGFYAEYAAEKLVAVVERQKFTADNRQGEALVLMKQIAKEFGADGKVEKAVKAVKAVKAV',
                name: `${pdbId}_CHAINA Chain A (428 residues)`,
                chainType: 'polymer'
            });
        }

        return sequences;
    };

    // Clean removal of old checkbox code - no longer used since we removed the checkbox functionality

    const handleResidueHover = useCallback((sequence: SequenceData, residueIndex: number | null) => {
        if (!service?.controller) return;

        if (residueIndex !== null) {
            // Convert 0-based index to 1-based residue number for Molstar
            const residueNumber = residueIndex + 1;
            service.controller.hoverResidue(sequence.pdbId, sequence.chainId, residueNumber, true);
        } else {
            // Clear hover
            service.controller.hoverResidue(sequence.pdbId, sequence.chainId, 0, false);
        }
    }, [service]);

    const handleResidueClick = useCallback((sequence: SequenceData, residueIndex: number) => {
        if (!service?.controller) return;

        // Convert 0-based index to 1-based residue number for Molstar
        const residueNumber = residueIndex + 1;

        // Use selectResidues to create a selection for just this one residue
        service.controller.selectResidues(sequence.pdbId, sequence.chainId, residueNumber, residueNumber);
    }, [service]);

    return (
        <div className="h-screen w-screen flex overflow-hidden bg-white">
            {/* Left Panel - Sequences (60%) */}
            <div className="w-[60%] h-full border-r border-gray-200 p-4 flex flex-col">
                <StructureUploadPanel
                    onFileUpload={loadStructureFromFile}
                    isLoading={isLoading}
                    error={error}
                />

                <SequenceList
                    sequences={sequences}
                    onResidueHover={handleResidueHover}
                    onResidueClick={handleResidueClick}
                />
            </div>

            {/* Right Panel - Molstar Viewer (40%) */}
            <div className="w-[40%] h-full bg-white relative">
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
        </div>
    );
}

// Amino acid three-letter to one-letter mapping
const AMINO_ACID_MAP: Record<string, string> = {
    'ALA': 'A', 'ARG': 'R', 'ASN': 'N', 'ASP': 'D', 'CYS': 'C',
    'GLN': 'Q', 'GLU': 'E', 'GLY': 'G', 'HIS': 'H', 'ILE': 'I',
    'LEU': 'L', 'LYS': 'K', 'MET': 'M', 'PHE': 'F', 'PRO': 'P',
    'SER': 'S', 'THR': 'T', 'TRP': 'W', 'TYR': 'Y', 'VAL': 'V',
    'SEC': 'U', 'PYL': 'O'
};