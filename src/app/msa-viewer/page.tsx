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

export default function MSAViewerPage() {
  const mainMolstarNodeRef = useRef<HTMLDivElement>(null);
  const masterSequencesInitialized = useRef(false);

  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const [lastEventLog, setLastEventLog] = useState<string | null>(null);
  const [hoveredPosition, setHoveredPosition] = useState<number | null>(null);

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
    console.log(`🎯 Mutation clicked: ${pdbId} ${chainId} @ position ${masterIndex}`);
    
    // 1. Zoom MSA to position (20 residue window)
    if ((window as any).__msaZoomToPosition) {
      (window as any).__msaZoomToPosition(masterIndex);
    }

    // 2. Get the sequence for this chain
    const seq = registry.getSequenceByChain(pdbId, chainId);
    if (!seq || seq.origin.type !== 'pdb') return;

    const { positionMapping } = seq.origin;
    if (!positionMapping) return;

    // 3. Convert master position to PDB residue number (0-indexed to actual)
    const pdbResidue = positionMapping[masterIndex - 1];
    
    if (pdbResidue !== undefined && mainService?.controller) {
      // 4. Focus on the residue in Molstar
      await mainService.controller.hoverResidue(pdbId, chainId, pdbResidue, true);
      await mainService.controller.focusChain(pdbId, chainId);
      
      setLastEventLog(`Focused on ${pdbId}:${chainId}:${pdbResidue} (MA pos ${masterIndex})`);
    }
  }, [mainService, registry]);

  const handleZoomToPosition = useCallback((position: number) => {
    console.log(`📍 Zooming to position: ${position}`);
  }, []);

  return (
    <div className="h-screen flex flex-col p-3 bg-gray-50">
      <div className="flex flex-row gap-3 mb-3" style={{ height: '40vh' }}>
        <div className="w-1/4 border rounded-lg bg-white">
          <div className="p-2 border-b bg-gray-50">
            <h2 className="text-sm font-semibold text-gray-800">Literature Annotations</h2>
          </div>
          <PositionAnnotationViewer hoveredPosition={hoveredPosition} />
        </div>

        <div className="w-3/4">
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

      <div className="flex-1 flex flex-row gap-3 min-h-0">
        <div className="w-1/3 flex flex-col gap-3">
          <ControlPanel
            molstarService={mainService}
            registry={registry}
            activeLabel={activeLabel}
            lastEventLog={lastEventLog}
            onMutationClick={handleMutationClick}
          />
        </div>

        <div className="w-2/3 h-full min-h-0">
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