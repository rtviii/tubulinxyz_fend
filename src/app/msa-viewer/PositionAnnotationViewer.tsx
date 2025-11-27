// src/app/msa-viewer/PositionAnnotationViewer.tsx
'use client';

import { useGetAllAnnotationsAtPositionAnnotationsAllFamilyVersionPositionGetQuery } from '@/store/tubxz_api';
import { useState, useEffect } from 'react';

interface PositionAnnotationViewerProps {
    hoveredPosition: number | null; // MA position from MSA hover
}

export function PositionAnnotationViewer({ hoveredPosition }: PositionAnnotationViewerProps) {
    const [queryPosition, setQueryPosition] = useState<number | null>(null);
    const family = 'alpha';
    const version = 'v1.0';

    // Debounce the hovered position
    useEffect(() => {
        if (hoveredPosition === null) {
            return;
        }

        const timer = setTimeout(() => {
            setQueryPosition(hoveredPosition);
        }, 150); 

        return () => clearTimeout(timer);
    }, [hoveredPosition]);

    const { data, isLoading } =
        useGetAllAnnotationsAtPositionAnnotationsAllFamilyVersionPositionGetQuery(
            { family, version, position: queryPosition || 1 },
            { skip: !queryPosition || queryPosition < 1 }
        );

    const mutations = data?.mutations || [];
    const modifications = data?.modifications || [];
    const totalCount = mutations.length + modifications.length;

    if (!queryPosition) {
        return (
            <div className="text-xs text-gray-500 p-2 text-center">
                Hover over MSA to view annotations
            </div>
        );
    }

    if (isLoading) {
        return <div className="text-xs p-2">Loading position {queryPosition}...</div>;
    }

    return (
        <div className="text-xs">
            <div className="p-2 border-b bg-gray-50 sticky top-0 z-10">
                <div className="flex justify-between items-center">
                    <span className="font-semibold">Position {queryPosition}</span>
                    <span className="text-gray-500">
                        {totalCount} annotation{totalCount !== 1 ? 's' : ''}
                    </span>
                </div>
            </div>

            <div className="overflow-y-auto" style={{ maxHeight: 'calc(40vh - 80px)' }}>
                {mutations.length > 0 && (
                    <div className="p-2">
                        <div className="font-semibold mb-1 text-gray-700">Mutations ({mutations.length})</div>
                        {mutations.map((mut: any, i: number) => (
                            <div key={i} className="mb-1 p-1.5 bg-red-50 border border-red-200 rounded text-xs">
                                <div className="font-mono font-bold text-red-700 text-xs">
                                    {mut.from_residue} → {mut.to_residue}
                                </div>
                                <div className="text-xs leading-tight">{mut.phenotype}</div>
                                <div className="text-xs text-gray-500 mt-0.5">
                                    {mut.species} | {mut.tubulin_type}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {modifications.length > 0 && (
                    <div className="p-2">
                        <div className="font-semibold mb-1 text-gray-700">Modifications ({modifications.length})</div>
                        {modifications.map((mod: any, i: number) => (
                            <div key={i} className="mb-1 p-1.5 bg-blue-50 border border-blue-200 rounded text-xs">
                                <div className="font-mono font-bold text-blue-700 text-xs">
                                    {mod.amino_acid} - {mod.modification_type}
                                </div>
                                <div className="text-xs leading-tight">{mod.phenotype}</div>
                                <div className="text-xs text-gray-500 mt-0.5">
                                    {mod.species} | {mod.tubulin_type}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {totalCount === 0 && (
                    <div className="p-4 text-center text-gray-500">
                        No annotations at position {queryPosition}
                    </div>
                )}
            </div>
        </div>
    );
}