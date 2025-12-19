// src/app/msa-viewer/page.tsx
'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { MSAPanel } from './components/MSAPanel';
import { StructureViewerPanel } from './components/StructureViewerPanel';
import { useAlignmentData } from './hooks/useAlignmentData';
import { useNightingaleComponents } from './hooks/useNightingaleComponents';
import { useMolstarService } from '@/components/molstar/molstar_service';
import { useSequenceStructureRegistry } from './hooks/useSequenceStructureSync';
import { ControlPanel } from './ControlPanel';
import { PositionAnnotationViewer } from './PositionAnnotationViewer';
import { PolymerLigandPanel } from './components/PolymerLigandPanel';

export default function MSAViewerPage() {
  const mainMolstarNodeRef = useRef<HTMLDivElement>(null);
  const masterSequencesInitialized = useRef(false);

  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const [lastEventLog, setLastEventLog] = useState<string | null>(null);
  const [hoveredPosition, setHoveredPosition] = useState<number | null>(null);
  
  // Track selected polymer for ligand panel
  const [selectedPolymer, setSelectedPolymer] = useState<{ rcsb_id: string; auth_asym_id: string } | null>(null);

  const { service: mainService, isInitialized: mainInitialized } = useMolstarService(mainMolstarNodeRef, 'main');

  const { alignmentData, maxLength, isLoading: loadingAlignment } = useAlignmentData();
  const { areLoaded: componentsLoaded } = useNightingaleComponents();

  const registry = useSequenceStructureRegistry();

  useEffect(() => {
    if (alignmentData.length === 0 || masterSequencesInitialized.current || !registry) {
      return;
    }

    alignmentData.forEach((seq) => {
      registry.addSequence(seq.name, seq.name, seq.sequence, { type: 'master' });
    });

    masterSequencesInitialized.current = true;
  }, [alignmentData, registry]);

  const handleMutationClick = useCallback(async (pdbId: string, chainId: string, masterIndex: number) => {
    console.log(`Mutation clicked: ${pdbId} ${chainId} @ position ${masterIndex}`);
    
    // Update selected polymer for ligand panel
    setSelectedPolymer({ rcsb_id: pdbId, auth_asym_id: chainId });
    
    // Zoom MSA to position
    if ((window as any).__msaZoomToPosition) {
      (window as any).__msaZoomToPosition(masterIndex);
    }

    const seq = registry.getSequenceByChain(pdbId, chainId);
    if (!seq || seq.origin.type !== 'pdb') return;

    const { positionMapping } = seq.origin;
    if (!positionMapping) return;

    const pdbResidue = positionMapping[masterIndex - 1];
    
    if (pdbResidue !== undefined && mainService?.controller) {
      await mainService.controller.hoverResidue(pdbId, chainId, pdbResidue, true);
      await mainService.controller.focusChain(pdbId, chainId);
      
      setLastEventLog(`Focused on ${pdbId}:${chainId}:${pdbResidue} (MA pos ${masterIndex})`);
    }
  }, [mainService, registry]);

  // Handler for clicking interactions in the ligand panel
  const handleInteractionClick = useCallback((masterIndex: number) => {
    if ((window as any).__msaZoomToPosition) {
      (window as any).__msaZoomToPosition(masterIndex);
    }
    setHoveredPosition(masterIndex); // Also update annotation viewer
  }, []);

  const handleZoomToPosition = useCallback((position: number) => {
    console.log(`Zooming to position: ${position}`);
  }, []);

  // Update selected polymer when a chain is aligned
  const handleChainSelected = useCallback((pdbId: string, chainId: string) => {
    setSelectedPolymer({ rcsb_id: pdbId, auth_asym_id: chainId });
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
            areComponentsLoaded={componentsLoaded}
            mainService={mainService}
            registry={registry}
            setActiveLabel={setActiveLabel}
            setLastEventLog={setLastEventLog}
            onHoveredPositionChange={setHoveredPosition}
            onZoomToPosition={handleZoomToPosition}
          />
        </div>
      </div>

      {/* Bottom row: Controls + Ligand Panel + Structure */}
      <div className="flex-1 flex flex-row gap-3 min-h-0">
        {/* Control Panel */}
        <div className="w-1/4 flex flex-col gap-3">
          <ControlPanel
            molstarService={mainService}
            registry={registry}
            activeLabel={activeLabel}
            lastEventLog={lastEventLog}
            onMutationClick={handleMutationClick}
          />
        </div>

        {/* Ligand Panel */}
        <div className="w-1/4 border rounded-lg bg-white overflow-hidden">
          <PolymerLigandPanel
            rcsb_id={selectedPolymer?.rcsb_id || null}
            auth_asym_id={selectedPolymer?.auth_asym_id || null}
            onInteractionClick={handleInteractionClick}
          />
        </div>

        {/* Structure Viewer */}
        <div className="flex-1 h-full min-h-0">
          <StructureViewerPanel
            mainNodeRef={mainMolstarNodeRef}
            mainInitialized={mainInitialized}
            mainService={mainService}
            registry={registry}
          />
        </div>
      </div>
    </div>
  );
}