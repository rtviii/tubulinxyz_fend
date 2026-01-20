import { useState } from 'react';
import { MSADisplay } from './MSADisplay';
import { MolstarService } from '@/components/molstar/molstar_service';
import { useAppSelector, useAppStore } from '@/store/store';
import {
  selectMasterSequences,
  selectAddedSequenceGroups,
  selectPdbSequences,
  selectSequenceById,
  selectPositionMapping,
  MsaSequence
} from '@/store/slices/sequence_registry';
import { RootState } from '@/store/store';

interface MSAPanelProps {
  maxLength: number;
  areComponentsLoaded: boolean;
  mainService: MolstarService | null;
  setLastEventLog: (log: string | null) => void;
  onHoveredPositionChange: (position: number | null) => void;
}

export function MSAPanel({
  maxLength,
  areComponentsLoaded,
  mainService,
  setLastEventLog,
  onHoveredPositionChange,
}: MSAPanelProps) {
  const store = useAppStore();
  const [activeLabel, setActiveLabel] = useState<string | null>(null);

  const masterSequences = useAppSelector(selectMasterSequences);
  const addedSequenceGroups = useAppSelector(selectAddedSequenceGroups);

  const totalAddedSequences = addedSequenceGroups.reduce((acc, group) => acc + group.sequences.length, 0);

  // Transform to display format
  const masterForDisplay = masterSequences.map(seq => ({
    id: seq.id,
    name: seq.name,
    sequence: seq.sequence
  }));

  const groupsForDisplay = addedSequenceGroups.map(group => ({
    title: group.title,
    sequences: group.sequences.map(seq => ({
      id: seq.id,
      name: seq.name,
      sequence: seq.sequence
    }))
  }));

  const handleLabelClick = (label: string, sequenceId: string) => {
    setActiveLabel(label);
    const state = store.getState() as RootState;
    const seq = selectSequenceById(state, sequenceId);

    let logMsg = `Label clicked: "${label}"`;
    if (seq?.originType === 'pdb' && seq.chainRef) {
      logMsg += ` | ${seq.chainRef.pdbId} Chain ${seq.chainRef.chainId}`;
    } else if (seq?.originType === 'custom') {
      logMsg += ` | Custom sequence`;
    }
    setLastEventLog(logMsg);
  };

  const handleResidueClick = async (sequenceId: string, position0: number) => {
    const state = store.getState() as RootState;
    const seq = selectSequenceById(state, sequenceId);
    if (!seq) return;

    setActiveLabel(seq.name);

    const pdbSequences = selectPdbSequences(state);
    const focusTasks = [];
    const logParts = [`Residue clicked: "${seq.name}" | MSA Pos ${position0}`];

    for (const pdbSeq of pdbSequences) {
      if (pdbSeq.originType !== 'pdb' || !pdbSeq.chainRef) continue;

      const posMapping = selectPositionMapping(state, pdbSeq.id);
      if (!posMapping) continue;

      const originalResidue = posMapping[position0];

      if (originalResidue !== undefined && mainService?.controller) {
        const { pdbId, chainId } = pdbSeq.chainRef;
        logParts.push(`${pdbId}:${chainId}:${originalResidue}`);
        focusTasks.push(
          mainService.controller.focusChain(pdbId, chainId)
            .catch(error => console.error(`Failed to focus:`, error))
        );
      }
    }
    await Promise.all(focusTasks);
    setLastEventLog(logParts.join(' | '));
  };

  const handleResidueHover = async (sequenceId: string, position0: number) => {
    onHoveredPositionChange(position0 + 1);

    const state = store.getState() as RootState;
    const pdbSequences = selectPdbSequences(state);
    const highlightTasks = [];

    for (const seq of pdbSequences) {
      if (seq.originType !== 'pdb' || !seq.chainRef) continue;

      const posMapping = selectPositionMapping(state, seq.id);
      if (!posMapping) continue;

      const originalResidue = posMapping[position0];

      if (originalResidue !== undefined && mainService?.controller) {
        const { pdbId, chainId } = seq.chainRef;
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
        {areComponentsLoaded && (masterForDisplay.length > 0 || totalAddedSequences > 0) && maxLength > 0 ? (
          <MSADisplay
            masterSequences={masterForDisplay}
            addedSequenceGroups={groupsForDisplay}
            maxLength={maxLength}
            onLabelClick={handleLabelClick}
            onResidueClick={handleResidueClick}
            onResidueHover={handleResidueHover}
            onResidueLeave={handleResidueLeave}
            activeAnnotations={new Set()}
          />
        ) : (
          <div className="p-8 text-center text-gray-500">
            {masterForDisplay.length === 0 ? (
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
