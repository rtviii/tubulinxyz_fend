'use client';
import React, { useState, useCallback } from 'react';
import { useAppSelector, useAppDispatch } from '@/store/store';
import { PolymerComponent, LigandComponent, selectComponentsForStructure } from '@/store/slices/molstar_refs';
import { selectPolymerState } from '@/store/slices/polymer_states';
import { selectNonPolymerState } from '@/store/slices/nonpolymer_states';
import { setSelectedSequence } from '@/store/slices/sequence_viewer';
import { MolstarContext } from '@/components/molstar/molstar_service';
import { Eye, EyeOff, Focus, FileText, Search } from 'lucide-react';
import { ProtofilamentGrid, SubunitData } from './protofilament_grid';
import { InteractionInfo } from '@/components/molstar/molstar_controller';

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

const LigandRow = ({ component, onAnalyze }: { component: LigandComponent, onAnalyze: (c: LigandComponent) => void }) => {
    const molstarService = React.useContext(MolstarContext)?.getService('main');
    const nonPolymerState = useAppSelector(state => selectNonPolymerState(state, { pdbId: component.pdbId, chemId: component.uniqueKey }));

    if (!molstarService || !nonPolymerState) return null;
    const { controller } = molstarService;

    const handleAnalyzeClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onAnalyze(component);
    };

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
                <button onClick={handleAnalyzeClick} className="p-0.5 text-gray-400 hover:text-teal-600" title="Analyze Interactions">
                    <Search size={14} />
                </button>
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

const LigandInteractionPanel = ({ ligand, data, onFocus, onHover, onLeave, isLoading }: {
    ligand: LigandComponent;
    data: InteractionInfo[];
    onFocus: (interaction: InteractionInfo) => void;
    onHover: (interaction: InteractionInfo) => void;
    onLeave: () => void;
    isLoading: boolean;
}) => {
    return (
        <div className="bg-gray-100 p-2 rounded-md my-1 text-xs">
            <h4 className="font-bold mb-2 text-gray-700">Analysis: {ligand.uniqueKey}</h4>
            {isLoading ? (<p>...</p>) : data.length > 0 ? (
                <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                    {data.map((interaction, index) => (
                        <div
                            key={index}
                            onClick={() => onFocus(interaction)}
                            onMouseEnter={() => onHover(interaction)}
                            onMouseLeave={onLeave}
                            className="p-1 bg-white rounded hover:bg-blue-50 cursor-pointer"
                        >
                            <span className="font-semibold text-blue-700">{interaction.type}: </span>
                            <span>{interaction.partnerA.label}</span>
                            <span className="mx-1.5 text-gray-400">&harr;</span>
                            <span>{interaction.partnerB.label}</span>
                        </div>
                    ))}
                </div>
            ) : (<p>...</p>)}
        </div>
    );
};

export const EntitiesPanel = ({ onSubunitHover, onSubunitSelect, hoveredSubunitId, selectedSubunitId }: {
    onSubunitHover: (subunit: SubunitData | null) => void;
    onSubunitSelect: (subunit: SubunitData) => void;
    hoveredSubunitId: string | null;
    selectedSubunitId: string | null;
}) => {
    // Use molstarRefs.currentStructure instead of tubulin_structures
    const currentStructure = useAppSelector(state => state.molstarRefs.currentStructure);
    const components = useAppSelector(state => selectComponentsForStructure(state, currentStructure || ''));
    const molstarService = React.useContext(MolstarContext)?.getService('main');

    const [analyzedLigand, setAnalyzedLigand] = useState<LigandComponent | null>(null);
    const [interactionData, setInteractionData] = useState<InteractionInfo[]>([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const polymerComponents = (components?.filter(c => c.type === 'polymer') as PolymerComponent[]) || [];
    const ligandComponents = (components?.filter(c => c.type === 'ligand') as LigandComponent[]) || [];

    const handleAnalyzeLigand = useCallback(async (ligand: LigandComponent) => {
        if (!molstarService) return;

        if (analyzedLigand?.uniqueKey === ligand.uniqueKey) {
            await molstarService.controller.clearLigandFocus();
            setAnalyzedLigand(null);
            setInteractionData([]);
            return;
        }

        setIsAnalyzing(true);
        setInteractionData([]);
        setAnalyzedLigand(ligand);
        const data = await molstarService.controller.focusLigandAndGetInteractions(ligand);
        if (data) {
            setInteractionData(data);
        }
        setIsAnalyzing(false);
    }, [molstarService, analyzedLigand]);

    const handleFocusInteraction = useCallback((interaction: InteractionInfo) => {
        molstarService?.controller.focusOnInteraction(interaction.partnerA.loci, interaction.partnerB.loci);
    }, [molstarService]);

    const handleInteractionHover = useCallback((interaction: InteractionInfo) => {
        molstarService?.controller.highlightInteraction(interaction, true);
    }, [molstarService]);

    const handleInteractionMouseLeave = useCallback(() => {
        molstarService?.controller.highlightInteraction(undefined, false);
    }, [molstarService]);

    return (
        <div className="w-64 h-full bg-gray-50 border-l border-gray-200 flex flex-col">
            <div className="flex-1 overflow-y-auto p-2 space-y-4">
                <div>
                    <h3 className="text-sm font-semibold text-gray-800 mb-1 px-1">Polymer Chains</h3>
                    <div className="space-y-0.5">
                        {!currentStructure ? (
                            <p className="text-xs text-gray-500 px-1">No structure loaded.</p>
                        ) : polymerComponents.length > 0 ? (
                            polymerComponents.sort((a, b) => a.chainId.localeCompare(b.chainId, undefined, { numeric: true }))
                                .map(comp => <PolymerRow key={comp.chainId} component={comp} />)
                        ) : (
                            <p className="text-xs text-gray-500 px-1">Loading chains...</p>
                        )}
                    </div>
                </div>

                {ligandComponents.length > 0 && (
                    <div className="border-t border-gray-200 pt-3">
                        <h3 className="text-sm font-semibold text-gray-800 mb-1 px-1">Nonpolymer Ligands</h3>
                        <div className="space-y-0.5">
                            {ligandComponents
                                .sort((a, b) => a.uniqueKey.localeCompare(b.uniqueKey, undefined, { numeric: true }))
                                .map(comp => (
                                    <React.Fragment key={comp.uniqueKey}>
                                        <LigandRow component={comp} onAnalyze={handleAnalyzeLigand} />
                                        {analyzedLigand?.uniqueKey === comp.uniqueKey && (
                                            <LigandInteractionPanel
                                                ligand={analyzedLigand}
                                                data={interactionData}
                                                onFocus={handleFocusInteraction}
                                                onHover={handleInteractionHover}
                                                onLeave={handleInteractionMouseLeave}
                                                isLoading={isAnalyzing}
                                            />
                                        )}
                                    </React.Fragment>
                                ))}
                        </div>
                    </div>
                )}

                {currentStructure && (
                    <div className="border-t border-gray-200 pt-3">
                        <ProtofilamentGrid
                            pdbId={currentStructure}
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
};