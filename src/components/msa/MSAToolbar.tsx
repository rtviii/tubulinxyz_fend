// src/components/msa/MSAToolbar.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { RotateCcw, HelpCircle } from 'lucide-react';

const BUILTIN_SCHEMES = [
  { id: 'substitution', name: 'Substitution Salience' },
  { id: 'conservation', name: 'Conservation' },
  { id: 'clustal2', name: 'Clustal' },
  { id: 'zappo', name: 'Zappo' },
  { id: 'taylor', name: 'Taylor' },
  { id: 'hydro', name: 'Hydrophobicity' },
  { id: 'buried', name: 'Buried' },
  { id: 'cinema', name: 'Cinema' },
  { id: 'helix', name: 'Helix Propensity' },
  { id: 'strand', name: 'Strand Propensity' },
] as const;

const SUBSTITUTION_LEGEND = [
  { color: '#f0f0f0', label: 'Consensus', desc: 'Matches the most frequent residue in the column' },
  { color: '#cdc4b4', label: 'Ambiguous', desc: 'No residue exceeds 40% frequency -- column is too diverse' },
  { color: '#e8c87a', label: 'Common sub.', desc: 'Differs from consensus but itself is frequent (>30%)' },
  { color: '#e09850', label: 'Conservative', desc: 'Rare substitution, same biochemical group (similar chemistry)' },
  { color: '#c8553a', label: 'Radical', desc: 'Rare substitution across biochemical groups (different chemistry)' },
];

interface MSAToolbarProps {
  currentScheme  : string;
  maxLength      : number;
  onSchemeChange : (scheme: string) => void;
  onJumpToRange  : (start: number, end: number) => void;
  onReset       ?: () => void;
  compact       ?: boolean;

  showMasters       ?: boolean;
  masterCount       ?: number;
  onShowMastersChange?: (checked: boolean) => void;
  inRangeOnly       ?: boolean;
  onInRangeOnlyChange?: (checked: boolean) => void;
}

export function MSAToolbar({
  currentScheme,
  maxLength,
  onSchemeChange,
  onJumpToRange,
  onReset,
  compact = false,
  showMasters,
  masterCount,
  onShowMastersChange,
  inRangeOnly,
  onInRangeOnlyChange,
}: MSAToolbarProps) {

  const [showLegend, setShowLegend] = useState(false);
  const helpRef = useRef<HTMLDivElement>(null);
  const [legendPos, setLegendPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (showLegend && helpRef.current) {
      const rect = helpRef.current.getBoundingClientRect();
      setLegendPos({ top: rect.bottom + 4, left: rect.left });
    } else {
      setLegendPos(null);
    }
  }, [showLegend]);

  const isSubstitution = currentScheme === 'substitution';

  return (
    <div className={`flex items-center gap-3 ${compact ? 'text-xs' : 'text-sm'}`}>
      {/* Color scheme selector */}
      <div className="relative flex items-center gap-1.5">
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
        {isSubstitution && (
          <div
            ref={helpRef}
            onMouseEnter={() => setShowLegend(true)}
            onMouseLeave={() => setShowLegend(false)}
          >
            <HelpCircle size={13} className="text-gray-400 hover:text-gray-600 cursor-help" />
          </div>
        )}
        {showLegend && legendPos && createPortal(
          <div
            className="fixed z-[9999] w-72 bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs"
            style={{ top: legendPos.top, left: legendPos.left }}
            onMouseEnter={() => setShowLegend(true)}
            onMouseLeave={() => setShowLegend(false)}
          >
            <div className="font-medium text-gray-700 mb-2">Substitution Salience</div>
            <div className="space-y-1.5">
              {SUBSTITUTION_LEGEND.map(item => (
                <div key={item.label} className="flex items-start gap-2">
                  <div
                    className="w-4 h-4 rounded border border-gray-300 flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: item.color }}
                  />
                  <div>
                    <span className="font-medium text-gray-700">{item.label}</span>
                    <span className="text-gray-500"> -- {item.desc}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 pt-2 border-t border-gray-100 text-[10px] text-gray-400">
              Biochemical groups: hydrophobic (AVLIM), aromatic (FWY), small (GP), polar (STNQC), positive (KRH), negative (DE)
            </div>
          </div>,
          document.body
        )}
      </div>
      <div className="w-px h-4 bg-gray-300" />
      <button
        onClick={() => onJumpToRange(1, maxLength)}
        className="px-1.5 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-600"
      >
        Full
      </button>
      {onReset && (
        <button
          onClick={onReset}
          className="p-1 rounded hover:bg-gray-100 text-gray-500"
          title="Reset to default"
        >
          <RotateCcw size={14} />
        </button>
      )}
      {onShowMastersChange != null && (
        <>
          <div className="w-px h-4 bg-gray-300" />
          <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showMasters ?? true}
              onChange={e => onShowMastersChange(e.target.checked)}
              className="rounded"
            />
            Reference
            {masterCount != null && <span className="text-gray-400">({masterCount})</span>}
          </label>
        </>
      )}
      {onInRangeOnlyChange != null && (
        <>
          <div className="w-px h-4 bg-gray-300" />
          <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={inRangeOnly ?? false}
              onChange={e => onInRangeOnlyChange(e.target.checked)}
              className="rounded"
            />
            In-range only
          </label>
        </>
      )}
    </div>
  );
}
