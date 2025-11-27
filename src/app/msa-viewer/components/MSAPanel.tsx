// src/app/msa-viewer/components/MSAPanel.tsx
import { useState, useRef, useCallback } from 'react';
import { MSADisplay } from './MSADisplay';
import { useSequenceStructureRegistry } from '../hooks/useSequenceStructureSync';
import { MolstarService } from '@/components/molstar/molstar_service';

interface MSAPanelProps {
  maxLength: number;
  areComponentsLoaded: boolean;
  mainService: MolstarService | null;
  registry: ReturnType<typeof useSequenceStructureRegistry>;
  setActiveLabel: (label: string | null) => void;
  setLastEventLog: (log: string | null) => void;
  onHoveredPositionChange: (position: number | null) => void;
  onZoomToPosition?: (position: number) => void;
}

export function MSAPanel({
  maxLength,
  areComponentsLoaded,
  mainService,
  registry,
  setActiveLabel,
  setLastEventLog,
  onHoveredPositionChange,
  onZoomToPosition
}: MSAPanelProps) {

  const [globalAnnotations, setGlobalAnnotations] = useState<Set<string>>(new Set());

  const masterSequences = registry.getMasterSequences().map(seq => ({
    id: seq.id,
    name: seq.name,
    sequence: seq.sequence
  }));

  const addedSequenceGroups = registry.getAddedSequenceGroups().map(group => ({
    title: group.title,
    sequences: group.sequences.map(seq => ({
      id: seq.id,
      name: seq.name,
      sequence: seq.sequence
    }))
  }));

  const totalAddedSequences = addedSequenceGroups.reduce((acc, group) => acc + group.sequences.length, 0);

  const handleLabelClick = (label: string, sequenceId: string) => {
    setActiveLabel(label);
    const seq = registry.getSequenceById(sequenceId);

    let logMsg = `Label clicked: "${label}"`;
    if (seq?.origin.type === 'pdb') {
      logMsg += ` | ${seq.origin.pdbId} Chain ${seq.origin.chainId}`;
    } else if (seq?.origin.type === 'custom') {
      logMsg += ` | Custom sequence`;
    }
    setLastEventLog(logMsg);
  };

  const handleResidueClick = async (sequenceId: string, position0: number) => {
    const seq = registry.getSequenceById(sequenceId);
    if (!seq) return;

    setActiveLabel(seq.name);

    const allPdbSequences = registry.getPDBSequences();
    const focusTasks = [];
    const logParts = [`Residue clicked: "${seq.name}" | MSA Pos ${position0}`];
    
    for (const pdbSeq of allPdbSequences) {
      if (pdbSeq.origin.type !== 'pdb') continue;
      const { pdbId, chainId, positionMapping } = pdbSeq.origin;
      
      if (!positionMapping) continue;
      
      const originalResidue = positionMapping[position0];
      
      if (originalResidue !== undefined && mainService?.controller) {
        logParts.push(`${pdbId}:${chainId}:${originalResidue}`);
        focusTasks.push(
          mainService.controller.focusChain(pdbId, chainId)
            .catch(error => console.error(`Failed to focus ${pdbId}:${chainId}:${originalResidue}:`, error))
        );
      }
    }
    await Promise.all(focusTasks);
    setLastEventLog(logParts.join(' | '));
  };

  const handleResidueHover = async (sequenceId: string, position0: number) => {
    onHoveredPositionChange(position0 + 1);

    const allPdbSequences = registry.getPDBSequences();
    const highlightTasks = [];

    for (const seq of allPdbSequences) {
      if (seq.origin.type !== 'pdb') continue;

      const { pdbId, chainId, positionMapping } = seq.origin;

      if (!positionMapping) continue;
      const originalResidue = positionMapping[position0];

      if (originalResidue !== undefined && mainService?.controller) {
        highlightTasks.push(
          mainService.controller.hoverResidue(pdbId, chainId, originalResidue, true)
            .catch(error => console.error(`Failed to highlight:`, error))
        );
      }
    }

    await Promise.all(highlightTasks);
  };

  const handleResidueLeave = async () => {
    onHoveredPositionChange(null);

    if (mainService?.controller) {
      await mainService.controller.hoverResidue('', '', 0, false)
        .catch(error => console.error('Failed to clear highlight:', error));
    }
  };

  return (
    <div className="w-full h-full border rounded-lg p-3 bg-white flex flex-col">
      <div className="flex-1 overflow-x-auto">
        {areComponentsLoaded && (masterSequences.length > 0 || totalAddedSequences > 0) && maxLength > 0 ? (
          <MSADisplay
            masterSequences={masterSequences}
            addedSequenceGroups={addedSequenceGroups}
            maxLength={maxLength}
            onLabelClick={handleLabelClick}
            onResidueClick={handleResidueClick}
            onResidueHover={handleResidueHover}
            onResidueLeave={handleResidueLeave}
            activeAnnotations={globalAnnotations}
            onZoomToPosition={onZoomToPosition}
          />
        ) : (
          <div className="p-8 text-center text-gray-500">
            {masterSequences.length === 0 ? (
               <>
                 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                 <p>Loading alignment...</p>
               </>
            ) : (
              <p>Load sequences to begin.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
