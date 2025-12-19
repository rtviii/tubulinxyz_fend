// src/app/msa-viewer/PositionAnnotationViewer.tsx
'use client';

import { useGetAllAnnotationsAtPositionAnnotationsAllFamilyPositionGetQuery } from '@/store/tubxz_api';
import { useState, useEffect } from 'react';

interface PositionAnnotationViewerProps {
    hoveredPosition: number | null;
    family?: string;
}

const MAX_ITEMS_PER_SECTION = 15;

export function PositionAnnotationViewer({
    hoveredPosition,
    family = 'tubulin_alpha'
}: PositionAnnotationViewerProps) {
    const [queryPosition, setQueryPosition] = useState<number | null>(null);
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

    // Debounce the hovered position
    useEffect(() => {
        if (hoveredPosition === null) {
            return;
        }

        const timer = setTimeout(() => {
            setQueryPosition(hoveredPosition);
            setExpandedSections(new Set()); // Reset expanded when position changes
        }, 150);

        return () => clearTimeout(timer);
    }, [hoveredPosition]);

    const { data, isLoading, isFetching } = useGetAllAnnotationsAtPositionAnnotationsAllFamilyPositionGetQuery(
        { family, position: queryPosition! },
        { skip: !queryPosition || queryPosition < 1 }
    );

    const mutations = data?.mutations || [];
    const interactions = data?.interactions || [];
    const neighborhoods = data?.neighborhoods || [];
    const totalCount = mutations.length + interactions.length + neighborhoods.length;

    const toggleSection = (section: string) => {
        setExpandedSections(prev => {
            const next = new Set(prev);
            if (next.has(section)) {
                next.delete(section);
            } else {
                next.add(section);
            }
            return next;
        });
    };

    if (!queryPosition) {
        return (
            <div className="h-full flex items-center justify-center text-xs text-gray-500 p-3">
                Hover over MSA to view annotations
            </div>
        );
    }

    const renderItems = <T,>(
        items: T[],
        sectionKey: string,
        renderItem: (item: T, index: number) => React.ReactNode
    ) => {
        const isExpanded = expandedSections.has(sectionKey);
        const displayItems = isExpanded ? items : items.slice(0, MAX_ITEMS_PER_SECTION);
        const hasMore = items.length > MAX_ITEMS_PER_SECTION;

        return (
            <>
                {displayItems.map((item, i) => renderItem(item, i))}
                {hasMore && (
                    <button
                        onClick={() => toggleSection(sectionKey)}
                        className="w-full text-center text-[10px] text-blue-600 hover:text-blue-800 py-1"
                    >
                        {isExpanded ? 'Show less' : `+${items.length - MAX_ITEMS_PER_SECTION} more`}
                    </button>
                )}
            </>
        );
    };

    return (
        <div className="h-full flex flex-col text-xs overflow-hidden">
            {/* Header - fixed */}
            <div className="flex-shrink-0 p-2 border-b bg-gray-50 flex justify-between items-center">
                <span className="font-semibold">Position {queryPosition}</span>
                <span className="text-gray-500">
                    {isFetching ? '...' : `${totalCount} total`}
                </span>
            </div>

            {/* Content - scrollable */}
            <div className="flex-1 overflow-y-auto min-h-0">
                <div className="p-2 space-y-3">
                    {isLoading && (
                        <div className="text-center py-4">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mx-auto"></div>
                        </div>
                    )}

                    {/* Mutations */}
                    {mutations.length > 0 && (
                        <div>
                            <div className="font-semibold text-gray-600 mb-1 flex items-center gap-1 sticky top-0 bg-white py-0.5">
                                <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0"></span>
                                <span>Mutations ({mutations.length})</span>
                            </div>
                            <div className="space-y-1">
                                {renderItems(mutations, 'mutations', (mut: any, i) => (
                                    <div key={i} className="p-1.5 bg-red-50 border border-red-200 rounded">
                                        <div className="flex justify-between items-center gap-1">
                                            <span className="font-mono font-bold text-red-700">
                                                {mut.from_residue}{mut.master_index}{mut.to_residue}
                                            </span>
                                            <div className="flex items-center gap-1 text-[10px] text-gray-500 flex-shrink-0">
                                                {mut.rcsb_id && (
                                                    <span className="bg-gray-100 px-1 rounded font-mono">
                                                        {mut.rcsb_id}
                                                    </span>
                                                )}
                                                <span className="truncate max-w-[60px]">{mut.species}</span>
                                            </div>
                                        </div>
                                        {mut.phenotype && (
                                            <div className="text-gray-600 truncate text-[10px]" title={mut.phenotype}>
                                                {mut.phenotype}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Interactions */}
                    {interactions.length > 0 && (
                        <div>
                            <div className="font-semibold text-gray-600 mb-1 flex items-center gap-1 sticky top-0 bg-white py-0.5">
                                <span className="w-2 h-2 rounded-full bg-purple-500 flex-shrink-0"></span>
                                <span>Ligand Interactions ({interactions.length})</span>
                            </div>
                            <div className="space-y-1">
                                {renderItems(interactions, 'interactions', (ix: any, i) => (
                                    <div key={i} className="p-1.5 bg-purple-50 border border-purple-200 rounded">
                                        <div className="flex justify-between items-center gap-1">
                                            <span className="font-mono font-bold text-purple-700">
                                                {ix.ligand_id}
                                            </span>
                                            <div className="flex items-center gap-1 text-[10px] flex-shrink-0">
                                                <span className="bg-gray-100 px-1 rounded font-mono">
                                                    {ix.structure_id}
                                                </span>
                                                <span className="text-gray-500 truncate max-w-[70px]">
                                                    {ix.interaction_type}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="text-gray-500 text-[10px]">
                                            {ix.chain_id}:{ix.residue_comp_id}{ix.residue_auth_seq_id}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Neighborhoods */}
                    {neighborhoods.length > 0 && (
                        <div>
                            <div className="font-semibold text-gray-600 mb-1 flex items-center gap-1 sticky top-0 bg-white py-0.5">
                                <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0"></span>
                                <span>Nearby Ligands ({neighborhoods.length})</span>
                            </div>
                            <div className="space-y-1">
                                {renderItems(neighborhoods, 'neighborhoods', (nb: any, i) => (
                                    <div key={i} className="p-1.5 bg-amber-50 border border-amber-200 rounded">
                                        <div className="flex justify-between items-center gap-1">
                                            <span className="font-mono font-bold text-amber-700">
                                                {nb.ligand_id}
                                            </span>
                                            <span className="text-[10px] bg-gray-100 px-1 rounded font-mono flex-shrink-0">
                                                {nb.structure_id}
                                            </span>
                                        </div>
                                        {nb.ligand_name && (
                                            <div className="text-gray-600 truncate text-[10px]">
                                                {nb.ligand_name}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Empty state */}
                    {!isLoading && totalCount === 0 && (
                        <div className="text-center text-gray-500 py-4">
                            No annotations at position {queryPosition}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}