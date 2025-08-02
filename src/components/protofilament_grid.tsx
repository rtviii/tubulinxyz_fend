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

export const ProtofilamentGrid = ({
    pdbId,
    onSubunitSelect,
    onSubunitHover,
    selectedSubunitId,
    hoveredSubunitId,
    shearAngle = 15,
    cellSize = 24, // Slightly smaller for a tighter fit
    gap = 3,
    protofilamentGap = 8
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

    if (loading) {
        return (
            <div className="w-full text-center py-4">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-xs text-gray-500">Generating lattice...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="w-full text-center p-2 bg-red-50 border border-red-200 rounded">
                <p className="text-red-600 text-xs font-medium">Failed to load grid</p>
            </div>
        );
    }

    if (!gridData || gridData.subunits.length === 0) {
        return (
            <div className="text-center py-2">
                <p className="text-xs text-gray-500">No 2D lattice data available.</p>
            </div>
        );
    }

    // 🎨 2. Simplified container with less padding
    return (
        <div className="w-full">
            <div className="flex justify-between items-center mb-2 px-1">
                <h3 className="text-md font-semibold text-gray-800">2D Lattice</h3>
                <div className="text-xs text-gray-600">
                    {protofilaments} PFs
                </div>
            </div>
            <div className="border rounded-md bg-gray-100 p-2 overflow-auto">
                <svg width={totalWidth} height={totalHeight} className="block">
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
                                    fill={data.monomerType === 'α' ? '#bfdbfe' : '#fed7aa'}
                                    stroke={isSelected ? '#1d4ed8' : isHovered ? '#6b7280' : '#d1d5db'}
                                    strokeWidth={isHighlighted ? 2.5 : 1}
                                    _className="transition-all duration-150"
                                />
                                <text
                                    x={position.x + cellSize / 2}
                                    y={position.y + cellSize / 2 + 1}
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                    className="text-[10px] font-semibold fill-gray-800 pointer-events-none select-none"
                                >
                                    {data.monomerType}
                                </text>
                            </g>
                        );
                    })}
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
}