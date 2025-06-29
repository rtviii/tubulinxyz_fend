'use client';
import React from 'react';
import { useAppSelector } from '@/store/store';
import { selectSelectedStructure } from '@/store/slices/tubulin_structures';
import { PolymerComponent, selectComponentsForStructure } from '@/store/slices/molstar_refs';
import { selectPolymerState } from '@/store/slices/polymer_states';
import { MolstarContext } from '@/components/molstar/molstar_service';
import { Eye, EyeOff, Focus } from 'lucide-react';

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

    const focusChain = (e: React.MouseEvent) => {
        e.stopPropagation();
        controller.focusChain(component.pdbId, component.chainId);
    };

    return (
        <div
            className={`flex items-center justify-between py-0.5 px-2 rounded-sm transition-colors cursor-pointer ${polymerState.hovered ? 'bg-blue-100' : 'hover:bg-gray-100'}`}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={focusChain}
        >
            <div className="flex items-center space-x-2">
                {/* This color swatch can be tied to the preset color later if needed */}
                <div className="w-2 h-2 bg-gray-300 rounded-sm flex-shrink-0"></div>
                <span className="font-mono text-xs select-none">{component.chainId}</span>
            </div>
            <div className="flex items-center">
                <button onClick={focusChain} className="p-0.5 text-gray-400 hover:text-gray-800" title="Focus Chain">
                    <Focus size={14} />
                </button>
                <button onClick={toggleVisibility} className="p-0.5 text-gray-400 hover:text-gray-800" title="Toggle Visibility">
                    {polymerState.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
            </div>
        </div>
    );
};

export const ChainPanel = () => {
    const selectedStructure = useAppSelector(selectSelectedStructure);
    const components = useAppSelector(state => selectComponentsForStructure(state, selectedStructure || ''));

    const polymerComponents = (components?.filter(c => c.type === 'polymer') as PolymerComponent[]) || [];

    return (
        <div className="w-48 h-full bg-gray-50 border-l border-gray-200 p-2 flex flex-col">
            <h3 className="text-md font-semibold text-gray-800 mb-2 px-1 flex-shrink-0">Polymer Chains</h3>
            <div className="space-y-0.5 flex-grow overflow-y-auto pr-1">
                {!selectedStructure ? (
                    <p className="text-xs text-gray-500 mt-2 px-1">No structure loaded.</p>
                ) : polymerComponents.length > 0 ? (
                    // Sorts chains naturally (e.g., A, B, ... Z, AA, AB...)
                    polymerComponents.sort((a, b) => a.chainId.localeCompare(b.chainId, undefined, { numeric: true }))
                        .map(comp => <ChainRow key={comp.chainId} component={comp} />)
                ) : (
                    <p className="text-xs text-gray-500 mt-2 px-1">Loading chains...</p>
                )}
            </div>
        </div>
    );
};;