// src/components/non_polymer_panel.tsx
'use client';
import React from 'react';
import { useAppSelector } from '@/store/store';
import { LigandComponent, selectComponentsForStructure } from '@/store/slices/molstar_refs';
import { selectNonPolymerState } from '@/store/slices/nonpolymer_states';
import { MolstarContext } from '@/components/molstar/molstar_service';
import { Eye, EyeOff, Focus } from 'lucide-react';
import { selectSelectedStructure } from '@/store/slices/tubulin_structures';

const NonPolymerRow = ({ component }: { component: LigandComponent }) => {
    const molstarService = React.useContext(MolstarContext)?.getService('main');
    // The selector needs to be updated to use the uniqueKey
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
                {/* Display more informative text */}
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

export const NonPolymerPanel = () => {
    const selectedStructure = useAppSelector(selectSelectedStructure);
    const components = useAppSelector(state => selectComponentsForStructure(state, selectedStructure || ''));
 const nonPolymerComponents = (components?.filter(c => c.type === 'ligand') as LigandComponent[]) || [];


    return (
        <div className="w-48 h-full bg-gray-50 border-l border-gray-200 p-2 flex flex-col">
            <h3 className="text-md font-semibold text-gray-800 mb-2 px-1 flex-shrink-0">Ligands</h3>

            <div className="space-y-0.5 flex-grow overflow-y-auto pr-1">
                  {nonPolymerComponents.length > 0 ? (
                    nonPolymerComponents
                        .sort((a, b) => a.uniqueKey.localeCompare(b.uniqueKey, undefined, { numeric: true }))
                        // Use the uniqueKey for the React key prop
                        .map(comp => <NonPolymerRow key={comp.uniqueKey} component={comp} />)
                ) :  (
                    <p className="text-xs text-gray-500 mt-2 px-1">No ligands found.</p>
                )}
            </div>
        </div>
    );
}