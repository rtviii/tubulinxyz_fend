import React, { useCallback, useMemo } from 'react';

// A type definition for the data this component will now expect.
export interface SubunitData {
    id: string; // A unique ID for the grid, e.g., "pf0-A"
    auth_asym_id: string; // The actual chain ID, e.g., "A"
    protofilament: number;
    subunitIndex: number; // Index within the protofilament
    monomerType: 'α' | 'β';
    // We can add these back later when the data is available
    // gtpState: 'GTP' | 'GDP';
    // hasPTMs: boolean;
}

export interface GridData {
    subunits: SubunitData[];
    // We'll leave contacts out for now until we have a real source for them.
    // contacts: any[];
}

// The ProtofilamentGrid component, now accepting props.
export const ProtofilamentGrid = ({ 
    gridData,
    onSubunitSelect,
    onSubunitHover,
    selectedSubunitId,
    hoveredSubunitId,
    shearAngle = 15,
    cellSize = 28,
    gap = 4,
    protofilamentGap = 10
}: {
    gridData: GridData | null;
    onSubunitSelect: (subunit: SubunitData) => void;
    onSubunitHover: (subunit: SubunitData | null) => void;
    selectedSubunitId: string | null;
    hoveredSubunitId: string | null;
    shearAngle?: number;
    cellSize?: number;
    gap?: number;
    protofilamentGap?: number;
}) => {
    // If no data is loaded yet, show a placeholder.
    if (!gridData || gridData.subunits.length === 0) {
        return (
            <div className="w-full text-center p-8 bg-gray-50 rounded-lg">
                <p className="text-gray-500">Load a structure to see the 2D lattice view.</p>
            </div>
        );
    }
    
    const { subunits } = gridData;

    // --- The rest of this component is the layout and rendering logic from your example ---
    const protofilaments = Math.max(...subunits.map(d => d.protofilament)) + 1;
    const maxSubunits = Math.max(...subunits.map(d => d.subunitIndex)) + 1;
    const shearOffset = Math.tan(shearAngle * Math.PI / 180) * cellSize;
    const totalWidth = protofilaments * (cellSize + protofilamentGap) + Math.abs(shearOffset * maxSubunits);
    const totalHeight = maxSubunits * (cellSize + gap);

    const getPosition = useCallback((pf: number, su: number) => {
        const x = pf * (cellSize + protofilamentGap) + su * shearOffset;
        const y = su * (cellSize + gap);
        return { x, y };
    }, [cellSize, protofilamentGap, gap, shearOffset]);

    const subunitPositions = useMemo(() => {
        const positions: { [id: string]: { data: SubunitData, position: {x: number, y: number} } } = {};
        subunits.forEach(subunit => {
            positions[subunit.id] = {
                data: subunit,
                position: getPosition(subunit.protofilament, subunit.subunitIndex)
            };
        });
        return positions;
    }, [subunits, getPosition]);
    
    return (
        <div className="w-full max-w-5xl mx-auto p-4">
            <h3 className="text-lg font-semibold mb-2">2D Lattice View</h3>
            <div className="overflow-auto border rounded-lg bg-gray-50 p-4">
                <svg width={totalWidth} height={totalHeight} className="block">
                    {/* Render subunits */}
                    {Object.values(subunitPositions).map(({ data, position }) => {
                        const isHovered = hoveredSubunitId === data.id;
                        const isSelected = selectedSubunitId === data.id;
                        const isHighlighted = isHovered || isSelected;

                        return (
                            <g key={data.id} 
                                onMouseEnter={() => onSubunitHover(data)}
                                onMouseLeave={() => onSubunitHover(null)}
                                onClick={() => onSubunitSelect(data)}
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
                    {/* Protofilament labels */}
                    {Array.from({ length: protofilaments }, (_, i) => (
                        <text
                            key={`pf-label-${i}`}
                            x={getPosition(i, 0).x + cellSize / 2}
                            y={-8}
                            textAnchor="middle"
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