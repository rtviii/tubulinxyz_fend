// page.tsx
'use client';

import { useRef, useEffect, useState } from 'react';
import { MSAPanel } from './components/MSAPanel';
import { StructureViewerPanel } from './components/StructureViewerPanel';
import { useAlignmentData } from './hooks/useAlignmentData';
import { useNightingaleComponents } from './hooks/useNightingaleComponents';
import { useMolstarService } from '@/components/molstar/molstar_service';
import { useSequenceStructureRegistry } from './hooks/useSequenceStructureSync';
import { createTubulinClassificationMap } from '@/services/gql_parser';
import { fetchRcsbGraphQlData } from '@/services/rcsb_graphql_service';
import { ControlPanel } from './ControlPanel';
import { AnnotationsLibrary } from './components/AnnotationsLibrary'; // New component

export default function MSAViewerPage() {
  const molstarNodeRef = useRef<HTMLDivElement>(null);

  const mainStructureLoaded = useRef(false);
  const masterSequencesInitialized = useRef(false);

  // State lifted from MSAPanel
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const [lastEventLog, setLastEventLog] = useState<string | null>(null);
  // New state for annotations
  const [activeAnnotations, setActiveAnnotations] = useState<Set<string>>(new Set());

  const { service: mainService, isInitialized: mainInitialized } = useMolstarService(molstarNodeRef, 'main');

  const { alignmentData, maxLength, isLoading: loadingAlignment } = useAlignmentData();
  const { areLoaded: componentsLoaded } = useNightingaleComponents();

  const registry = useSequenceStructureRegistry();

  useEffect(() => {
    if (!mainInitialized || !mainService?.controller || mainStructureLoaded.current) {
      return;
    }

    const loadDefault = async () => {
      try {
        const RCSB_ID = "5JCO"
        const normalizedPdbId = RCSB_ID.toUpperCase();
        const gqlData = await fetchRcsbGraphQlData(normalizedPdbId);
        const classification = createTubulinClassificationMap(gqlData);
        await mainService.controller.loadStructure(RCSB_ID, classification)
        const chains = mainService.controller.getAllChains(RCSB_ID);
        
        await mainService.viewer.representations.stylized_lighting()  

        if (chains.length > 0) {
          registry.registerStructure(RCSB_ID, chains);
          mainStructureLoaded.current =  true;
        }
      } catch (error) {
        console.error('Failed to load 5CJO:', error);
        mainStructureLoaded.current = false;
      }
    };
    
    loadDefault();
  }, [mainInitialized, mainService, registry]);

  useEffect(() => {
    if (alignmentData.length === 0 || masterSequencesInitialized.current || !registry) {
      return;
    }

    alignmentData.forEach((seq) => {
      registry.addSequence(seq.name, seq.name, seq.sequence, { type: 'master' });
    });
    
    masterSequencesInitialized.current = true;
  }, [alignmentData, registry]);

  return (
    <div className="h-screen flex flex-col p-3 bg-gray-50">
      
      {/* New top section with annotations library and MSA */}
      <div className="flex flex-row gap-3 mb-3" style={{ height: '40vh' }}>
        {/* Annotations Library - Left side */}
        <div className="w-1/4">
          <AnnotationsLibrary 
            activeAnnotations={activeAnnotations}
            setActiveAnnotations={setActiveAnnotations}
          />
        </div>
        
        {/* MSA Panel - Right side (reduced width) */}
        <div className="w-3/4">
          <MSAPanel
            maxLength={maxLength}
            areComponentsLoaded={componentsLoaded}
            molstarService={mainService}
            registry={registry}
            setActiveLabel={setActiveLabel}
            setLastEventLog={setLastEventLog}
            activeAnnotations={activeAnnotations} // Pass active annotations
          />
        </div>
      </div>
      
      {/* Bottom section with controls and structure viewer */}
      <div className="flex-1 flex flex-row gap-3 min-h-0">
        {/* Left Control Panel (1/3) */}
        <div className="w-1/3 flex flex-col gap-3">
          <ControlPanel
            molstarService={mainService}
            registry={registry}
            activeLabel={activeLabel}
            lastEventLog={lastEventLog}
          />
        </div>

        {/* Right Structure Viewer (2/3) */}
        <div className="w-2/3 h-full min-h-0">
          <StructureViewerPanel
            molstarNodeRef={molstarNodeRef}
            mainInitialized={mainInitialized}
            mainService={mainService}
            registry={registry}
          />
        </div>
      </div>
    </div>
  );
}