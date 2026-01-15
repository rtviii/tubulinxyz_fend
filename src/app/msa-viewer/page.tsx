'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { MSAPanel } from './components/MSAPanel';
import { StructureViewerPanel } from './components/StructureViewerPanel';
import { useNightingaleComponents } from './hooks/useNightingaleComponents';
import { useMolstarService } from '@/components/molstar/molstar_service';
import { ControlPanel } from './ControlPanel';
import { PositionAnnotationViewer } from './PositionAnnotationViewer';
import { PolymerLigandPanel } from './components/PolymerLigandPanel';
import { useAppDispatch, useAppSelector, useAppStore } from '@/store/store';
import { useGetMasterProfileMsaMasterGetQuery } from '@/store/tubxz_api';
import { addSequence, selectPositionMapping, selectSequenceByChain } from '@/store/slices/sequence_registry';

export default function MSAViewerPage() {
  const dispatch = useAppDispatch();
  const store = useAppStore();
  const mainMolstarNodeRef = useRef<HTMLDivElement>(null);
  const masterSequencesInitialized = useRef(false);

  const [lastEventLog, setLastEventLog] = useState<string | null>(null);
  const [hoveredPosition, setHoveredPosition] = useState<number | null>(null);
  const [selectedPolymer, setSelectedPolymer] = useState<{ rcsb_id: string; auth_asym_id: string } | null>(null);

  const { service: mainService, isInitialized: mainInitialized } = useMolstarService(mainMolstarNodeRef, 'main');
  const { areLoaded: componentsLoaded } = useNightingaleComponents();

  // Fetch master alignment via RTK Query
  const { data: masterData, isLoading: loadingMaster } = useGetMasterProfileMsaMasterGetQuery();

  // Initialize master sequences in Redux
  useEffect(() => {
    if (!masterData?.sequences || masterSequencesInitialized.current) return;

    masterData.sequences.forEach((seq: any) => {
      const name = seq.id.split("|")[0];
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

  // Handle chain selection from PDBSequenceExtractor
  const handleChainAligned = useCallback((pdbId: string, chainId: string) => {
    setSelectedPolymer({ rcsb_id: pdbId, auth_asym_id: chainId });
  }, []);

  // Handle interaction clicks from ligand panel
  const handleInteractionClick = useCallback((masterIndex: number) => {
    setHoveredPosition(masterIndex);
  }, []);

  return (
    <div className="h-screen flex flex-col p-3 bg-gray-50">
      {/* Top row: Annotations + MSA */}
      <div className="flex flex-row gap-3 mb-3" style={{ height: '40vh' }}>
        {/* Position Annotations Panel */}
        <div className="w-1/5 border rounded-lg bg-white flex flex-col">
          <div className="p-2 border-b bg-gray-50">
            <h2 className="text-sm font-semibold text-gray-800">Position Annotations</h2>
          </div>
          <div className="flex-1 overflow-hidden">
            <PositionAnnotationViewer 
              hoveredPosition={hoveredPosition} 
              family="tubulin_alpha"
            />
          </div>
        </div>

        {/* MSA Panel */}
        <div className="flex-1">
          <MSAPanel
            maxLength={maxLength}
            areComponentsLoaded={componentsLoaded && !loadingMaster}
            mainService={mainService}
            setLastEventLog={setLastEventLog}
            onHoveredPositionChange={setHoveredPosition}
          />
        </div>
      </div>

      {/* Bottom row: Controls + Ligand Panel + Structure */}
      <div className="flex-1 flex flex-row gap-3 min-h-0">
        {/* Control Panel */}
        <div className="w-1/4 flex flex-col gap-3">
          <ControlPanel
            molstarService={mainService}
            lastEventLog={lastEventLog}
            onChainAligned={handleChainAligned}
          />
        </div>

        {/* Ligand Panel */}
        <div className="w-1/4 border rounded-lg bg-white overflow-hidden">
          <PolymerLigandPanel
            rcsb_id={selectedPolymer?.rcsb_id || null}
            auth_asym_id={selectedPolymer?.auth_asym_id || null}
            molstarService={mainService}
            onInteractionClick={handleInteractionClick}
          />
        </div>

        {/* Structure Viewer */}
        <div className="flex-1 h-full min-h-0">
          <StructureViewerPanel
            mainNodeRef={mainMolstarNodeRef}
            mainInitialized={mainInitialized}
          />
        </div>
      </div>
    </div>
  );
}