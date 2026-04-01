'use client';

import { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { Modification } from '@/store/slices/annotationsSlice';

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

interface ModificationsPanelProps {
  modifications: Modification[];
  visibleModificationTypes: string[];
  onToggleModificationType: (modType: string) => void;
}

export function ModificationsPanel({
  modifications,
  visibleModificationTypes,
  onToggleModificationType,
}: ModificationsPanelProps) {
  const [expanded, setExpanded] = useState(true);

  // Group by modification type with counts
  const typeGroups = useMemo(() => {
    const groups: Record<string, number> = {};
    for (const m of modifications) {
      groups[m.modificationType] = (groups[m.modificationType] ?? 0) + 1;
    }
    return Object.entries(groups)
      .sort((a, b) => b[1] - a[1]); // sort by count descending
  }, [modifications]);

  if (modifications.length === 0) return null;

  const visibleSet = new Set(visibleModificationTypes);

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
      </div>

      {expanded && (
        <div className="border border-gray-100 rounded bg-white">
          {typeGroups.map(([modType, count]) => {
            const color = getModColor(modType);
            const isVisible = visibleSet.has(modType);
            return (
              <label
                key={modType}
                className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-b-0"
              >
                <input
                  type="checkbox"
                  checked={isVisible}
                  onChange={() => onToggleModificationType(modType)}
                  className="w-3 h-3 rounded accent-current"
                  style={{ accentColor: color }}
                />
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="text-[10px] text-gray-600 flex-1">
                  {modType.charAt(0).toUpperCase() + modType.slice(1)}
                </span>
                <span className="text-[9px] text-gray-400 tabular-nums">
                  {count}
                </span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
