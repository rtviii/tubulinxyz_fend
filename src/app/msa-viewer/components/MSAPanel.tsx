// components/MSAPanel.tsx
import { useState } from 'react';
import { MSADisplay } from './MSADisplay';
import { PDBSequenceExtractor } from './PDBSequenceExtractor';
import { CustomSequenceInput } from './CustomSequenceInput';
import { useSequenceStructureRegistry } from '../hooks/useSequenceStructureSync';

interface MSAPanelProps {
  maxLength: number;
  areComponentsLoaded: boolean;
  molstarService: any;
  registry: ReturnType<typeof useSequenceStructureRegistry>;
}

export function MSAPanel({ maxLength, areComponentsLoaded, molstarService, registry }: MSAPanelProps) {
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const [lastEventLog, setLastEventLog] = useState<string | null>(null);

  const alignmentData = registry.getOrderedSequences().map(seq => ({
    name: seq.name,
    sequence: seq.sequence
  }));

  const handleLabelClick = (label: string, rowIndex: number) => {
    setActiveLabel(label);
    const seq = registry.getSequenceByRow(rowIndex);
    
    let logMsg = `Label clicked: "${label}"`;
    if (seq?.origin.type === 'pdb') {
      logMsg += ` | ${seq.origin.pdbId} Chain ${seq.origin.chainId}`;
    }
    setLastEventLog(logMsg);
  };

  const handleResidueClick = async (sequenceName: string, rowIndex: number, position: number) => {
    setActiveLabel(sequenceName);
    const seq = registry.getSequenceByRow(rowIndex);
    
    let logMsg = `Residue clicked: "${sequenceName}" Row ${rowIndex} | MSA Pos ${position}`;
    
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

  const handleResidueHover = async (sequenceName: string, rowIndex: number, position: number) => {
    const seq = registry.getSequenceByRow(rowIndex);
    
    let logMsg = `Residue hover: "${sequenceName}" Row ${rowIndex} | MSA Pos ${position}`;
    
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
    
    setLastEventLog(logMsg);
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
    <div className="flex-1 h-full border rounded-lg p-4 bg-white flex flex-col">
      <h2 className="text-lg font-semibold mb-2">Alignment</h2>
      
      <div className="border rounded overflow-auto flex-1">
        {areComponentsLoaded && alignmentData.length > 0 && maxLength > 0 ? (
          <>
            <MSADisplay
              alignmentData={alignmentData}
              maxLength={maxLength}
              onLabelClick={handleLabelClick}
              onResidueClick={handleResidueClick}
              onResidueHover={handleResidueHover}
              onResidueLeave={handleResidueLeave}
            />
            
            <CustomSequenceInput registry={registry} />
            <PDBSequenceExtractor molstarService={molstarService} registry={registry} />

            <div className="mt-4 p-4 border-t text-left">
              <div className="mb-2">
                <span className="text-sm font-semibold text-gray-600">Active Sequence: </span>
                <span className="font-mono text-blue-600 font-bold">{activeLabel || "None"}</span>
              </div>
              <div>
                <span className="text-sm font-semibold text-gray-600">Last Event:</span>
                <pre className="text-sm text-gray-800 bg-gray-100 p-2 rounded mt-1 overflow-x-auto">
                  {lastEventLog || "No events yet"}
                </pre>
              </div>
            </div>
          </>
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
