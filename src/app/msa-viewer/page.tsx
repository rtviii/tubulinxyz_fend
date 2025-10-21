// page.tsx
'use client';

import { useRef, useEffect } from 'react';
import { MSAPanel } from './components/MSAPanel';
import { StructureViewerPanel } from './components/StructureViewerPanel';
import { useAlignmentData } from './hooks/useAlignmentData';
import { useNightingaleComponents } from './hooks/useNightingaleComponents';
import { useMolstarService } from '@/components/molstar/molstar_service';
import { useSequenceStructureRegistry } from './hooks/useSequenceStructureSync';

export default function MSAViewerPage() {
  const molstarNodeRef = useRef<HTMLDivElement>(null);

  const mainStructureLoaded = useRef(false);
  const masterSequencesInitialized = useRef(false);

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
        await mainService.controller.loadStructure('5CJO', {});
        const chains = mainService.controller.getAllChains('5CJO');
        
        if (chains.length > 0) {
          registry.registerStructure('5CJO', chains);
          mainStructureLoaded.current = true;
        }
      } catch (error) {
        console.error('Failed to load 5CJO:', error);
        mainStructureLoaded.current = false;
      }
    };
    
    loadDefault();
  }, [mainInitialized, mainService]);

  useEffect(() => {
    if (alignmentData.length === 0 || masterSequencesInitialized.current) {
      return;
    }

    alignmentData.forEach((seq) => {
      registry.addSequence(seq.name, seq.name, seq.sequence, { type: 'master' });
    });
    
    masterSequencesInitialized.current = true;
  }, [alignmentData]);

  return (
    <div className="h-screen flex flex-col p-4 bg-gray-50">
      <h1 className="text-2xl font-bold mb-4">MSA & Structure Viewer</h1>
      
      <div className="flex-1 flex gap-4 min-h-0">
        <MSAPanel
          maxLength={maxLength}
          areComponentsLoaded={componentsLoaded}
          molstarService={mainService}
          registry={registry}
        />
        
        <StructureViewerPanel
          molstarNodeRef={molstarNodeRef}
          mainInitialized={mainInitialized}
          mainService={mainService}
          registry={registry}
        />
      </div>
    </div>
  );
}