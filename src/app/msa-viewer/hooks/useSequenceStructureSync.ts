// hooks/useSequenceStructureRegistry.ts
import { useState, useCallback } from 'react';

export interface SequenceOrigin {
  type: 'master' | 'pdb' | 'custom';
  pdbId?: string;
  chainId?: string;
  positionMapping?: Record<number, number>;
}

export interface SequenceRecord {
  id: string;
  name: string;
  sequence: string;
  rowIndex: number;
  origin: SequenceOrigin;
  addedAt: number;
}

export interface StructureRecord {
  pdbId: string;
  chains: string[];
  loadedAt: number;
}

export function useSequenceStructureRegistry() {
  const [sequences, setSequences] = useState<Map<string, SequenceRecord>>(new Map());
  const [structures, setStructures] = useState<Map<string, StructureRecord>>(new Map());

  const getOrderedSequences = useCallback((): SequenceRecord[] => {
    return Array.from(sequences.values()).sort((a, b) => a.rowIndex - b.rowIndex);
  }, [sequences]);

  const getSequenceByRow = useCallback((rowIndex: number): SequenceRecord | null => {
    return Array.from(sequences.values()).find(s => s.rowIndex === rowIndex) || null;
  }, [sequences]);

  const getSequenceByChain = useCallback((pdbId: string, chainId: string): SequenceRecord | null => {
    return Array.from(sequences.values()).find(
      s => s.origin.type === 'pdb' && 
           s.origin.pdbId?.toUpperCase() === pdbId.toUpperCase() && 
           s.origin.chainId === chainId
    ) || null;
  }, [sequences]);

  const getSequencesByStructure = useCallback((pdbId: string): SequenceRecord[] => {
    return Array.from(sequences.values()).filter(
      s => s.origin.type === 'pdb' && s.origin.pdbId?.toUpperCase() === pdbId.toUpperCase()
    );
  }, [sequences]);

  const registerStructure = useCallback((pdbId: string, chains: string[]) => {
    const pdbIdUpper = pdbId.toUpperCase();
    
    setStructures(prev => {
      const next = new Map(prev);
      next.set(pdbIdUpper, {
        pdbId: pdbIdUpper,
        chains,
        loadedAt: Date.now()
      });
      return next;
    });
  }, []);

  const addSequence = useCallback((
    id: string,
    name: string,
    sequence: string,
    origin: SequenceOrigin
  ) => {
    setSequences(prev => {
      const next = new Map(prev);
      
      if (next.has(id)) {
        return prev;
      }

      const newRowIndex = next.size;
      
      next.set(id, {
        id,
        name,
        sequence,
        rowIndex: newRowIndex,
        origin,
        addedAt: Date.now()
      });

      return next;
    });
  }, []);

  const removeSequence = useCallback((id: string) => {
    setSequences(prev => {
      const next = new Map(prev);
      
      if (!next.has(id)) {
        return prev;
      }

      next.delete(id);

      const ordered = Array.from(next.values()).sort((a, b) => a.rowIndex - b.rowIndex);
      ordered.forEach((seq, idx) => {
        next.set(seq.id, { ...seq, rowIndex: idx });
      });

      return next;
    });
  }, []);

  const removeStructure = useCallback((pdbId: string, removeSequences: boolean = true) => {
    const pdbIdUpper = pdbId.toUpperCase();

    if (removeSequences) {
      const seqsToRemove = Array.from(sequences.values()).filter(
        s => s.origin.type === 'pdb' && s.origin.pdbId?.toUpperCase() === pdbIdUpper
      );
      seqsToRemove.forEach(seq => removeSequence(seq.id));
    }

    setStructures(prev => {
      const next = new Map(prev);
      next.delete(pdbIdUpper);
      return next;
    });
  }, [sequences, removeSequence]);

  const clearAll = useCallback(() => {
    setSequences(new Map());
    setStructures(new Map());
  }, []);

  const logState = useCallback(() => {
    console.log('Registry State:');
    console.log('Structures:', Array.from(structures.keys()));
    console.log('Sequences:', sequences.size);
    console.table(Array.from(sequences.values()).map(s => ({
      row: s.rowIndex,
      id: s.id,
      name: s.name,
      type: s.origin.type,
      pdbId: s.origin.pdbId || '-',
      chain: s.origin.chainId || '-',
      length: s.sequence.length
    })));
  }, [sequences, structures]);

  return {
    sequences,
    structures,
    getOrderedSequences,
    getSequenceByRow,
    getSequenceByChain,
    getSequencesByStructure,
    registerStructure,
    addSequence,
    removeSequence,
    removeStructure,
    clearAll,
    logState
  };
}