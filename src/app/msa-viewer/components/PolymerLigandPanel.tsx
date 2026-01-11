// src/app/msa-viewer/components/PolymerLigandPanel.tsx
'use client';

import { useGetPolymerAllAnnotationsAnnotationsPolymerRcsbIdAuthAsymIdAllGetQuery } from '@/store/tubxz_api';
import { MolstarService } from '@/components/molstar/molstar_service';
import { useState, useCallback, useEffect, useRef } from 'react';
import { InteractionInfo } from '@/components/molstar/molstar_controller';

interface PolymerLigandPanelProps {
    rcsb_id: string | null;
    auth_asym_id: string | null;
    molstarService: MolstarService | null;
    onInteractionClick?: (masterIndex: number) => void;
}

export function PolymerLigandPanel({ 
    rcsb_id, 
    auth_asym_id,
    molstarService,
    onInteractionClick 
}: PolymerLigandPanelProps) {
    const interactionsCacheRef = useRef<Map<string, InteractionInfo[]>>(new Map());
    const [availableLigands, setAvailableLigands] = useState<string[]>([]);

    const { data, isLoading, isFetching } = useGetPolymerAllAnnotationsAnnotationsPolymerRcsbIdAuthAsymIdAllGetQuery(
        { rcsbId: rcsb_id!, authAsymId: auth_asym_id! },
        { skip: !rcsb_id || !auth_asym_id }
    );

    // Get available ligands when polymer changes
    useEffect(() => {
        interactionsCacheRef.current.clear();
        if (rcsb_id && molstarService?.controller) {
            const ligands = molstarService.controller.listAvailableLigands(rcsb_id);
            setAvailableLigands(ligands);
        }
    }, [rcsb_id, auth_asym_id, molstarService]);

    const interactions = data?.interactions || [];
    const neighborhoods = data?.neighborhoods || [];
    const mutations = data?.mutations || [];

    // Group interactions by ligand - include ligand_auth_seq_id in key
    const interactionsByLigand = interactions.reduce((acc: Record<string, any[]>, ix: any) => {
        const key = `${ix.ligand_id}_${ix.ligand_chain || ''}_${ix.ligand_auth_seq_id || ''}`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(ix);
        return acc;
    }, {});

    // Check if a ligand is available in Molstar
    const isLigandAvailable = useCallback((ligandId: string, ligandChain: string, ligandSeqId?: number): boolean => {
        if (!ligandSeqId) {
            // Try to find from neighborhoods
            const nb = neighborhoods.find((n: any) => n.ligand_id === ligandId && n.ligand_chain === ligandChain);
            ligandSeqId = nb?.ligand_auth_seq_id;
        }
        if (!ligandSeqId) return false;
        
        const uniqueKey = `${ligandId}_${ligandChain}_${ligandSeqId}`;
        return availableLigands.includes(uniqueKey);
    }, [availableLigands, neighborhoods]);

    // Build unique key
    const buildLigandUniqueKey = useCallback((ligandId: string, ligandChain: string, ligandSeqId?: number): string | null => {
        if (ligandSeqId) {
            const key = `${ligandId}_${ligandChain}_${ligandSeqId}`;
            if (availableLigands.includes(key)) return key;
        }
        
        // Try to find from neighborhoods
        const nb = neighborhoods.find((n: any) => n.ligand_id === ligandId && n.ligand_chain === ligandChain);
        if (nb?.ligand_auth_seq_id) {
            const key = `${ligandId}_${ligandChain}_${nb.ligand_auth_seq_id}`;
            if (availableLigands.includes(key)) return key;
        }
        
        return null;
    }, [availableLigands, neighborhoods]);

    // Compute interactions for a ligand
    const ensureInteractionsComputed = useCallback(async (uniqueKey: string): Promise<InteractionInfo[]> => {
        if (!molstarService?.controller || !rcsb_id || !uniqueKey) return [];
        if (!availableLigands.includes(uniqueKey)) {
            console.warn(`[Interactions] Ligand ${uniqueKey} not available in Molstar`);
            return [];
        }

        if (interactionsCacheRef.current.has(uniqueKey)) {
            return interactionsCacheRef.current.get(uniqueKey)!;
        }

        try {
            const ixList = await molstarService.controller.getOrComputeLigandInteractions(rcsb_id, uniqueKey);
            interactionsCacheRef.current.set(uniqueKey, ixList);
            return ixList;
        } catch (e) {
            console.warn('Failed to compute interactions:', e);
            return [];
        }
    }, [molstarService, rcsb_id, availableLigands]);

    // Handle ligand hover
    const handleLigandHover = useCallback(async (
        ligandId: string, 
        ligandChain: string, 
        ligandSeqId: number | undefined,
        isHovering: boolean
    ) => {
        if (!molstarService?.controller || !rcsb_id) return;

        const uniqueKey = buildLigandUniqueKey(ligandId, ligandChain, ligandSeqId);
        
        if (isHovering && uniqueKey) {
            molstarService.controller.highlightNonPolymer(rcsb_id, uniqueKey, true);
            ensureInteractionsComputed(uniqueKey);
        } else {
            molstarService.controller.highlightNonPolymer(rcsb_id, '', false);
        }
    }, [molstarService, rcsb_id, buildLigandUniqueKey, ensureInteractionsComputed]);

    // Handle ligand click
    const handleLigandClick = useCallback(async (
        ligandId: string, 
        ligandChain: string,
        ligandSeqId?: number
    ) => {
        if (!molstarService?.controller || !rcsb_id) return;
        
        const uniqueKey = buildLigandUniqueKey(ligandId, ligandChain, ligandSeqId);
        if (uniqueKey) {
            molstarService.controller.focusNonPolymer(rcsb_id, uniqueKey);
            ensureInteractionsComputed(uniqueKey);
        } else {
            console.warn(`[Click] Ligand ${ligandId}_${ligandChain} not available`);
        }
    }, [molstarService, rcsb_id, buildLigandUniqueKey, ensureInteractionsComputed]);

    // Handle interaction row hover - highlight BOTH residue AND ligand
    const handleInteractionHover = useCallback(async (
        ix: any, 
        ligandId: string,
        ligandChain: string,
        ligandSeqId: number | undefined,
        isHovering: boolean
    ) => {
        if (!molstarService?.controller || !rcsb_id) return;

        if (!isHovering) {
            molstarService.controller.highlightInteraction(undefined, false);
            return;
        }

        const uniqueKey = buildLigandUniqueKey(ligandId, ligandChain, ligandSeqId);
        
        if (!uniqueKey) {
            // Ligand not in Molstar - just highlight the residue as fallback
            console.log(`[Hover] Ligand not available, highlighting residue ${ix.residue_auth_seq_id}`);
            molstarService.controller.hoverResidue(rcsb_id, auth_asym_id!, ix.residue_auth_seq_id, true);
            return;
        }

        const computedIx = await ensureInteractionsComputed(uniqueKey);
        
        if (computedIx.length === 0) {
            // No computed interactions - highlight residue
            molstarService.controller.hoverResidue(rcsb_id, auth_asym_id!, ix.residue_auth_seq_id, true);
            return;
        }

        // Find matching interaction - must involve BOTH the ligand AND the target residue
        const seqId = ix.residue_auth_seq_id;
        const atomId = ix.atom_id;
        
        // Look for interaction where:
        // - One partner is the ligand (contains ligandId)
        // - Other partner is the residue (contains chainId.seqId:atomId)
        const matchingInteraction = computedIx.find(computed => {
            const labelA = computed.partnerA.label;
            const labelB = computed.partnerB.label;
            
            // Check if one side is the ligand
            const aIsLigand = labelA.includes(`[${ligandId}]`);
            const bIsLigand = labelB.includes(`[${ligandId}]`);
            
            if (!aIsLigand && !bIsLigand) return false; // Neither is our ligand
            
            // Check if other side matches our residue
            const residuePattern = `${auth_asym_id}.${seqId}:${atomId}`;
            const aIsResidue = labelA.includes(residuePattern);
            const bIsResidue = labelB.includes(residuePattern);
            
            // One must be ligand, other must be residue
            return (aIsLigand && bIsResidue) || (bIsLigand && aIsResidue);
        });

        if (matchingInteraction) {
            console.log(`[Hover] Match: ${matchingInteraction.partnerA.label} <-> ${matchingInteraction.partnerB.label}`);
            molstarService.controller.highlightInteraction(matchingInteraction, true);
        } else {
            // Try looser match - just seqId without atom specificity
            const looseMatch = computedIx.find(computed => {
                const labelA = computed.partnerA.label;
                const labelB = computed.partnerB.label;
                
                const aIsLigand = labelA.includes(`[${ligandId}]`);
                const bIsLigand = labelB.includes(`[${ligandId}]`);
                
                if (!aIsLigand && !bIsLigand) return false;
                
                const residueLoosePattern = `${auth_asym_id}.${seqId}:`;
                const aIsResidue = labelA.includes(residueLoosePattern);
                const bIsResidue = labelB.includes(residueLoosePattern);
                
                return (aIsLigand && bIsResidue) || (bIsLigand && aIsResidue);
            });

            if (looseMatch) {
                console.log(`[Hover] Loose match: ${looseMatch.partnerA.label} <-> ${looseMatch.partnerB.label}`);
                molstarService.controller.highlightInteraction(looseMatch, true);
            } else {
                console.log(`[Hover] No ligand-residue match, highlighting residue`);
                molstarService.controller.hoverResidue(rcsb_id, auth_asym_id!, seqId, true);
            }
        }
    }, [molstarService, rcsb_id, auth_asym_id, buildLigandUniqueKey, ensureInteractionsComputed]);

    // Handle interaction click
    const handleInteractionClick = useCallback((ix: any) => {
        if (ix.master_index) {
            onInteractionClick?.(ix.master_index);
        }
        if (molstarService?.controller && rcsb_id && auth_asym_id) {
            molstarService.controller.focusOnResidues(
                rcsb_id, 
                auth_asym_id, 
                ix.residue_auth_seq_id, 
                ix.residue_auth_seq_id
            );
        }
    }, [molstarService, rcsb_id, auth_asym_id, onInteractionClick]);

    if (!rcsb_id || !auth_asym_id) {
        return (
            <div className="h-full flex items-center justify-center text-xs text-gray-500">
                Select a chain to view ligand data
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col text-xs overflow-hidden">
            {/* Header */}
            <div className="flex-shrink-0 p-2 border-b bg-gray-50">
                <div className="font-semibold text-gray-800">
                    {rcsb_id}:{auth_asym_id} Ligand Data
                </div>
                <div className="text-[10px] text-gray-500">
                    {isFetching ? 'Loading...' : `${interactions.length} interactions, ${neighborhoods.length} nearby`}
                    {availableLigands.length > 0 && (
                        <span className="ml-1">({availableLigands.length} in viewer)</span>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto min-h-0">
                <div className="p-2 space-y-3">
                    {isLoading && (
                        <div className="flex items-center justify-center py-4">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                        </div>
                    )}

                    {/* Neighborhoods */}
                    {neighborhoods.length > 0 && (
                        <div>
                            <div className="font-semibold text-gray-700 mb-1.5 pb-1 border-b">
                                Nearby Ligands ({neighborhoods.length})
                            </div>
                            <div className="space-y-1.5">
                                {neighborhoods.map((nb: any, i: number) => {
                                    const available = isLigandAvailable(nb.ligand_id, nb.ligand_chain, nb.ligand_auth_seq_id);
                                    return (
                                        <div 
                                            key={i} 
                                            className={`p-2 rounded border transition-colors ${
                                                available 
                                                    ? 'bg-amber-50 border-amber-200 cursor-pointer hover:bg-amber-100' 
                                                    : 'bg-gray-50 border-gray-200 opacity-60'
                                            }`}
                                            onMouseEnter={() => available && handleLigandHover(nb.ligand_id, nb.ligand_chain, nb.ligand_auth_seq_id, true)}
                                            onMouseLeave={() => available && handleLigandHover(nb.ligand_id, nb.ligand_chain, nb.ligand_auth_seq_id, false)}
                                            onClick={() => available && handleLigandClick(nb.ligand_id, nb.ligand_chain, nb.ligand_auth_seq_id)}
                                        >
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <span className={`font-mono font-bold ${available ? 'text-amber-800' : 'text-gray-500'}`}>
                                                        {nb.ligand_id}
                                                    </span>
                                                    <span className="text-gray-500 ml-1">({nb.ligand_chain})</span>
                                                    {!available && (
                                                        <span className="text-[9px] text-gray-400 ml-1">(not in viewer)</span>
                                                    )}
                                                </div>
                                                {nb.drugbank_id && (
                                                    <span className="text-[10px] bg-green-100 text-green-700 px-1 rounded">DrugBank</span>
                                                )}
                                            </div>
                                            {nb.ligand_name && (
                                                <div className="text-gray-600 text-[10px] mt-0.5 truncate">{nb.ligand_name}</div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Interactions by ligand */}
                    {Object.keys(interactionsByLigand).length > 0 && (
                        <div>
                            <div className="font-semibold text-gray-700 mb-1.5 pb-1 border-b">
                                Specific Interactions ({interactions.length})
                            </div>
                            <div className="space-y-2">
                                {Object.entries(interactionsByLigand).map(([ligandKey, ixList]) => {
                                    const parts = ligandKey.split('_');
                                    const ligandId = parts[0];
                                    const ligandChain = parts[1] || '';
                                    const ligandSeqId = parts[2] ? parseInt(parts[2]) : undefined;
                                    const available = isLigandAvailable(ligandId, ligandChain, ligandSeqId);

                                    return (
                                        <div 
                                            key={ligandKey} 
                                            className={`p-2 rounded border ${
                                                available 
                                                    ? 'bg-purple-50 border-purple-200' 
                                                    : 'bg-gray-50 border-gray-200 opacity-60'
                                            }`}
                                        >
                                            <div 
                                                className={`font-mono font-bold mb-1 ${
                                                    available ? 'text-purple-800 cursor-pointer hover:underline' : 'text-gray-500'
                                                }`}
                                                onMouseEnter={() => available && handleLigandHover(ligandId, ligandChain, ligandSeqId, true)}
                                                onMouseLeave={() => available && handleLigandHover(ligandId, ligandChain, ligandSeqId, false)}
                                                onClick={() => available && handleLigandClick(ligandId, ligandChain, ligandSeqId)}
                                            >
                                                {ligandId}
                                                {ligandChain && <span className="text-gray-500 font-normal ml-1">({ligandChain})</span>}
                                                <span className="font-normal text-gray-500 ml-1">({(ixList as any[]).length})</span>
                                                {!available && <span className="text-[9px] text-gray-400 ml-1">(not in viewer)</span>}
                                            </div>
                                            <div className="space-y-0.5">
                                                {(ixList as any[]).slice(0, 12).map((ix: any, j: number) => (
                                                    <div 
                                                        key={j} 
                                                        className={`flex justify-between text-[10px] px-1 py-0.5 rounded transition-colors ${
                                                            available ? 'hover:bg-purple-100 cursor-pointer' : ''
                                                        }`}
                                                        onMouseEnter={() => available && handleInteractionHover(ix, ligandId, ligandChain, ligandSeqId, true)}
                                                        onMouseLeave={() => available && handleInteractionHover(ix, ligandId, ligandChain, ligandSeqId, false)}
                                                        onClick={() => handleInteractionClick(ix)}
                                                    >
                                                        <span className="text-gray-700 font-mono">
                                                            {ix.residue_comp_id}{ix.residue_auth_seq_id}:{ix.atom_id}
                                                        </span>
                                                        <span className="text-gray-500">
                                                            {ix.interaction_type}
                                                            {ix.master_index && (
                                                                <span className="ml-1 text-purple-600 font-medium">@{ix.master_index}</span>
                                                            )}
                                                        </span>
                                                    </div>
                                                ))}
                                                {(ixList as any[]).length > 12 && (
                                                    <div className="text-[10px] text-gray-400 text-center">
                                                        +{(ixList as any[]).length - 12} more
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Mutations */}
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
                                        title={mut.phenotype}
                                    >
                                        {mut.from_residue}{mut.master_index}{mut.to_residue}
                                    </span>
                                ))}
                                {mutations.length > 20 && <span className="text-[10px] text-gray-400">+{mutations.length - 20}</span>}
                            </div>
                        </div>
                    )}

                    {!isLoading && interactions.length === 0 && neighborhoods.length === 0 && mutations.length === 0 && (
                        <div className="text-center text-gray-500 py-4">No ligand data for this chain</div>
                    )}
                </div>
            </div>
        </div>
    );
}