// src/app/msalite/components/AnnotationPanel.tsx
'use client';

import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Eye, EyeOff } from 'lucide-react';

// ============================================================
// Types
// ============================================================

export interface MutationAnnotation {
    masterIndex : number;
    fromResidue : string;
    toResidue   : string;
    phenotype  ?: string;
    source     ?: string;
}

export interface BindingSite {
    id        : string;
    name      : string;
    positions : number[];
    color    ?: string;
}

export interface AnnotationData {
    mutations?: MutationAnnotation[];
    bindingSites?: BindingSite[];
}

export interface EnabledAnnotations {
    bindingSites: Set<string>;
    showMutations: boolean;
}

interface AnnotationPanelProps {
    annotations: AnnotationData;
    onChange: (enabled: EnabledAnnotations) => void;
    onClear: () => void;
}

// ============================================================
// Color palettes (exported for use by parent)
// ============================================================

export const BINDING_SITE_COLORS: Record<string, string> = {
    colchicine: '#e6194b',
    taxol: '#3cb44b',
    paclitaxel: '#3cb44b',
    vinblastine: '#ffe119',
    gtp: '#4363d8',
    gdp: '#4363d8',
    default: '#f58231',
};

export const MUTATION_COLOR = '#ff6b6b';

export function getBindingSiteColor(site: BindingSite): string {
    return site.color
        || BINDING_SITE_COLORS[site.id.toLowerCase()]
        || BINDING_SITE_COLORS[site.name.toLowerCase()]
        || BINDING_SITE_COLORS.default;
}

// ============================================================
// Component
// ============================================================

export function AnnotationPanel({
    annotations,
    onChange,
    onClear,
}: AnnotationPanelProps) {
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['bindingSites']));
    const [enabledBindingSites, setEnabledBindingSites] = useState<Set<string>>(new Set());
    const [showMutations, setShowMutations] = useState(false);

    const { mutations = [], bindingSites = [] } = annotations;

    // Notify parent when selections change
    const notifyChange = (sites: Set<string>, mutations: boolean) => {
        onChange({ bindingSites: sites, showMutations: mutations });
    };

    const toggleSection = (section: string) => {
        setExpandedSections((prev) => {
            const next = new Set(prev);
            if (next.has(section)) next.delete(section);
            else next.add(section);
            return next;
        });
    };

    const toggleBindingSite = (siteId: string) => {
        setEnabledBindingSites((prev) => {
            const next = new Set(prev);
            if (next.has(siteId)) next.delete(siteId);
            else next.add(siteId);
            notifyChange(next, showMutations);
            return next;
        });
    };

    const toggleAllBindingSites = (enable: boolean) => {
        const next = enable ? new Set(bindingSites.map((s) => s.id)) : new Set<string>();
        setEnabledBindingSites(next);
        notifyChange(next, showMutations);
    };

    const toggleMutations = () => {
        const next = !showMutations;
        setShowMutations(next);
        notifyChange(enabledBindingSites, next);
    };

    const handleClearAll = () => {
        setEnabledBindingSites(new Set());
        setShowMutations(false);
        onClear();
    };

    const hasAnyEnabled = enabledBindingSites.size > 0 || showMutations;

    return (
        <div className="text-xs">
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-700">Annotations</span>
                {hasAnyEnabled && (
                    <button onClick={handleClearAll} className="text-gray-400 hover:text-gray-600">
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
                        {expandedSections.has('bindingSites') ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        <span>Binding Sites ({bindingSites.length})</span>
                    </button>

                    {expandedSections.has('bindingSites') && (
                        <div className="ml-4 space-y-1">
                            <div className="flex items-center justify-between py-0.5 text-gray-400">
                                <span>Toggle all</span>
                                <div className="flex gap-1">
                                    <button onClick={() => toggleAllBindingSites(true)} className="hover:text-gray-600">
                                        <Eye size={12} />
                                    </button>
                                    <button onClick={() => toggleAllBindingSites(false)} className="hover:text-gray-600">
                                        <EyeOff size={12} />
                                    </button>
                                </div>
                            </div>

                            {bindingSites.map((site) => {
                                const isEnabled = enabledBindingSites.has(site.id);
                                const color = getBindingSiteColor(site);

                                return (
                                    <button
                                        key={site.id}
                                        onClick={() => toggleBindingSite(site.id)}
                                        className={`flex items-center gap-2 w-full py-1 px-1.5 rounded transition-colors ${isEnabled ? 'bg-gray-100' : 'hover:bg-gray-50'
                                            }`}
                                    >
                                        <div
                                            className="w-3 h-3 rounded-sm flex-shrink-0"
                                            style={{ backgroundColor: isEnabled ? color : '#e5e5e5' }}
                                        />
                                        <span className={isEnabled ? 'text-gray-800' : 'text-gray-500'}>
                                            {site.name}
                                        </span>
                                        <span className="text-gray-400 ml-auto">{site.positions.length} pos</span>
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
                        {expandedSections.has('mutations') ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        <span>Mutations ({mutations.length})</span>
                    </button>

                    {expandedSections.has('mutations') && (
                        <div className="ml-4">
                            <button
                                onClick={toggleMutations}
                                className={`flex items-center gap-2 w-full py-1 px-1.5 rounded transition-colors ${showMutations ? 'bg-gray-100' : 'hover:bg-gray-50'
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

                            {showMutations && (
                                <div className="mt-1 max-h-24 overflow-y-auto space-y-0.5 pl-5">
                                    {mutations.slice(0, 10).map((mut, idx) => (
                                        <div key={idx} className="text-gray-500">
                                            {mut.fromResidue}{mut.masterIndex + 1}{mut.toResidue}
                                            {mut.phenotype && <span className="text-gray-400 ml-1">- {mut.phenotype}</span>}
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

            {bindingSites.length === 0 && mutations.length === 0 && (
                <div className="text-gray-400 py-2">No annotations available</div>
            )}
        </div>
    );
}