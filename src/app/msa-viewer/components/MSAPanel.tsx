// src/app/msa-viewer/components/MSAPanel.tsx
import { MSADisplay } from './MSADisplay';
import { useSequenceStructureRegistry } from '../hooks/useSequenceStructureSync';
import { MolstarService } from '@/components/molstar/molstar_service';

interface MSAPanelProps {
  maxLength: number;
  areComponentsLoaded: boolean;
  mainService: MolstarService | null;
  auxiliaryService: MolstarService | null;
  registry: ReturnType<typeof useSequenceStructureRegistry>;
  setActiveLabel: (label: string | null) => void;
  setLastEventLog: (log: string | null) => void;
  activeAnnotations: Set<string>;
}

export function MSAPanel({
  maxLength,
  areComponentsLoaded,
  mainService,
  auxiliaryService,
  registry,
  setActiveLabel,
  setLastEventLog,
  activeAnnotations
}: MSAPanelProps) {

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
      const structureInfo = registry.getStructureInfo(seq.origin.pdbId);
      logMsg += ` | ${seq.origin.pdbId} Chain ${seq.origin.chainId} [${structureInfo?.viewerId || 'main'}]`;
    } else if (seq?.origin.type === 'custom') {
      logMsg += ` | Custom sequence`;
    }
    setLastEventLog(logMsg);
  };

  /**
   * Handle Residue Click
   * Expects 0-BASED MSA position
   */
  const handleResidueClick = async (sequenceId: string, position0: number) => {
    const seq = registry.getSequenceById(sequenceId);
    if (!seq) return;

    setActiveLabel(seq.name);

    // Broadcast click to ALL structures based on MSA column position
    const allPdbSequences = registry.getPDBSequences();
    const focusTasks = [];
    const logParts = [`Residue clicked: "${seq.name}" | MSA Pos ${position0}`];
    
    for (const pdbSeq of allPdbSequences) {
      if (pdbSeq.origin.type !== 'pdb') continue;
      const { pdbId, chainId, positionMapping } = pdbSeq.origin;
      const structureInfo = registry.getStructureInfo(pdbId);
      
      if (!positionMapping || !structureInfo) continue;
      
      // Lookup 0-based mapping
      const originalResidue = positionMapping[position0];
      
      if (originalResidue !== undefined) {
        const molstarService = structureInfo.viewerId === 'auxiliary' ? auxiliaryService : mainService;

        if (molstarService?.controller) {
          logParts.push(`${pdbId}:${chainId}:${originalResidue}[${structureInfo.viewerId}]`);
          focusTasks.push(
            molstarService.controller.focusChain(pdbId, chainId)
              .catch(error => console.error(`Failed to focus ${pdbId}:${chainId}:${originalResidue}:`, error))
          );
        }
      }
    }
    await Promise.all(focusTasks);
    setLastEventLog(logParts.join(' | '));
  };

  const handleResidueHover = async (sequenceId: string, position0: number) => {
    const allPdbSequences = registry.getPDBSequences();
    const highlightTasks = [];

    for (const seq of allPdbSequences) {
      if (seq.origin.type !== 'pdb') continue;

      const { pdbId, chainId, positionMapping } = seq.origin;
      const structureInfo = registry.getStructureInfo(pdbId);

      if (!positionMapping || !structureInfo) continue;
      const originalResidue = positionMapping[position0];

      if (originalResidue !== undefined) {
        if (seq.id === sequenceId) { 
        }

        const molstarService = structureInfo.viewerId === 'auxiliary' ? auxiliaryService : mainService;

        if (molstarService?.controller) {
          highlightTasks.push(
            molstarService.controller.hoverResidue(pdbId, chainId, originalResidue, true)
              .catch(error => console.error(`Failed to highlight:`, error))
          );
        }
      }
    }

    await Promise.all(highlightTasks);
  };

  const handleResidueLeave = async () => {
    const clearTasks = [];
    if (mainService?.controller) {
      clearTasks.push(
        mainService.controller.hoverResidue('', '', 0, false)
          .catch(error => console.error('Failed to clear main highlight:', error))
      );
    }

    if (auxiliaryService?.controller) {
      clearTasks.push(
        auxiliaryService.controller.hoverResidue('', '', 0, false)
          .catch(error => console.error('Failed to clear auxiliary highlight:', error))
      );
    }

    await Promise.all(clearTasks);
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
            activeAnnotations={activeAnnotations}
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
