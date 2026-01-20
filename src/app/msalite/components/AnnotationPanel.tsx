// src/app/msalite/components/AnnotationPanel.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronRight, Eye, EyeOff } from 'lucide-react';
import {
  applyAnnotationColoring,
  assignAnnotationColors,
  clearColorConfig,
  BindingSiteAnnotation,
  RowHighlight,
  applyRowHighlights,
  applyCombinedColoring,
} from '../services/msaColorService';

// ============================================================
// Types
// ============================================================

export interface MutationAnnotation {
  masterIndex: number;
  fromResidue: string;
  toResidue: string;
  phenotype?: string;
  source?: string;
}

export interface BindingSite {
  id: string;
  name: string;
  positions: number[];
  color?: string;
}

export interface AnnotationData {
  mutations?: MutationAnnotation[];
  bindingSites?: BindingSite[];
  // Future: conservationScores, secondaryStructure, etc.
}

interface AnnotationPanelProps {
  annotations: AnnotationData;
  sequenceCount: number;
  maxLength: number;
  activeSequenceIndex?: number; // which row is the "current" chain
  onColoringApplied: () => void; // callback to trigger MSA redraw
  onClear: () => void;
}

// ============================================================
// Color palettes
// ============================================================

const BINDING_SITE_COLORS: Record<string, string> = {
  colchicine: '#e6194b',
  taxol: '#3cb44b',
  paclitaxel: '#3cb44b',
  vinblastine: '#ffe119',
  gtp: '#4363d8',
  gdp: '#4363d8',
  default: '#f58231',
};

const MUTATION_COLOR = '#ff6b6b';
const INTERACTION_COLOR = '#4ecdc4';

// ============================================================
// Component
// ============================================================

