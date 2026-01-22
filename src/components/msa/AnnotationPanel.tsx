// src/components/msa/AnnotationPanel.tsx
'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Focus, Target } from 'lucide-react';
import { BindingSite, MutationAnnotation, AnnotationData } from '@/lib/sync/types';
import { AnnotationMode } from '@/hooks/useBindingSites';
import { MsaSequence } from '@/store/slices/sequence_registry';

export const MUTATION_COLOR = '#ff6b6b';

interface AnnotationPanelProps {
  annotations: AnnotationData;
  activeBindingSites: Set<string>;
  showMutations: boolean;
  annotationMode: AnnotationMode;
  selectedSequence: MsaSequence | null;
  onToggleSite: (siteId: string, enabled: boolean, rowIndex?: number) => void;
  onApplyToSelected: (siteId: string, rowIndex: number) => void;
  onFocusSite: (siteId: string) => void;
  onToggleMutations: (enabled: boolean) => void;
  onClearAll: () => void;
  onSetAnnotationMode: (mode: AnnotationMode) => void;
}

export function AnnotationPanel({
  annotations,
  activeBindingSites,
  showMutations,
  annotationMode,
  selectedSequence,
  onToggleSite,
  onApplyToSelected,
  onFocusSite,
  onToggleMutations,
  onClearAll,
  onSetAnnotationMode,
}: AnnotationPanelProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['bindingSites', 'mutations']));
  const { mutations = [], bindingSites = [] } = annotations;

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const hasAnyEnabled = activeBindingSites.size > 0 || showMutations;

  return (
    <div className="text-xs h-full flex flex-col">
      {/* Header with selection info */}
      <div className="flex-shrink-0 mb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="font-semibold text-gray-700 uppercase tracking-wider text-[10px]">Annotations</span>
          {hasAnyEnabled && (
            <button onClick={onClearAll} className="text-blue-600 hover:text-blue-800 font-medium">
              Clear all
            </button>
          )}
        </div>

        {/* Selection display */}
        {selectedSequence && (
          <div className="p-2 bg-green-50 border border-green-200 rounded mb-2">
            <div className="text-[10px] text-green-600 uppercase tracking-wider mb-1">Selected</div>
            <div className="font-medium text-green-800 truncate" title={selectedSequence.name}>
              {formatSelectedLabel(selectedSequence)}
            </div>
          </div>
        )}

        {/* Mode toggle */}
        <div className="flex gap-1 p-1 bg-gray-100 rounded">
          <button
            onClick={() => onSetAnnotationMode('global')}
            className={`flex-1 px-2 py-1 rounded text-[10px] font-medium transition-colors ${
              annotationMode === 'global'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Global
          </button>
          <button
            onClick={() => onSetAnnotationMode('selected')}
            disabled={!selectedSequence}
            className={`flex-1 px-2 py-1 rounded text-[10px] font-medium transition-colors ${
              annotationMode === 'selected'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            } ${!selectedSequence ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            Selected Only
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {bindingSites.length > 0 && (
          <section>
            <button
              onClick={() => toggleSection('bindingSites')}
              className="flex items-center gap-1 w-full text-left py-1 font-medium text-gray-600 hover:text-gray-900 border-b border-gray-100 mb-2"
            >
              {expandedSections.has('bindingSites') ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <span>Binding Sites</span>
            </button>

            {expandedSections.has('bindingSites') && (
              <div className="space-y-1">
                {bindingSites.map((site) => {
                  const isActive = activeBindingSites.has(site.id);
                  const rowSpecificId = selectedSequence ? `${site.id}-row-${selectedSequence.rowIndex}` : null;
                  const isActiveOnSelected = rowSpecificId ? activeBindingSites.has(rowSpecificId) : false;
                  const totalPositions = site.msaRegions.reduce((sum, r) => sum + (r.end - r.start + 1), 0);

                  return (
                    <div
                      key={site.id}
                      className={`group flex items-center gap-2 px-2 py-1.5 rounded transition-colors cursor-pointer ${
                        isActive || isActiveOnSelected ? 'bg-white shadow-sm ring-1 ring-black/5' : 'hover:bg-gray-100'
                      }`}
                      onClick={() => {
                        if (annotationMode === 'selected' && selectedSequence) {
                          onToggleSite(site.id, !isActiveOnSelected, selectedSequence.rowIndex);
                        } else {
                          onToggleSite(site.id, !isActive);
                        }
                      }}
                    >
                      <div
                        className="w-3 h-3 rounded-sm flex-shrink-0 border border-black/10"
                        style={{ backgroundColor: (isActive || isActiveOnSelected) ? site.color : '#e5e5e5' }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className={`font-medium truncate ${(isActive || isActiveOnSelected) ? 'text-gray-900' : 'text-gray-500'}`}>
                          {site.name}
                        </div>
                        <div className="text-[10px] text-gray-400">{totalPositions} residues</div>
                      </div>
                      <div className="flex items-center gap-1">
                        {/* Apply to selected button (visible when in global mode but have selection) */}
                        {annotationMode === 'global' && selectedSequence && !isActiveOnSelected && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onApplyToSelected(site.id, selectedSequence.rowIndex);
                            }}
                            className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Apply to selected sequence only"
                          >
                            <Target size={12} />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onFocusSite(site.id);
                          }}
                          className={`p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-opacity ${
                            (isActive || isActiveOnSelected) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                          }`}
                          title="Focus in viewer"
                        >
                          <Focus size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {mutations.length > 0 && (
          <section>
            <button
              onClick={() => toggleSection('mutations')}
              className="flex items-center gap-1 w-full text-left py-1 font-medium text-gray-600 hover:text-gray-900 border-b border-gray-100 mb-2"
            >
              {expandedSections.has('mutations') ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <span>Mutations</span>
            </button>

            {expandedSections.has('mutations') && (
              <div className="space-y-1">
                <button
                  onClick={() => onToggleMutations(!showMutations)}
                  className={`flex items-center gap-2 w-full py-1.5 px-2 rounded transition-colors ${
                    showMutations ? 'bg-white shadow-sm ring-1 ring-black/5' : 'hover:bg-gray-100'
                  }`}
                >
                  <div
                    className="w-3 h-3 rounded-sm flex-shrink-0 border border-black/10"
                    style={{ backgroundColor: showMutations ? MUTATION_COLOR : '#e5e5e5' }}
                  />
                  <span className={showMutations ? 'text-gray-900 font-medium' : 'text-gray-500'}>
                    Show all mutations
                  </span>
                </button>

                {showMutations && (
                  <div className="mt-1 max-h-48 overflow-y-auto space-y-0.5 pl-7 border-l-2 border-gray-100 ml-1.5">
                    {mutations.map((mut, idx) => (
                      <div key={idx} className="text-gray-500 py-0.5">
                        <span className="font-mono">
                          {mut.fromResidue}
                          {mut.masterIndex + 1}
                          {mut.toResidue}
                        </span>
                        {mut.phenotype && <span className="text-gray-400 ml-1.5 italic">- {mut.phenotype}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

function formatSelectedLabel(seq: MsaSequence): string {
  if (seq.originType === 'pdb' && seq.chainRef) {
    const family = seq.family ? formatFamily(seq.family) : null;
    const structLabel = `${seq.chainRef.pdbId}:${seq.chainRef.chainId}`;
    return family ? `${family} - ${structLabel}` : structLabel;
  }
  if (seq.originType === 'master') {
    return seq.family ? formatFamily(seq.family) : seq.name;
  }
  return seq.name;
}

function formatFamily(family: string): string {
  const tubulinMatch = family.match(/^tubulin_(\w+)$/);
  if (tubulinMatch) {
    return tubulinMatch[1].charAt(0).toUpperCase() + tubulinMatch[1].slice(1);
  }
  const mapMatch = family.match(/^map_(\w+)/);
  if (mapMatch) {
    return mapMatch[1].toUpperCase();
  }
  return family;
}

export type { AnnotationData, BindingSite, MutationAnnotation };