// src/app/msalite/components/MSAToolbar.tsx
'use client';

import { useState } from 'react';
import { ChevronDown, RotateCcw } from 'lucide-react';

const BUILTIN_SCHEMES = [
  { id: 'clustal2', name: 'Clustal' },
  { id: 'zappo', name: 'Zappo' },
  { id: 'taylor', name: 'Taylor' },
  { id: 'hydro', name: 'Hydrophobicity' },
  { id: 'buried', name: 'Buried' },
  { id: 'cinema', name: 'Cinema' },
  { id: 'helix', name: 'Helix Propensity' },
  { id: 'strand', name: 'Strand Propensity' },
] as const;

interface MSAToolbarProps {
  currentScheme: string;
  maxLength: number;
  onSchemeChange: (scheme: string) => void;
  onJumpToRange: (start: number, end: number) => void;
  onReset?: () => void;
  compact?: boolean;
}

export function MSAToolbar({
  currentScheme,
  maxLength,
  onSchemeChange,
  onJumpToRange,
  onReset,
  compact = false,
}: MSAToolbarProps) {
  const [jumpStart, setJumpStart] = useState(1);
  const [jumpEnd, setJumpEnd] = useState(100);

  const quickRanges = [
    { label: '1-100', start: 1, end: 100 },
    { label: '100-200', start: 100, end: 200 },
    { label: '200-300', start: 200, end: 300 },
    { label: 'Full', start: 1, end: maxLength },
  ];

  return (
    <div className={`flex items-center gap-3 ${compact ? 'text-xs' : 'text-sm'}`}>
      {/* Color scheme selector */}
      <div className="flex items-center gap-1.5">
        <span className="text-gray-500">Color:</span>
        <select
          value={currentScheme.startsWith('custom') ? '' : currentScheme}
          onChange={(e) => e.target.value && onSchemeChange(e.target.value)}
          className={`border rounded px-1.5 py-0.5 bg-white ${compact ? 'text-xs' : 'text-sm'}`}
        >
          {currentScheme.startsWith('custom') && (
            <option value="">Custom</option>
          )}
          {BUILTIN_SCHEMES.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      <div className="w-px h-4 bg-gray-300" />

      {/* Quick jumps */}
      <div className="flex items-center gap-1">
        {quickRanges.map((r) => (
          <button
            key={r.label}
            onClick={() => onJumpToRange(r.start, r.end)}
            className="px-1.5 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-600"
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="w-px h-4 bg-gray-300" />

      {/* Custom range */}
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={jumpStart}
          onChange={(e) => setJumpStart(Number(e.target.value))}
          className="w-14 px-1.5 py-0.5 border rounded text-center"
          min={1}
          max={maxLength}
        />
        <span className="text-gray-400">-</span>
        <input
          type="number"
          value={jumpEnd}
          onChange={(e) => setJumpEnd(Number(e.target.value))}
          className="w-14 px-1.5 py-0.5 border rounded text-center"
          min={1}
          max={maxLength}
        />
        <button
          onClick={() => onJumpToRange(jumpStart, jumpEnd)}
          className="px-2 py-0.5 rounded bg-blue-100 hover:bg-blue-200 text-blue-700"
        >
          Go
        </button>
      </div>

      {/* Reset */}
      {onReset && (
        <>
          <div className="w-px h-4 bg-gray-300" />
          <button
            onClick={onReset}
            className="p-1 rounded hover:bg-gray-100 text-gray-500"
            title="Reset to default"
          >
            <RotateCcw size={14} />
          </button>
        </>
      )}
    </div>
  );
}