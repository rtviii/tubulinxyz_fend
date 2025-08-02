'use client';
import React from 'react';
import { useAppSelector, useAppDispatch } from '@/store/store';
import { selectSelectedStructure } from '@/store/slices/tubulin_structures';
import { PolymerComponent, LigandComponent, selectComponentsForStructure } from '@/store/slices/molstar_refs';
import { selectPolymerState } from '@/store/slices/polymer_states';
import { selectNonPolymerState } from '@/store/slices/nonpolymer_states';
import { setSelectedSequence } from '@/store/slices/sequence_viewer';
import { MolstarContext } from '@/components/molstar/molstar_service';
import { Eye, EyeOff, Focus, FileText } from 'lucide-react';
import { ProtofilamentGrid, SubunitData } from './protofilament_grid';

const PolymerRow = ({ component }: { component: PolymerComponent }) => {
    const dispatch = useAppDispatch();
    const molstarService = React.useContext(MolstarContext)?.getService('main');
    const polymerState = useAppSelector(state => selectPolymerState(state, { pdbId: component.pdbId, chainId: component.chainId }));

    if (!molstarService || !polymerState) return null;

    const { controller } = molstarService;

    const toggleVisibility = (e: React.MouseEvent) => {
        e.stopPropagation();
        controller.setChainVisibility(component.pdbId, component.chainId, !polymerState.visible);
    };

    const handleMouseEnter = () => {
        controller.highlightChain(component.pdbId, component.chainId, true);
    };

    const handleMouseLeave = () => {
        controller.highlightChain(component.pdbId, component.chainId, false);
    };

    const focusChain = (e: React.MouseEvent) => {
        e.stopPropagation();
        controller.focusChain(component.pdbId, component.chainId);
    };

    const showSequence = (e: React.MouseEvent) => {
        e.stopPropagation();
        const sequenceData = controller.getSequenceForViewer(component.pdbId, component.chainId);
        if (sequenceData) {
            dispatch(setSelectedSequence(sequenceData));
        } else {
            console.warn(`Could not extract sequence for chain ${component.chainId}`);
        }
    };

    return (
        <div
            className={`flex items-center justify-between py-0.5 px-2 rounded-sm transition-colors cursor-pointer ${polymerState.hovered ? 'bg-blue-100' : 'hover:bg-gray-100'}`}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={focusChain}
        >
            <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-gray-300 rounded-sm flex-shrink-0"></div>
                <span className="font-mono text-xs select-none">{component.chainId}</span>
            </div>
            <div className="flex items-center">
                <button onClick={showSequence} className="p-0.5 text-gray-400 hover:text-blue-600" title="Show Sequence" >
                    <FileText size={14} />
                </button>
                <button onClick={focusChain} className="p-0.5 text-gray-400 hover:text-gray-800" title="Focus Chain" >
                    <Focus size={14} />
                </button>
                <button onClick={toggleVisibility} className="p-0.5 text-gray-400 hover:text-gray-800" title="Toggle Visibility" >
                    {polymerState.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
            </div>
        </div>
    );
};

const LigandRow = ({ component }: { component: LigandComponent }) => {
    const molstarService = React.useContext(MolstarContext)?.getService('main');
    const nonPolymerState = useAppSelector(state => selectNonPolymerState(state, { pdbId: component.pdbId, chemId: component.uniqueKey }));

    if (!molstarService || !nonPolymerState) return null;

    const { controller } = molstarService;

    const toggleVisibility = (e: React.MouseEvent) => {
        e.stopPropagation();
        controller.setNonPolymerVisibility(component.pdbId, component.uniqueKey, !nonPolymerState.visible);
    };

    const handleMouseEnter = () => {
        controller.highlightNonPolymer(component.pdbId, component.uniqueKey, true);
    };

    const handleMouseLeave = () => {
        controller.highlightNonPolymer(component.pdbId, component.uniqueKey, false);
    };

    const focusLigand = (e: React.MouseEvent) => {
        e.stopPropagation();
        controller.focusNonPolymer(component.pdbId, component.uniqueKey);
    };

    return (
        <div
            className={`flex items-center justify-between py-0.5 px-2 rounded-sm transition-colors cursor-pointer ${nonPolymerState.hovered ? 'bg-blue-100' : 'hover:bg-gray-100'}`}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={focusLigand}
        >
            <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-300 rounded-sm flex-shrink-0"></div>
                <span className="font-mono text-xs select-none">
                    {component.compId} ({component.auth_asym_id}:{component.auth_seq_id})
                </span>
            </div>
            <div className="flex items-center">
                <button onClick={focusLigand} className="p-0.5 text-gray-400 hover:text-gray-800" title="Focus Ligand">
                    <Focus size={14} />
                </button>
                <button onClick={toggleVisibility} className="p-0.5 text-gray-400 hover:text-gray-800" title="Toggle Visibility">
                    {nonPolymerState.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
            </div>
        </div>
    );
};

// 🚨 FIX: Accept props for grid interaction
export const EntitiesPanel = ({ onSubunitHover, onSubunitSelect, hoveredSubunitId, selectedSubunitId }: {
    onSubunitHover: (subunit: SubunitData | null) => void;
    onSubunitSelect: (subunit: SubunitData) => void;
    hoveredSubunitId: string | null;
    selectedSubunitId: string | null;
}) => {
    const selectedStructure = useAppSelector(selectSelectedStructure);
    const components = useAppSelector(state => selectComponentsForStructure(state, selectedStructure || ''));

    const polymerComponents = (components?.filter(c => c.type === 'polymer') as PolymerComponent[]) || [];
    const ligandComponents = (components?.filter(c => c.type === 'ligand') as LigandComponent[]) || [];

    return (
        <div className="w-64 h-full bg-gray-50 border-l border-gray-200 flex flex-col">
            {/* 🎨 FIX: Flatter layout with better spacing control */}
            <div className="flex-1 overflow-y-auto p-2 space-y-4">
                {/* --- Polymer Chains Section --- */}
                <div>
                    <h3 className="text-sm font-semibold text-gray-800 mb-1 px-1">Polymer Chains</h3>
                    <div className="space-y-0.5">
                        {!selectedStructure ? (
                            <p className="text-xs text-gray-500 px-1">No structure loaded.</p>
                        ) : polymerComponents.length > 0 ? (
                            polymerComponents.sort((a, b) => a.chainId.localeCompare(b.chainId, undefined, { numeric: true }))
                                .map(comp => <PolymerRow key={comp.chainId} component={comp} />)
                        ) : (
                            <p className="text-xs text-gray-500 px-1">Loading chains...</p>
                        )}
                    </div>
                </div>

                {/* --- Ligands Section --- */}
                {ligandComponents.length > 0 && (
                    <div className="border-t border-gray-200 pt-3">
                        <h3 className="text-sm font-semibold text-gray-800 mb-1 px-1">Nonpolymer Ligands</h3>
                        <div className="space-y-0.5">
                            {ligandComponents
                                .sort((a, b) => a.uniqueKey.localeCompare(b.uniqueKey, undefined, { numeric: true }))
                                .map(comp => <LigandRow key={comp.uniqueKey} component={comp} />)
                            }
                        </div>
                    </div>
                )}

                {/* --- 2D Lattice Section --- */}
                {selectedStructure && (
                    <div className="border-t border-gray-200 pt-3">
                        <ProtofilamentGrid
                            pdbId={selectedStructure}
                            onSubunitHover={onSubunitHover}
                            onSubunitSelect={onSubunitSelect}
                            hoveredSubunitId={hoveredSubunitId}
                            selectedSubunitId={selectedSubunitId}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}