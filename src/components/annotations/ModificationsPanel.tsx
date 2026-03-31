'use client';

import { useState } from 'react';
import { ChevronRight, Eye, EyeOff, ExternalLink } from 'lucide-react';
import type { Modification } from '@/store/slices/annotationsSlice';

interface ModificationsPanelProps {
  modifications: Modification[];
  showModifications: boolean;
  onToggleModifications: (visible: boolean) => void;
}

export const MODIFICATION_COLORS: Record<string, string> = {
  acetylation: '#6366f1',     // indigo
  phosphorylation: '#0ea5e9', // sky
  palmitoylation: '#f59e0b',  // amber
  ubiquitination: '#ef4444',  // red
  methylation: '#8b5cf6',     // violet
  nitrosylation: '#14b8a6',   // teal
  sumoylation: '#f97316',     // orange
  glutamylation: '#22c55e',   // green
  glycylation: '#06b6d4',     // cyan
  tyrosination: '#ec4899',    // pink
};

function getModColor(type: string): string {
  return MODIFICATION_COLORS[type] ?? '#9ca3af';
}

export function ModificationsPanel({
  modifications,
  showModifications,
  onToggleModifications,
}: ModificationsPanelProps) {
  const [expanded, setExpanded] = useState(true);

  if (modifications.length === 0) return null;

  return (
    <div>
      <div
        onClick={() => setExpanded(e => !e)}
        className="flex items-center gap-1 w-full text-left py-0.5 cursor-pointer select-none"
      >
        <ChevronRight
          size={10}
          className={`text-gray-300 transition-transform duration-100 ${expanded ? 'rotate-90' : ''}`}
        />
        <span className="text-[10px] font-medium text-gray-500">
          Modifications ({modifications.length})
        </span>
        <div className="ml-auto" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => onToggleModifications(!showModifications)}
            className="p-0.5 text-gray-300 hover:text-gray-600"
            title={showModifications ? 'Hide modification highlights' : 'Show modification highlights'}
          >
            {showModifications ? <Eye size={11} /> : <EyeOff size={11} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="max-h-36 overflow-y-auto border border-gray-100 rounded bg-white">
          {modifications.map((m, i) => {
            const color = getModColor(m.modificationType);
            const detail = [m.species, m.tubulinType, m.phenotype].filter(Boolean).join(' / ');
            return (
              <div
                key={`${m.masterIndex}-${m.modificationType}-${i}`}
                className="group flex items-center gap-1.5 px-1.5 py-0.5 hover:bg-gray-50 text-[10px] border-b border-gray-50 last:border-b-0"
              >
                <span
                  className="w-auto min-w-[3rem] text-center text-[8px] px-1 py-px rounded font-semibold text-white flex-shrink-0 leading-tight"
                  style={{ backgroundColor: color }}
                >
                  {m.modificationType.slice(0, 5).toUpperCase()}
                </span>
                <span className="font-mono font-medium text-gray-700 flex-shrink-0">
                  {m.aminoAcid}{m.masterIndex}
                </span>
                <span className="flex-1 min-w-0 text-gray-400 truncate" title={detail}>
                  {detail}
                </span>
                {m.databaseLink && (
                  <a
                    href={m.databaseLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-0.5 text-gray-200 hover:text-blue-500 opacity-0 group-hover:opacity-100 flex-shrink-0"
                    title="View source"
                    onClick={e => e.stopPropagation()}
                  >
                    <ExternalLink size={10} />
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
