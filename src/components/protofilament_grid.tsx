import React, { useCallback, useMemo, useState, useEffect } from 'react';

// Backend data structure (what we get from API)
interface BackendSubunitData {
    id: string;
    auth_asym_id: string;
    protofilament: number;
    subunitIndex: number;
    monomerType: 'alpha' | 'beta'; // Backend returns these strings
}

interface BackendGridData {
    subunits: BackendSubunitData[];
    structure_type: string;
    metadata: {
        pdb_id: string;
        num_tubulin_chains: number;
        num_protofilaments: number;
        nterm_connections: number;
    };
}

// Frontend data structure (what the component uses)
export interface SubunitData {
    id: string;
    auth_asym_id: string;
    protofilament: number;
    subunitIndex: number;
    monomerType: 'α' | 'β'; // Greek letters for display
}

export interface GridData {
    subunits: SubunitData[];
}

// Grid loading hook
const useGridData = (pdbId: string | null) => {
    const [gridData, setGridData] = useState<GridData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadGrid = useCallback(async (pdbId: string) => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`http://localhost:8000/grid/${pdbId.toLowerCase()}`);

            if (!response.ok) {
                throw new Error(`Failed to load grid: ${response.statusText}`);
            }

            const backendData: BackendGridData = await response.json();

            // Convert backend format to frontend format
            const frontendData: GridData = {
                subunits: backendData.subunits.map(subunit => ({
                    ...subunit,
                    monomerType: subunit.monomerType === 'alpha' ? 'α' : 'β'
                }))
            };

            setGridData(frontendData);
            console.log(`Loaded grid for ${pdbId}: ${frontendData.subunits.length} subunits`);

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            setError(errorMessage);
            console.error('Error loading grid:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (pdbId) {
            loadGrid(pdbId);
        } else {
            setGridData(null);
            setError(null);
        }
    }, [pdbId, loadGrid]);

    return { gridData, loading, error, refetch: () => pdbId && loadGrid(pdbId) };
};

// Enhanced ProtofilamentGrid component with integrated data loading
export const ProtofilamentGrid = ({
    pdbId,
    onSubunitSelect,
    onSubunitHover,
    selectedSubunitId,
    hoveredSubunitId,
    shearAngle = 15,
    cellSize = 28,
    gap = 4,
    protofilamentGap = 10
}: {
    pdbId: string | null;
    onSubunitSelect?: (subunit: SubunitData) => void;
    onSubunitHover?: (subunit: SubunitData | null) => void;
    selectedSubunitId?: string | null;
    hoveredSubunitId?: string | null;
    shearAngle?: number;
    cellSize?: number;
    gap?: number;
    protofilamentGap?: number;
}) => {
    const { gridData, loading, error } = useGridData(pdbId);

    const getPosition = useCallback((pf: number, su: number) => {
        const shearOffset = Math.tan(shearAngle * Math.PI / 180) * cellSize;
        // Swap x and y to make protofilaments vertical columns
        const x = su * (cellSize + gap) + pf * shearOffset;
        const y = pf * (cellSize + protofilamentGap);
        return { x, y };
    }, [cellSize, protofilamentGap, gap, shearAngle]);

    const { subunitPositions, totalWidth, totalHeight, protofilaments } = useMemo(() => {
        if (!gridData || gridData.subunits.length === 0) {
            return { subunitPositions: {}, totalWidth: 0, totalHeight: 0, protofilaments: 0 };
        }

        const { subunits } = gridData;
        const protofilaments = Math.max(...subunits.map(d => d.protofilament)) + 1;
        const maxSubunits = Math.max(...subunits.map(d => d.subunitIndex)) + 1;
        const shearOffset = Math.tan(shearAngle * Math.PI / 180) * cellSize;
        // Swap width and height since we swapped x and y
        const totalWidth = maxSubunits * (cellSize + gap) + Math.abs(shearOffset * protofilaments);
        const totalHeight = protofilaments * (cellSize + protofilamentGap);

        const positions: { [id: string]: { data: SubunitData, position: { x: number, y: number } } } = {};
        subunits.forEach(subunit => {
            positions[subunit.id] = {
                data: subunit,
                position: getPosition(subunit.protofilament, subunit.subunitIndex)
            };
        });

        return { subunitPositions: positions, totalWidth, totalHeight, protofilaments };
    }, [gridData, getPosition, cellSize, protofilamentGap, gap, shearAngle]);

    // Loading state
    if (loading) {
        return (
            <div className="w-full text-center p-8 bg-gray-50">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-gray-500">Generating 2D lattice from {pdbId?.toUpperCase()}...</p>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="w-full text-center p-8 bg-red-50 border border-red-200">
                <p className="text-red-600 font-medium">Failed to load grid</p>
                <p className="text-red-500 text-sm mt-1">{error}</p>
            </div>
        );
    }

    // No data state
    if (!gridData || gridData.subunits.length === 0) {
        return (
            <div className="w-full text-center p-8 bg-gray-50">
                <p className="text-gray-500">Load a structure to see the 2D lattice view.</p>
            </div>
        );
    }

    return (
        <div className="w-full p-4">
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-semibold">2D Lattice View</h3>
                <div className="text-sm text-gray-600">
                    {gridData.subunits.length} subunits • {protofilaments} protofilaments
                </div>
            </div>
            {/* Remove internal scrolling - let parent handle it */}
            <div className="border rounded-lg bg-gray-50 p-4">
                <svg width={totalWidth} height={totalHeight} className="block">
                    {/* Render subunits */}
                    {Object.values(subunitPositions).map(({ data, position }) => {
                        const isHovered = hoveredSubunitId === data.id;
                        const isSelected = selectedSubunitId === data.id;
                        const isHighlighted = isHovered || isSelected;

                        return (
                            <g key={data.id}
                                onMouseEnter={() => onSubunitHover?.(data)}
                                onMouseLeave={() => onSubunitHover?.(null)}
                                onClick={() => onSubunitSelect?.(data)}
                                className="cursor-pointer">
                                <circle
                                    cx={position.x + cellSize / 2}
                                    cy={position.y + cellSize / 2}
                                    r={cellSize / 2 - 2}
                                    fill={data.monomerType === 'α' ? '#bfdbfe' : '#fed7aa'} // Alpha: blue, Beta: orange
                                    stroke={isSelected ? '#1d4ed8' : isHovered ? '#6b7280' : '#d1d5db'}
                                    strokeWidth={isHighlighted ? 3 : 1.5}
                                    className="transition-all duration-150"
                                />
                                <text
                                    x={position.x + cellSize / 2}
                                    y={position.y + cellSize / 2 + 1}
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                    className="text-xs font-semibold fill-gray-800 pointer-events-none select-none"
                                >
                                    {data.monomerType}
                                </text>
                            </g>
                        );
                    })}
                    {/* Protofilament labels - now on the left side as row labels */}
                    {Array.from({ length: protofilaments }, (_, i) => (
                        <text
                            key={`pf-label-${i}`}
                            x={-8}
                            y={getPosition(i, 0).y + cellSize / 2}
                            textAnchor="end"
                            dominantBaseline="middle"
                            className="text-xs font-medium fill-gray-500"
                        >
                            PF{i + 1}
                        </text>
                    ))}
                </svg>
            </div>
        </div>
    );
};