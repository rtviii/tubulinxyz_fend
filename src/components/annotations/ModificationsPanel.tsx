'use client';

import { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { Modification } from '@/store/slices/annotationsSlice';
import { resolveModificationColor } from '@/lib/colors/annotationPaletteResolve';
import { useAppDispatch, useAppSelector } from '@/store/store';
import {
  setModificationColorOverride,
  clearModificationColorOverride,
  selectModificationOverrides,
} from '@/store/slices/colorOverridesSlice';
import { ColorSwatchPicker } from '@/components/ui/ColorSwatchPicker';

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
  const dispatch = useAppDispatch();
  const modificationOverrides = useAppSelector(selectModificationOverrides);

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
            const color = resolveModificationColor(modificationOverrides, modType);
            const isVisible = visibleSet.has(modType);
            const isOverridden = Boolean(modificationOverrides[modType]);
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
                <ColorSwatchPicker
                  color={color}
                  isOverridden={isOverridden}
                  onChange={(hex) => dispatch(setModificationColorOverride({ key: modType, color: hex }))}
                  onReset={() => dispatch(clearModificationColorOverride(modType))}
                  title={`Color for ${modType}`}
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: color }}
                  />
                </ColorSwatchPicker>
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