export function AnnotationPanel({
  annotations,
  sequenceCount,
  maxLength,
  activeSequenceIndex = 0,
  onColoringApplied,
  onClear,
}: AnnotationPanelProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['bindingSites']));
  const [enabledBindingSites, setEnabledBindingSites] = useState<Set<string>>(new Set());
  const [showMutations, setShowMutations] = useState(false);

  const { mutations = [], bindingSites = [] } = annotations;

  // Assign colors to binding sites
  const bindingSiteColors = useMemo(() => {
    const colors = new Map<string, string>();
    bindingSites.forEach((site) => {
      const color = site.color 
        || BINDING_SITE_COLORS[site.id.toLowerCase()] 
        || BINDING_SITE_COLORS[site.name.toLowerCase()]
        || BINDING_SITE_COLORS.default;
      colors.set(site.id, color);
    });
    return colors;
  }, [bindingSites]);

  // Apply coloring when selections change
  useEffect(() => {
    if (enabledBindingSites.size === 0 && !showMutations) {
      clearColorConfig();
      onColoringApplied();
      return;
    }

    const columnColors = new Map<number, string>();
    const rowHighlights: RowHighlight[] = [];

    // Add binding site colors (column-wide)
    if (enabledBindingSites.size > 0) {
      bindingSites
        .filter((site) => enabledBindingSites.has(site.id))
        .forEach((site) => {
          const color = bindingSiteColors.get(site.id) || BINDING_SITE_COLORS.default;
          site.positions.forEach((pos) => {
            columnColors.set(pos, color);
          });
        });
    }

    // Add mutation highlights (row-specific to active sequence)
    if (showMutations && mutations.length > 0) {
      mutations.forEach((mut) => {
        rowHighlights.push({
          rowIndex: activeSequenceIndex,
          start: mut.masterIndex,
          end: mut.masterIndex,
          color: MUTATION_COLOR,
        });
      });
    }

    // Apply combined coloring
    if (columnColors.size > 0 || rowHighlights.length > 0) {
      applyCombinedColoring(columnColors, rowHighlights, '#f8f8f8');
    }

    onColoringApplied();
  }, [enabledBindingSites, showMutations, bindingSites, mutations, activeSequenceIndex, bindingSiteColors, onColoringApplied]);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const toggleBindingSite = (siteId: string) => {
    setEnabledBindingSites((prev) => {
      const next = new Set(prev);
      if (next.has(siteId)) {
        next.delete(siteId);
      } else {
        next.add(siteId);
      }
      return next;
    });
  };

  const toggleAllBindingSites = (enable: boolean) => {
    if (enable) {
      setEnabledBindingSites(new Set(bindingSites.map((s) => s.id)));
    } else {
      setEnabledBindingSites(new Set());
    }
  };

  const handleClearAll = () => {
    setEnabledBindingSites(new Set());
    setShowMutations(false);
    clearColorConfig();
    onClear();
  };

  const hasAnyEnabled = enabledBindingSites.size > 0 || showMutations;

  return (
    <div className="text-xs">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-gray-700">Annotations</span>
        {hasAnyEnabled && (
          <button
            onClick={handleClearAll}
            className="text-gray-400 hover:text-gray-600"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Binding Sites Section */}
      {bindingSites.length > 0 && (
        <div className="mb-2">
          <button
            onClick={() => toggleSection('bindingSites')}
            className="flex items-center gap-1 w-full text-left py-1 text-gray-600 hover:text-gray-800"
          >
            {expandedSections.has('bindingSites') ? (
              <ChevronDown size={12} />
            ) : (
              <ChevronRight size={12} />
            )}
            <span>Binding Sites ({bindingSites.length})</span>
          </button>

          {expandedSections.has('bindingSites') && (
            <div className="ml-4 space-y-1">
              {/* Toggle all */}
              <div className="flex items-center justify-between py-0.5 text-gray-400">
                <span>Toggle all</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => toggleAllBindingSites(true)}
                    className="hover:text-gray-600"
                  >
                    <Eye size={12} />
                  </button>
                  <button
                    onClick={() => toggleAllBindingSites(false)}
                    className="hover:text-gray-600"
                  >
                    <EyeOff size={12} />
                  </button>
                </div>
              </div>

              {/* Individual sites */}
              {bindingSites.map((site) => {
                const isEnabled = enabledBindingSites.has(site.id);
                const color = bindingSiteColors.get(site.id);

                return (
                  <button
                    key={site.id}
                    onClick={() => toggleBindingSite(site.id)}
                    className={`flex items-center gap-2 w-full py-1 px-1.5 rounded transition-colors ${
                      isEnabled ? 'bg-gray-100' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div
                      className="w-3 h-3 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: isEnabled ? color : '#e5e5e5' }}
                    />
                    <span className={isEnabled ? 'text-gray-800' : 'text-gray-500'}>
                      {site.name}
                    </span>
                    <span className="text-gray-400 ml-auto">
                      {site.positions.length} pos
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Mutations Section */}
      {mutations.length > 0 && (
        <div className="mb-2">
          <button
            onClick={() => toggleSection('mutations')}
            className="flex items-center gap-1 w-full text-left py-1 text-gray-600 hover:text-gray-800"
          >
            {expandedSections.has('mutations') ? (
              <ChevronDown size={12} />
            ) : (
              <ChevronRight size={12} />
            )}
            <span>Mutations ({mutations.length})</span>
          </button>

          {expandedSections.has('mutations') && (
            <div className="ml-4">
              <button
                onClick={() => setShowMutations(!showMutations)}
                className={`flex items-center gap-2 w-full py-1 px-1.5 rounded transition-colors ${
                  showMutations ? 'bg-gray-100' : 'hover:bg-gray-50'
                }`}
              >
                <div
                  className="w-3 h-3 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: showMutations ? MUTATION_COLOR : '#e5e5e5' }}
                />
                <span className={showMutations ? 'text-gray-800' : 'text-gray-500'}>
                  Show all mutations
                </span>
              </button>

              {/* Mutation list preview */}
              {showMutations && (
                <div className="mt-1 max-h-24 overflow-y-auto space-y-0.5 pl-5">
                  {mutations.slice(0, 10).map((mut, idx) => (
                    <div key={idx} className="text-gray-500">
                      {mut.fromResidue}{mut.masterIndex + 1}{mut.toResidue}
                      {mut.phenotype && (
                        <span className="text-gray-400 ml-1">- {mut.phenotype}</span>
                      )}
                    </div>
                  ))}
                  {mutations.length > 10 && (
                    <div className="text-gray-400">...and {mutations.length - 10} more</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {bindingSites.length === 0 && mutations.length === 0 && (
        <div className="text-gray-400 py-2">No annotations available</div>
      )}
    </div>
  );
}