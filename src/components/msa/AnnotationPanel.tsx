// src/components/msa/AnnotationPanel.tsx
'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Focus } from 'lucide-react';
import { AnnotationData, BindingSite, MutationAnnotation } from '@/lib/sync/types';

export const MUTATION_COLOR = '#ff6b6b';

interface AnnotationPanelProps {
    annotations: AnnotationData;
    activeBindingSites: Set<string>;
    showMutations: boolean;
    onToggleSite: (siteId: string, enabled: boolean) => void;
    onFocusSite: (siteId: string) => void;
    onToggleMutations: (enabled: boolean) => void;
    onClearAll: () => void;
}

export function AnnotationPanel({
    annotations,
    activeBindingSites,
    showMutations,
    onToggleSite,
    onFocusSite,
    onToggleMutations,
    onClearAll,
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
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
                <span className="font-semibold text-gray-700 uppercase tracking-wider text-[10px]">Annotations</span>
                {hasAnyEnabled && (
                    <button onClick={onClearAll} className="text-blue-600 hover:text-blue-800 font-medium">
                        Clear all
                    </button>
                )}
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
                                    const totalPositions = site.msaRegions.reduce((sum, r) => sum + (r.end - r.start + 1), 0);

                                    return (
                                        <div
                                            key={site.id}
                                            className={`group flex items-center gap-2 px-2 py-1.5 rounded transition-colors cursor-pointer ${isActive ? 'bg-white shadow-sm ring-1 ring-black/5' : 'hover:bg-gray-100'
                                                }`}
                                            onClick={() => onToggleSite(site.id, !isActive)}
                                        >
                                            <div
                                                className="w-3 h-3 rounded-sm flex-shrink-0 border border-black/10"
                                                style={{ backgroundColor: isActive ? site.color : '#e5e5e5' }}
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className={`font-medium truncate ${isActive ? 'text-gray-900' : 'text-gray-500'}`}>
                                                    {site.name}
                                                </div>
                                                <div className="text-[10px] text-gray-400">{totalPositions} residues</div>
                                            </div>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onFocusSite(site.id);
                                                }}
                                                className={`p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                                                    }`}
                                                title="Focus in viewer"
                                            >
                                                <Focus size={12} />
                                            </button>
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
                                    className={`flex items-center gap-2 w-full py-1.5 px-2 rounded transition-colors ${showMutations ? 'bg-white shadow-sm ring-1 ring-black/5' : 'hover:bg-gray-100'
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

// Re-export types for convenience
export type { AnnotationData, BindingSite, MutationAnnotation };