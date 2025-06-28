'use client';
import React from 'react';
import { useAppSelector } from '@/store/store';
import { selectSelectedStructure } from '@/store/slices/tubulin_structures';
import { PolymerComponent, selectComponentsForStructure } from '@/store/slices/molstar_refs';
import { selectPolymerState } from '@/store/slices/polymer_states';
import { MolstarContext } from '@/components/molstar/molstar_service';
import { Eye, EyeOff } from 'lucide-react';

const ChainRow = ({ component }: { component: PolymerComponent }) => {
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

    return (
        <div
            className={`flex items-center justify-between p-2 rounded-md transition-colors ${polymerState.hovered ? 'bg-blue-100' : 'hover:bg-gray-100'}`}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-gray-300 rounded-sm"></div> {/* Placeholder for color swatch */}
                <span className="font-mono text-sm">{component.chainId}</span>
            </div>
            <button onClick={toggleVisibility} className="p-1 text-gray-500 hover:text-gray-800">
                {polymerState.visible ? <Eye size={16} /> : <EyeOff size={16} />}
            </button>
        </div>
    );
};

export const ChainPanel = () => {
    const selectedStructure = useAppSelector(selectSelectedStructure);
    const components = useAppSelector(state => selectComponentsForStructure(state, selectedStructure || ''));

    const polymerComponents = (components?.filter(c => c.type === 'polymer') as PolymerComponent[]) || [];

    return (
        <div className="w-64 h-full bg-gray-50 border-l border-gray-200 p-3 overflow-y-auto flex flex-col">
            <h3 className="text-md font-semibold text-gray-800 mb-3 px-1">Polymer Chains</h3>
            <div className="space-y-1 flex-grow">
                {!selectedStructure ? (
                    <p className="text-sm text-gray-500 mt-2 px-1">Load a structure to see its chains.</p>
                ) : polymerComponents.length > 0 ? (
                    polymerComponents.sort((a, b) => a.chainId.localeCompare(b.chainId)).map(comp => <ChainRow key={comp.chainId} component={comp} />)
                ) : (
                    <p className="text-sm text-gray-500 mt-2 px-1">Loading chains...</p>
                )}
            </div>
        </div>
    );
};