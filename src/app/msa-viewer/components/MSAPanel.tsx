// components/MSAPanel.tsx
import { MSADisplay } from './MSADisplay';
import { useSequenceStructureRegistry } from '../hooks/useSequenceStructureSync';
import { MolstarService } from '@/components/molstar/molstar_service';

interface MSAPanelProps {
  maxLength: number;
  areComponentsLoaded: boolean;
  molstarService: MolstarService | null;
  registry: ReturnType<typeof useSequenceStructureRegistry>;
  setActiveLabel: (label: string | null) => void;
  setLastEventLog: (log: string | null) => void;
  activeAnnotations: Set<string>;
}

export function MSAPanel({ 
  maxLength, 
  areComponentsLoaded, 
  molstarService, 
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
      logMsg += ` | ${seq.origin.pdbId} Chain ${seq.origin.chainId}`;
    } else if (seq?.origin.type === 'custom') {
      logMsg += ` | Custom sequence`;
    }
    setLastEventLog(logMsg);
  };

  const handleResidueClick = async (sequenceId: string, position: number) => {
    const seq = registry.getSequenceById(sequenceId);
    if (!seq) return;
    
    setActiveLabel(seq.name);
    let logMsg = `Residue clicked: "${seq.name}" | MSA Pos ${position}`;
    
    if (seq?.origin.type === 'pdb' && seq.origin.pdbId && seq.origin.chainId) {
      const { pdbId, chainId, positionMapping } = seq.origin;
      const originalResidue = positionMapping?.[position];
      
      if (originalResidue !== undefined && molstarService?.controller) {
        logMsg += ` -> ${pdbId}:${chainId}:${originalResidue}`;
        
        try {
          await molstarService.controller.focusOnResidues(pdbId, chainId, originalResidue, originalResidue);
        } catch (error) {
          console.error('Failed to focus in Molstar:', error);
        }
      } else {
        logMsg += ` -> ${pdbId}:${chainId} (gap)`;
      }
    }
    setLastEventLog(logMsg);
  };

  const handleResidueHover = async (sequenceId: string, position: number) => {
    const seq = registry.getSequenceById(sequenceId);
    if (!seq) return;
    
    let logMsg = `Residue hover: "${seq.name}" | MSA Pos ${position}`;
    
    if (seq?.origin.type === 'pdb' && seq.origin.pdbId && seq.origin.chainId) {
      const { pdbId, chainId, positionMapping } = seq.origin;
      const originalResidue = positionMapping?.[position];
      
      if (originalResidue !== undefined && molstarService?.controller) {
        logMsg += ` -> ${pdbId}:${chainId}:${originalResidue}`;
        
        try {
          await molstarService.controller.hoverResidue(pdbId, chainId, originalResidue, true);
        } catch (error) {
          console.error('Failed to highlight in Molstar:', error);
        }
      } else {
        logMsg += ` -> ${pdbId}:${chainId} (gap)`;
      }
    }
  };

  const handleResidueLeave = async () => {
    if (molstarService?.controller) {
      try {
        await molstarService.controller.hoverResidue('', '', 0, false);
      } catch (error) {
        console.error('Failed to clear Molstar highlight:', error);
      }
    }
  };

  return (
    <div className="w-full h-full border rounded-lg p-3 bg-white flex flex-col">
      {/* Simple header without annotation status */}
      <h2 className="text-lg font-semibold mb-2">Multiple Sequence Alignment</h2>
      
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
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p>Loading alignment...</p>
          </div>
        )}
      </div>
    </div>
  );
}
