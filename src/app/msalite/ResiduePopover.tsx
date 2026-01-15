'use client';

import { useEffect, useState } from 'react';

interface HoverInfo {
  seqId: string;
  seqIndex: number;
  position: number;
  residue: string;
  x: number;
  y: number;
}

interface ResiduePopoverProps {
  hoverInfo: HoverInfo;
  showDetails: boolean;
}

// Amino acid info for demo
const AA_INFO: Record<string, { name: string; type: string; color: string }> = {
  'A': { name: 'Alanine', type: 'Hydrophobic', color: '#8CFF8C' },
  'R': { name: 'Arginine', type: 'Positive', color: '#00007C' },
  'N': { name: 'Asparagine', type: 'Polar', color: '#FF7C70' },
  'D': { name: 'Aspartate', type: 'Negative', color: '#A00042' },
  'C': { name: 'Cysteine', type: 'Special', color: '#FFFF70' },
  'E': { name: 'Glutamate', type: 'Negative', color: '#660033' },
  'Q': { name: 'Glutamine', type: 'Polar', color: '#FF4C4C' },
  'G': { name: 'Glycine', type: 'Special', color: '#EBEBEB' },
  'H': { name: 'Histidine', type: 'Positive', color: '#7070FF' },
  'I': { name: 'Isoleucine', type: 'Hydrophobic', color: '#004C00' },
  'L': { name: 'Leucine', type: 'Hydrophobic', color: '#455E45' },
  'K': { name: 'Lysine', type: 'Positive', color: '#4747B8' },
  'M': { name: 'Methionine', type: 'Hydrophobic', color: '#B8A042' },
  'F': { name: 'Phenylalanine', type: 'Hydrophobic', color: '#534C52' },
  'P': { name: 'Proline', type: 'Special', color: '#525252' },
  'S': { name: 'Serine', type: 'Polar', color: '#FF7042' },
  'T': { name: 'Threonine', type: 'Polar', color: '#B84C00' },
  'W': { name: 'Tryptophan', type: 'Hydrophobic', color: '#4F4600' },
  'Y': { name: 'Tyrosine', type: 'Hydrophobic', color: '#8C704C' },
  'V': { name: 'Valine', type: 'Hydrophobic', color: '#FF8CFF' },
  '-': { name: 'Gap', type: '-', color: '#FFFFFF' },
};

export function ResiduePopover({ hoverInfo, showDetails }: ResiduePopoverProps) {
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    // Position the popover near the cursor but offset to not cover it
    setPosition({
      x: hoverInfo.x + 15,
      y: hoverInfo.y - 10,
    });
  }, [hoverInfo.x, hoverInfo.y]);

  const aaInfo = AA_INFO[hoverInfo.residue] || AA_INFO['-'];

  return (
    <div
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        zIndex: 1000,
        pointerEvents: 'none',
      }}
    >
      {/* Simple tooltip - always shown on hover */}
      <div className="bg-gray-900 text-white px-2 py-1 rounded text-xs shadow-lg">
        <span className="font-mono font-bold" style={{ color: aaInfo.color }}>
          {hoverInfo.residue}
        </span>
        <span className="text-gray-400 ml-1">
          @ {hoverInfo.position + 1}
        </span>
        <span className="text-gray-500 ml-1">
          ({hoverInfo.seqId})
        </span>
      </div>

      {/* Detailed panel - shown on click */}
      {showDetails && (
        <div className="mt-1 bg-white border border-gray-300 rounded shadow-xl p-3 min-w-48">
          <div className="flex items-center gap-2 mb-2">
            <div
              className="w-8 h-8 rounded flex items-center justify-center text-lg font-bold"
              style={{ backgroundColor: aaInfo.color }}
            >
              {hoverInfo.residue}
            </div>
            <div>
              <div className="font-semibold text-sm">{aaInfo.name}</div>
              <div className="text-xs text-gray-500">{aaInfo.type}</div>
            </div>
          </div>

          <div className="text-xs space-y-1 border-t pt-2">
            <div className="flex justify-between">
              <span className="text-gray-500">Position:</span>
              <span className="font-mono">{hoverInfo.position + 1}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Sequence:</span>
              <span className="font-mono">{hoverInfo.seqId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Row:</span>
              <span className="font-mono">{hoverInfo.seqIndex + 1}</span>
            </div>
          </div>

          {/* Placeholder for annotation data */}
          <div className="mt-2 pt-2 border-t">
            <div className="text-xs text-gray-500 mb-1">Annotations:</div>
            <div className="text-xs text-gray-400 italic">
              (Connect to your annotation API here)
            </div>
          </div>
        </div>
      )}

      {/* Arrow pointer */}
      <div
        className="absolute -left-2 top-2 w-0 h-0"
        style={{
          borderTop: '6px solid transparent',
          borderBottom: '6px solid transparent',
          borderRight: '8px solid #1f2937',
        }}
      />
    </div>
  );
}