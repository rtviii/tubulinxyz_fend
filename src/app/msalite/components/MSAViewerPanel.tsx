// src/app/msalite/components/MSAViewerPanel.tsx
'use client';

import { useRef, useCallback, useState } from 'react';
import { ResizableMSAContainer, ResizableMSAContainerHandle } from './ResizableMSAContainer';
import { MSAToolbar } from './MSAToolbar';
import { AnnotationPanel, AnnotationData, EnabledAnnotations } from './AnnotationPanel';
import { applyAnnotationColoring, clearAnnotationColoring } from '../services/annotationSyncService';
import { clearColorConfig } from '../services/msaColorService';
import { MolstarInstance } from '@/components/molstar/services/MolstarInstance';
import { PositionMapping } from '@/store/slices/sequence_registry';
import { Settings2, X } from 'lucide-react';

interface SequenceData {
    id: string;
    name: string;
    sequence: string;
    originType?: 'master' | 'pdb' | 'custom';
    family?: string;
}

interface MSAViewerPanelProps {
    sequences: SequenceData[];
    maxLength: number;
    annotations?: AnnotationData;
    activeSequenceId?: string;
    title?: string;
    onResidueHover?: (seqId: string, position: number) => void;
    onResidueLeave?: () => void;
    onResidueClick?: (seqId: string, position: number) => void;
    showToolbar?: boolean;
    showAnnotations?: boolean;
    compact?: boolean;
    // New props for Molstar sync
    molstarInstance?: MolstarInstance | null;
    chainId?: string;
    positionMapping?: PositionMapping | null;
}

export function MSAViewerPanel({
    sequences,
    maxLength,
    annotations = {},
    activeSequenceId,
    title,
    onResidueHover,
    onResidueLeave,
    onResidueClick,
    showToolbar = true,
    showAnnotations = true,
    compact = false,
    molstarInstance = null,
    chainId = '',
    positionMapping = null,
}: MSAViewerPanelProps) {
    const msaRef = useRef<ResizableMSAContainerHandle>(null);
    const [colorScheme, setColorScheme] = useState('clustal2');
    const [showAnnotationPanel, setShowAnnotationPanel] = useState(false);

    const activeSequenceIndex = activeSequenceId
        ? sequences.findIndex((s) => s.id === activeSequenceId)
        : 0;

    const triggerMsaRedraw = useCallback(() => {
  console.log('[MonomerMSAPanel] triggerMsaRedraw called');
  console.log('[MonomerMSAPanel] window.__nightingaleCustomColors:', window.__nightingaleCustomColors);
  console.log('[MonomerMSAPanel] msaRef.current:', msaRef.current);
  
  // Set color scheme and let it handle the redraw
  msaRef.current?.setColorScheme('custom-position');
  setColorScheme('custom-position');
  
  // Don't call redraw() separately - setColorScheme handles it
}, []);

    const handleSchemeChange = useCallback((scheme: string) => {
        clearColorConfig();
        molstarInstance?.restoreDefaultColors();
        setColorScheme(scheme);
        msaRef.current?.setColorScheme(scheme);
        msaRef.current?.redraw();
    }, [molstarInstance]);

    const handleJumpToRange = useCallback((start: number, end: number) => {
        msaRef.current?.jumpToRange(start, end);

        // Also focus Molstar on this range if we have mapping
        if (molstarInstance && chainId && positionMapping) {
            const startAuth = positionMapping[start];
            const endAuth = positionMapping[end];
            if (startAuth !== undefined && endAuth !== undefined) {
                molstarInstance.focusResidueRange(chainId, startAuth, endAuth);
            }
        }
    }, [molstarInstance, chainId, positionMapping]);

    const handleReset = useCallback(() => {
        clearAnnotationColoring(molstarInstance, () => {
            msaRef.current?.setColorScheme('clustal2');
            msaRef.current?.redraw();
            setColorScheme('clustal2');
        });
    }, [molstarInstance]);

    // const handleAnnotationsChange = useCallback((enabled: EnabledAnnotations) => {
    //     applyAnnotationColoring({
    //         annotations,
    //         enabled,
    //         positionMapping,
    //         chainId,
    //         activeSequenceIndex: activeSequenceIndex >= 0 ? activeSequenceIndex : 0,
    //         instance: molstarInstance,
    //         onMsaRedraw: triggerMsaRedraw,
    //     });
    // }, [annotations, positionMapping, chainId, activeSequenceIndex, molstarInstance, triggerMsaRedraw]);

    // const handleAnnotationsClear = useCallback(() => {
    //     clearAnnotationColoring(molstarInstance, () => {
    //         msaRef.current?.setColorScheme('clustal2');
    //         msaRef.current?.redraw();
    //         setColorScheme('clustal2');
    //     });
    // }, [molstarInstance]);

    const hasAnnotations = (annotations.bindingSites?.length ?? 0) > 0
        || (annotations.mutations?.length ?? 0) > 0;

    return (
        <div className="h-full flex flex-col bg-white">
            {/* Header */}
            <div className="flex-shrink-0 px-3 py-2 border-b bg-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {title && <span className="text-sm font-medium text-gray-700">{title}</span>}
                    <span className="text-xs text-gray-500">
                        {sequences.length} seq, {maxLength} pos
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    {showAnnotations && hasAnnotations && (
                        <button
                            onClick={() => setShowAnnotationPanel(!showAnnotationPanel)}
                            className={`p-1 rounded transition-colors ${showAnnotationPanel
                                ? 'bg-blue-100 text-blue-600'
                                : 'hover:bg-gray-100 text-gray-500'
                                }`}
                            title="Toggle annotations panel"
                        >
                            <Settings2 size={16} />
                        </button>
                    )}
                </div>
            </div>

            {/* Toolbar */}
            {showToolbar && (
                <div className="flex-shrink-0 px-3 py-1.5 border-b bg-gray-50/50">
                    <MSAToolbar
                        currentScheme={colorScheme}
                        maxLength={maxLength}
                        onSchemeChange={handleSchemeChange}
                        onJumpToRange={handleJumpToRange}
                        onReset={handleReset}
                        compact={compact}
                    />
                </div>
            )}

            {/* Main content */}
            <div className="flex-1 min-h-0 flex">
                <div className={`flex-1 min-w-0 p-2 ${showAnnotationPanel ? 'pr-0' : ''}`}>
                    <ResizableMSAContainer
                        ref={msaRef}
                        sequences={sequences}
                        maxLength={maxLength}
                        colorScheme={colorScheme}
                        onResidueHover={onResidueHover}
                        onResidueLeave={onResidueLeave}
                        onResidueClick={onResidueClick}
                    />
                </div>

                {showAnnotationPanel && (
                    <div className="w-56 flex-shrink-0 border-l bg-gray-50 p-3 overflow-y-auto">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-gray-600">Annotations</span>
                            <button
                                onClick={() => setShowAnnotationPanel(false)}
                                className="p-0.5 hover:bg-gray-200 rounded"
                            >
                                <X size={12} />
                            </button>
                        </div>
                        {/* <AnnotationPanel
                            annotations={annotations}
                            onChange={handleAnnotationsChange}
                            onClear={handleAnnotationsClear}
                        /> */}
                    </div>
                )}
            </div>
        </div>
    );
}
