// page.tsx
'use client';

import { useRef, useEffect, useCallback } from 'react';
import { MSAPanel } from './components/MSAPanel';
import { StructureViewerPanel } from './components/StructureViewerPanel';
import { useAlignmentData } from './hooks/useAlignmentData';
import { useNightingaleComponents } from './hooks/useNightingaleComponents';
import { useMolstarService } from '@/components/molstar/molstar_service';
import { useSequenceStructureRegistry } from './hooks/useSequenceStructureSync';

export default function MSAViewerPage() {
  const molstarNodeRef = useRef<HTMLDivElement>(null);
  const molstarNodeRef_secondary = useRef<HTMLDivElement>(null);

  // Track what's been loaded to prevent infinite loops
  const mainStructureLoaded = useRef(false);
  const auxStructureLoaded = useRef(false);
  const masterSequencesInitialized = useRef(false);

  // Initialize Molstar services
  const { service: mainService, isInitialized: mainInitialized } = useMolstarService(molstarNodeRef, 'main');
  const { service: auxService, isInitialized: auxInitialized } = useMolstarService(molstarNodeRef_secondary, 'auxiliary');

  // Original hooks
  const { alignmentData, maxLength, isLoading: loadingAlignment } = useAlignmentData();
  const { areLoaded: componentsLoaded } = useNightingaleComponents();

  // NEW: Centralized sequence-structure registry
  const registry = useSequenceStructureRegistry();

  // Load default structure into main viewer - ONCE
  useEffect(() => {
    if (!mainInitialized || !mainService?.controller || mainStructureLoaded.current) {
      return;
    }

    const loadDefault = async () => {
      try {
        console.log('🚀 Loading 5CJO into main viewer...');
        
        // Pass empty classification - we're not using tubulin preset here
        await mainService.controller.loadStructure('5CJO', {});
        
        // Get chains AFTER structure is loaded
        const chains = mainService.controller.getAllChains('5CJO');
        console.log(`📊 Found ${chains.length} chains:`, chains);
        
        if (chains.length > 0) {
          registry.registerStructure('5CJO', chains, 'main');
          mainStructureLoaded.current = true;
          console.log('✅ Successfully loaded 5CJO into main viewer');
        } else {
          console.warn('⚠️ No chains found in 5CJO');
        }
      } catch (error) {
        console.error('❌ Failed to load 5CJO:', error);
        // Reset flag to allow retry
        mainStructureLoaded.current = false;
      }
    };
    
    loadDefault();
  }, [mainInitialized, mainService]); // registry NOT in deps!

  // Load default structure into aux viewer - ONCE
  useEffect(() => {
    if (!auxInitialized || !auxService?.controller || auxStructureLoaded.current) {
      return;
    }

    const loadDefault = async () => {
      try {
        console.log('🚀 Loading 1JFF into auxiliary viewer...');
        
        await auxService.controller.loadStructure('1JFF', {});
        
        const chains = auxService.controller.getAllChains('1JFF');
        console.log(`📊 Found ${chains.length} chains:`, chains);
        
        if (chains.length > 0) {
          registry.registerStructure('1JFF', chains, 'auxiliary');
          auxStructureLoaded.current = true;
          console.log('✅ Successfully loaded 1JFF into auxiliary viewer');
        } else {
          console.warn('⚠️ No chains found in 1JFF');
        }
      } catch (error) {
        console.error('❌ Failed to load 1JFF:', error);
        auxStructureLoaded.current = false;
      }
    };
    
    loadDefault();
  }, [auxInitialized, auxService]); // registry NOT in deps!

  // Initialize sequences from master alignment - ONCE
  useEffect(() => {
    if (alignmentData.length === 0 || masterSequencesInitialized.current) {
      return;
    }

    console.log(`🧬 Initializing ${alignmentData.length} master sequences...`);
    
    alignmentData.forEach((seq) => {
      registry.addSequence(
        seq.name,
        seq.name,
        seq.sequence,
        { type: 'master' }
      );
    });
    
    masterSequencesInitialized.current = true;
    console.log(`✅ Initialized ${alignmentData.length} sequences from master alignment`);
  }, [alignmentData]); // registry NOT in deps!

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
          molstarNodeRef_secondary={molstarNodeRef_secondary}
          mainInitialized={mainInitialized}
          auxInitialized={auxInitialized}
          mainService={mainService}
          auxService={auxService}
          registry={registry}
        />
      </div>
    </div>
  );
}