// src/app/msa-viewer/components/PolymerLigandPanel.tsx
'use client';

import { useGetPolymerAllAnnotationsAnnotationsPolymerRcsbIdAuthAsymIdAllGetQuery } from '@/store/tubxz_api';

interface PolymerLigandPanelProps {
    rcsb_id: string | null;
    auth_asym_id: string | null;
    onInteractionClick?: (masterIndex: number) => void;
}

export function PolymerLigandPanel({ 
    rcsb_id, 
    auth_asym_id,
    onInteractionClick 
}: PolymerLigandPanelProps) {
    const { data, isLoading, isFetching } = useGetPolymerAllAnnotationsAnnotationsPolymerRcsbIdAuthAsymIdAllGetQuery(
        { rcsbId: rcsb_id!, authAsymId: auth_asym_id! },
        { skip: !rcsb_id || !auth_asym_id }
    );

    if (!rcsb_id || !auth_asym_id) {
        return (
            <div className="h-full flex items-center justify-center text-xs text-gray-500">
                Select a chain to view ligand data
            </div>
        );
    }

    const interactions = data?.interactions || [];
    const neighborhoods = data?.neighborhoods || [];
    const mutations = data?.mutations || [];

    // Group interactions by ligand
    const interactionsByLigand = interactions.reduce((acc: Record<string, any[]>, ix: any) => {
        const key = ix.ligand_id;
        if (!acc[key]) acc[key] = [];
        acc[key].push(ix);
        return acc;
    }, {});

    return (
        <div className="h-full flex flex-col text-xs">
            {/* Header */}
            <div className="p-2 border-b bg-gray-50">
                <div className="font-semibold text-gray-800">
                    {rcsb_id}:{auth_asym_id} Ligand Data
                </div>
                <div className="text-[10px] text-gray-500">
                    {isFetching ? 'Loading...' : `${interactions.length} interactions, ${neighborhoods.length} nearby ligands`}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-2 space-y-3">
                {isLoading && (
                    <div className="flex items-center justify-center py-4">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                    </div>
                )}

                {/* Neighborhoods - Ligands near this chain */}
                {neighborhoods.length > 0 && (
                    <div>
                        <div className="font-semibold text-gray-700 mb-1.5 pb-1 border-b">
                            Nearby Ligands ({neighborhoods.length})
                        </div>
                        <div className="space-y-1.5">
                            {neighborhoods.map((nb: any, i: number) => (
                                <div key={i} className="p-2 bg-amber-50 border border-amber-200 rounded">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <span className="font-mono font-bold text-amber-800">
                                                {nb.ligand_id}
                                            </span>
                                            <span className="text-gray-500 ml-1">
                                                ({nb.ligand_chain})
                                            </span>
                                        </div>
                                        {nb.drugbank_id && (
                                            <span className="text-[10px] bg-green-100 text-green-700 px-1 rounded">
                                                DrugBank
                                            </span>
                                        )}
                                    </div>
                                    {nb.ligand_name && (
                                        <div className="text-gray-600 text-[10px] mt-0.5 truncate">
                                            {nb.ligand_name}
                                        </div>
                                    )}
                                    {nb.nearby_residues && nb.nearby_residues.length > 0 && (
                                        <div className="mt-1 text-[10px] text-gray-500">
                                            <span className="font-medium">Residues: </span>
                                            {nb.nearby_residues.slice(0, 8).join(', ')}
                                            {nb.nearby_residues.length > 8 && ` +${nb.nearby_residues.length - 8} more`}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Interactions grouped by ligand */}
                {Object.keys(interactionsByLigand).length > 0 && (
                    <div>
                        <div className="font-semibold text-gray-700 mb-1.5 pb-1 border-b">
                            Specific Interactions ({interactions.length})
                        </div>
                        <div className="space-y-2">
                            {Object.entries(interactionsByLigand).map(([ligandId, ixList]) => (
                                <div key={ligandId} className="p-2 bg-purple-50 border border-purple-200 rounded">
                                    <div className="font-mono font-bold text-purple-800 mb-1">
                                        {ligandId}
                                        <span className="font-normal text-gray-500 ml-1">
                                            ({(ixList as any[]).length} contacts)
                                        </span>
                                    </div>
                                    <div className="space-y-0.5">
                                        {(ixList as any[]).slice(0, 10).map((ix: any, j: number) => (
                                            <div 
                                                key={j} 
                                                className="flex justify-between text-[10px] hover:bg-purple-100 px-1 rounded cursor-pointer"
                                                onClick={() => ix.master_index && onInteractionClick?.(ix.master_index)}
                                            >
                                                <span className="text-gray-700">
                                                    {ix.residue_comp_id}{ix.residue_auth_seq_id}:{ix.atom_id}
                                                </span>
                                                <span className="text-gray-500">
                                                    {ix.interaction_type}
                                                    {ix.master_index && <span className="ml-1 text-purple-600">@{ix.master_index}</span>}
                                                </span>
                                            </div>
                                        ))}
                                        {(ixList as any[]).length > 10 && (
                                            <div className="text-[10px] text-gray-400 text-center">
                                                +{(ixList as any[]).length - 10} more
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Mutations summary */}
                {mutations.length > 0 && (
                    <div>
                        <div className="font-semibold text-gray-700 mb-1.5 pb-1 border-b">
                            Known Mutations ({mutations.length})
                        </div>
                        <div className="flex flex-wrap gap-1">
                            {mutations.slice(0, 20).map((mut: any, i: number) => (
                                <span 
                                    key={i}
                                    className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded font-mono text-[10px] cursor-pointer hover:bg-red-200"
                                    onClick={() => onInteractionClick?.(mut.master_index)}
                                    title={mut.phenotype || `${mut.from_residue}→${mut.to_residue}`}
                                >
                                    {mut.from_residue}{mut.master_index}{mut.to_residue}
                                </span>
                            ))}
                            {mutations.length > 20 && (
                                <span className="text-[10px] text-gray-400">+{mutations.length - 20} more</span>
                            )}
                        </div>
                    </div>
                )}

                {/* Empty state */}
                {!isLoading && interactions.length === 0 && neighborhoods.length === 0 && mutations.length === 0 && (
                    <div className="text-center text-gray-500 py-4">
                        No ligand data for this chain
                    </div>
                )}
            </div>
        </div>
    );
}