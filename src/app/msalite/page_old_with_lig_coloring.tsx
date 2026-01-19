// src/app/msalite/page.tsx
'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/store';
import { useGetMasterProfileMsaMasterGetQuery } from '@/store/tubxz_api';
import { addSequence, selectMasterSequences, selectAddedSequenceGroups } from '@/store/slices/sequence_registry';
import { useMolstarService } from '@/components/molstar/molstar_service';
import { MolstarNode } from '@/components/molstar/molstar_spec';
import { useNightingaleComponents } from '../msa-viewer/hooks/useNightingaleComponents';
import { MSALiteDisplay, MSALiteDisplayHandle } from './MSALiteDisplay';
import { MinimalPDBLoader } from './MinimalPDBLoader';
import { ColoringControls, ColoringMode } from './ColoringControls';
import { LigandSelector } from './LigandSelector';
import { useLigandColoring } from './hooks/useLigandColoring';

export default function MSALitePage() {
  const dispatch = useAppDispatch();
  const molstarNodeRef = useRef<HTMLDivElement>(null);
  const msaDisplayRef = useRef<MSALiteDisplayHandle>(null);
  const masterSequencesInitialized = useRef(false);

  const [eventLog, setEventLog] = useState<string>('Ready');
  const [coloringMode, setColoringMode] = useState<ColoringMode>('clustal');

  const { service: molstarService, isInitialized: molstarReady } = useMolstarService(molstarNodeRef, 'main');
  const { areLoaded: componentsLoaded } = useNightingaleComponents();

  const { data: masterData, isLoading: loadingMaster } = useGetMasterProfileMsaMasterGetQuery();

  const masterSequences = useAppSelector(selectMasterSequences);
  const addedGroups = useAppSelector(selectAddedSequenceGroups);

  // Ligand coloring hook
  const {
    availableLigands,
    selectedLigandIds,
    ligandColors,
    isLoading: ligandsLoading,
    toggleLigand,
    selectAllLigands,
    clearSelection: clearLigandSelection,
    selectedCount: selectedLigandCount,
  } = useLigandColoring({
    onColoringChanged: () => {
      // Only redraw if we're in ligand mode
      if (coloringMode === 'ligands') {
        msaDisplayRef.current?.redraw();
      }
    },
  });

  // Initialize master sequences
  useEffect(() => {
    if (!masterData?.sequences || masterSequencesInitialized.current) return;

    masterData.sequences.forEach((seq: any) => {
      const name = seq.id.split('|')[0];
      dispatch(addSequence({
        id: name,
        name: name,
        sequence: seq.sequence,
        originType: 'master',
      }));
    });

    masterSequencesInitialized.current = true;
  }, [masterData, dispatch]);

  const maxLength = masterData?.alignment_length ?? 0;

  // Transform sequences for display
  const masterForDisplay = masterSequences.map(seq => ({
    id: seq.id,
    name: seq.name,
    sequence: seq.sequence
  }));

  const addedForDisplay = addedGroups.flatMap(group =>
    group.sequences.map(seq => ({
      id: seq.id,
      name: seq.name,
      sequence: seq.sequence
    }))
  );

  const allSequences = [...masterForDisplay, ...addedForDisplay];

  // When switching to ligand mode, trigger a redraw
  useEffect(() => {
    if (coloringMode === 'ligands') {
      // Small delay to ensure mode switch is processed
      setTimeout(() => msaDisplayRef.current?.redraw(), 100);
    }
  }, [coloringMode]);

  // Hover/click handlers
  const handleResidueHover = useCallback(async (seqId: string, position: number) => {
    setEventLog(`Hover: ${seqId} @ pos ${position}`);
    if (molstarService?.controller) {
      await molstarService.controller.hoverResidue('', '', 0, false);
    }
  }, [molstarService]);

  const handleResidueLeave = useCallback(async () => {
    if (molstarService?.controller) {
      await molstarService.controller.hoverResidue('', '', 0, false);
    }
  }, [molstarService]);

  const handleResidueClick = useCallback((seqId: string, position: number) => {
    setEventLog(`Click: ${seqId} @ pos ${position}`);
  }, []);

  const isReady = componentsLoaded && !loadingMaster && maxLength > 0;

  return (
    <div className="h-screen flex flex-col p-3 bg-gray-50 gap-3">
      {/* Top: MSA + Controls */}
      <div className="flex gap-3" style={{ height: '55%' }}>
        {/* MSA Display */}
        {/* MSA Display */}
        {/* MSA Display */}
        <div className="flex-1 border rounded-lg bg-white p-2 flex flex-col min-w-0">
          <div className="text-xs font-medium text-gray-600 mb-1">
            MSA View ({allSequences.length} sequences, {maxLength} columns)
          </div>
          <div className="flex-1 min-h-0 overflow-x-auto">
            {isReady ? (
              <MSALiteDisplay
                ref={msaDisplayRef}
                sequences={allSequences}
                maxLength={maxLength}
                coloringMode={coloringMode}
                onResidueHover={handleResidueHover}
                onResidueLeave={handleResidueLeave}
                onResidueClick={handleResidueClick}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-2" />
                Loading...
              </div>
            )}
          </div>
        </div>

        {/* Right sidebar: Controls */}
        <div className="w-64 flex flex-col gap-3">
          {/* PDB Loader */}
          <div className="border rounded-lg bg-white p-2">
            <MinimalPDBLoader molstarService={molstarService} />
          </div>

          {/* Coloring Controls */}
          <div className="border rounded-lg bg-white p-2">
            <ColoringControls
              currentMode={coloringMode}
              onModeChange={setColoringMode}
              maxLength={maxLength}
              sequenceCount={allSequences.length}
            />
          </div>

          {/* Ligand Selector - only show when in ligand mode */}
          {coloringMode === 'ligands' && (
            <div className="border rounded-lg bg-white p-2 flex-1 overflow-hidden flex flex-col">
              <LigandSelector
                ligands={availableLigands}
                selectedIds={selectedLigandIds}
                ligandColors={ligandColors}
                onToggle={toggleLigand}
                onSelectAll={selectAllLigands}
                onClearAll={clearLigandSelection}
                isLoading={ligandsLoading}
              />
            </div>
          )}
        </div>
      </div>

      {/* Bottom: Molstar + Event Log */}
      <div className="flex-1 flex gap-3 min-h-0">
        <div className="flex-1 border rounded-lg bg-white p-2 flex flex-col">
          <div className="text-xs font-medium text-gray-600 mb-1">Structure Viewer</div>
          <div className="flex-1 relative bg-gray-100 rounded overflow-hidden">
            <MolstarNode ref={molstarNodeRef} />
            {!molstarReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100/75">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
              </div>
            )}
          </div>
        </div>

        {/* Event Log */}
        <div className="w-64 border rounded-lg bg-white p-2 flex flex-col">
          <div className="text-xs font-medium text-gray-600 mb-1">Event Log</div>
          <pre className="flex-1 text-xs bg-gray-50 p-2 rounded overflow-auto font-mono">
            {eventLog}
          </pre>
        </div>
      </div>
    </div>
  );
}