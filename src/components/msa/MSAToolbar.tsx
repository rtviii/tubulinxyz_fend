// src/components/msa/MSAToolbar.tsx
'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { RotateCcw, HelpCircle } from 'lucide-react';

// These are duplicated from @nightingale-elements/nightingale-msa
// (src/colorschemes/substitution/palettes.ts). A static top-level import from that
// package pulls in the NightingaleMSA web component, whose class extends HTMLElement
// at module scope — which blows up during Next.js SSR (ReferenceError: HTMLElement
// is not defined). These values are pure data; keeping them local means the toolbar
// can render on the server without loading the custom-element module.
// The nightingale-msa web component itself is still loaded lazily on the client via
// useNightingaleComponents → await import(...).
type Category = 'gap' | 'consensus' | 'ambiguous' | 'common' | 'conservative' | 'radical';
type Palette = Record<Category, string>;

const PALETTE_SALIENCE: Palette = {
  gap:          '#ffffff',
  consensus:    '#f0f0f0',
  ambiguous:    '#cdc4b4',
  common:       '#e8c87a',
  conservative: '#e09850',
  radical:      '#c8553a',
};

const PALETTE_BW: Palette = {
  gap:          '#ffffff',
  consensus:    '#000000',
  common:       '#9ca3af',
  conservative: '#9ca3af',
  radical:      '#ffffff',
  ambiguous:    '#ffffff',
};

const LEGEND_ORDER: Array<{ category: Category; label: string; desc: string }> = [
  { category: 'consensus',    label: 'Consensus',    desc: 'Matches the most frequent residue in the column' },
  { category: 'ambiguous',    label: 'Ambiguous',    desc: 'No residue exceeds 40% frequency -- column is too diverse' },
  { category: 'common',       label: 'Common sub.',  desc: 'Differs from consensus but itself is frequent (>30%)' },
  { category: 'conservative', label: 'Conservative', desc: 'Rare substitution, same biochemical group (similar chemistry)' },
  { category: 'radical',      label: 'Radical',      desc: 'Rare substitution across biochemical groups (different chemistry)' },
];

const BUILTIN_SCHEMES = [
  { id: 'substitution',   name: 'Substitution Salience' },
  { id: 'salience-mono',  name: 'Salience (mono)' },
  { id: 'conservation',   name: 'Conservation' },
  { id: 'clustal2',       name: 'Clustal' },
  { id: 'zappo',          name: 'Zappo' },
  { id: 'taylor',         name: 'Taylor' },
  { id: 'hydro',          name: 'Hydrophobicity' },
  { id: 'buried',         name: 'Buried' },
  { id: 'cinema',         name: 'Cinema' },
  { id: 'helix',          name: 'Helix Propensity' },
  { id: 'strand',         name: 'Strand Propensity' },
] as const;

const SALIENCE_SCHEMES = new Set(['substitution', 'salience-mono']);

const SCHEME_LABELS: Record<string, string> = {
  'substitution':  'Substitution Salience',
  'salience-mono': 'Salience (mono)',
};

interface MSAToolbarProps {
  currentScheme  : string;
  maxLength      : number;
  onSchemeChange : (scheme: string) => void;
  onJumpToRange  : (start: number, end: number) => void;
  onReset       ?: () => void;
  compact       ?: boolean;

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

  const isSubstitution = SALIENCE_SCHEMES.has(currentScheme);
  const activePalette = currentScheme === 'salience-mono' ? PALETTE_BW : PALETTE_SALIENCE;
  const legendTitle = SCHEME_LABELS[currentScheme] ?? 'Substitution Salience';

  const handleJumpToKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    const val = (e.currentTarget.value ?? '').trim();
    // Accept "start-end" or "start end" or "start,end"; "start" alone jumps to [start, start]
    const m = val.match(/^(\d+)\s*(?:[-\u2013,\s]+\s*(\d+))?$/);
    if (!m) return;
    const start = Math.max(1, parseInt(m[1], 10));
    const end = m[2] ? Math.min(maxLength, parseInt(m[2], 10)) : start;
    if (end < start) return;
    onJumpToRange(start, end);
  };

  return (
    <div className="flex items-center gap-2 w-full justify-end text-[11px] text-gray-600">
      {/* ── Color group ── */}
      <div className="relative flex items-center gap-1">
        <span className="text-gray-500">Color:</span>
        <select
          value={currentScheme.startsWith('custom') ? '' : currentScheme}
          onChange={(e) => e.target.value && onSchemeChange(e.target.value)}
          className="border rounded px-1.5 py-0.5 bg-white text-[11px]"
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
            <HelpCircle size={12} className="text-gray-400 hover:text-gray-600 cursor-help" />
          </div>
        )}
        {onReset && (
          <button
            onClick={onReset}
            className="p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
            title="Reset colors"
          >
            <RotateCcw size={12} />
          </button>
        )}
        {showLegend && legendPos && createPortal(
          <div
            className="fixed z-[9999] w-72 bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-[11px]"
            style={{ top: legendPos.top, left: legendPos.left }}
            onMouseEnter={() => setShowLegend(true)}
            onMouseLeave={() => setShowLegend(false)}
          >
            <div className="font-medium text-gray-700 mb-2">{legendTitle}</div>
            <div className="space-y-1.5">
              {LEGEND_ORDER.map(item => (
                <div key={item.label} className="flex items-start gap-2">
                  <div
                    className="w-4 h-4 rounded border border-gray-300 flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: activePalette[item.category] }}
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

      {/* ── Range controls ── */}
      <div className="flex items-center gap-1.5">
        <span className="text-gray-500">Jump to:</span>
        <input
          type="text"
          placeholder="e.g. 100-200"
          onKeyDown={handleJumpToKey}
          className="w-20 border rounded px-1.5 py-0.5 bg-white text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-300"
        />
        <button
          onClick={() => onJumpToRange(1, maxLength)}
          className="px-1.5 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 text-[11px]"
        >
          Full
        </button>
        {onInRangeOnlyChange != null && (
          <label className="flex items-center gap-1 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={inRangeOnly ?? false}
              onChange={e => onInRangeOnlyChange(e.target.checked)}
              className="rounded"
            />
            In-range only
          </label>
        )}
      </div>
    </div>
  );
}
