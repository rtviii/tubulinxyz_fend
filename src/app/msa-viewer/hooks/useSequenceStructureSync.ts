// hooks/useSequenceStructureSync.ts
import { useState, useCallback } from 'react';

export type SequenceOrigin =
  | { type: 'master' }
  | { type: 'custom' }
  | {
      type: 'pdb';
      pdbId: string;
      chainId: string;
      positionMapping?: Record<number, number>;
    };

export interface SequenceEntry {
  id: string;
  name: string;
  sequence: string;
  rowIndex: number;
  origin: SequenceOrigin;
}

interface StructureInfo {
  pdbId: string;
  chainIds: string[];
}

// Interface for grouped sequences
export interface AddedSequenceGroup {
  title: string;
  sequences: SequenceEntry[];
}

export function useSequenceStructureRegistry() {
  const [sequences, setSequences] = useState<Map<string, SequenceEntry>>(new Map());
  const [structures, setStructures] = useState<Map<string, StructureInfo>>(new Map());

  const registerStructure = useCallback((pdbId: string, chainIds: string[]) => {
    setStructures(prev => {
      const next = new Map(prev);
      next.set(pdbId, { pdbId, chainIds });
      return next;
    });
  }, []);

  const addSequence = useCallback(
    (id: string, name: string, sequence: string, origin: SequenceOrigin) => {
      setSequences(prev => {
        const next = new Map(prev);
        // Re-calculate row index based on current size to ensure it's appended
        const rowIndex = next.size;
        // Check for duplicates
        if (next.has(id)) {
          console.warn(`Sequence with id ${id} already exists. Overwriting.`);
          // Find old row index to maintain it, if possible
          const oldEntry = next.get(id);
          const oldRowIndex = oldEntry ? oldEntry.rowIndex : rowIndex;
          next.set(id, { id, name, sequence, rowIndex: oldRowIndex, origin });
          return next;
        }
        next.set(id, { id, name, sequence, rowIndex, origin });
        return next;
      });
    },
    []
  );

  const removeSequence = useCallback((id: string) => {
    setSequences(prev => {
      const next = new Map(prev);
      next.delete(id);
      
      // Reindex remaining sequences
      let index = 0;
      const reindexed = new Map<string, SequenceEntry>();
      // Sort by original row index before re-indexing to maintain order
      Array.from(next.values())
        .sort((a, b) => a.rowIndex - b.rowIndex)
        .forEach((seq) => {
          reindexed.set(seq.id, { ...seq, rowIndex: index++ });
        });
      
      return reindexed;
    });
  }, []);

  const getOrderedSequences = useCallback(() => {
    return Array.from(sequences.values()).sort((a, b) => a.rowIndex - b.rowIndex);
  }, [sequences]);

  const getMasterSequences = useCallback(() => {
    return getOrderedSequences().filter(seq => seq.origin.type === 'master');
  }, [getOrderedSequences]);

  const getAddedSequences = useCallback(() => {
    return getOrderedSequences().filter(seq => seq.origin.type !== 'master');
  }, [getOrderedSequences]);

  const getPDBSequences = useCallback(() => {
    return getOrderedSequences().filter(seq => seq.origin.type === 'pdb');
  }, [getOrderedSequences]);

  const getCustomSequences = useCallback(() => {
    return getOrderedSequences().filter(seq => seq.origin.type === 'custom');
  }, [getOrderedSequences]);

  // This is the function that was added
  const getAddedSequenceGroups = useCallback((): AddedSequenceGroup[] => {
    const added = getAddedSequences();
    const pdbGroups: Record<string, SequenceEntry[]> = {};
    const customSequences: SequenceEntry[] = [];
  
    added.forEach(seq => {
      if (seq.origin.type === 'pdb') {
        const pdbId = seq.origin.pdbId;
        if (!pdbGroups[pdbId]) {
          pdbGroups[pdbId] = [];
        }
        pdbGroups[pdbId].push(seq);
      } else if (seq.origin.type === 'custom') {
        customSequences.push(seq);
      }
    });
  
    const groups: AddedSequenceGroup[] = [];
  
    // Add PDB groups, sorted by PDB ID
    Object.keys(pdbGroups).sort().forEach(pdbId => {
      groups.push({
        title: `Structure: ${pdbId}`,
        sequences: pdbGroups[pdbId],
      });
    });
  
    // Add Custom group
    if (customSequences.length > 0) {
      groups.push({
        title: 'Custom Sequences',
        sequences: customSequences,
      });
    }
  
    return groups;
  }, [getAddedSequences]);

  const getSequenceByRow = useCallback(
    (rowIndex: number): SequenceEntry | null => {
      const ordered = getOrderedSequences();
      return ordered[rowIndex] || null;
    },
    [getOrderedSequences]
  );

  const getSequenceById = useCallback(
    (id: string): SequenceEntry | null => {
      return sequences.get(id) || null;
    },
    [sequences]
  );

  const getSequenceByChain = useCallback(
    (pdbId: string, chainId: string): SequenceEntry | null => {
      for (const seq of sequences.values()) {
        if (seq.origin.type === 'pdb' && 
            seq.origin.pdbId === pdbId && 
            seq.origin.chainId === chainId) {
          return seq;
        }
      }
      return null;
    },
    [sequences]
  );

  const getSequencesByStructure = useCallback(
    (pdbId: string): SequenceEntry[] => {
      return Array.from(sequences.values()).filter(
        seq => seq.origin.type === 'pdb' && seq.origin.pdbId === pdbId
      );
    },
    [sequences]
  );

  const hasStructure = useCallback(
    (pdbId: string): boolean => {
      return structures.has(pdbId);
    },
    [structures]
  );

  const getStructureInfo = useCallback(
    (pdbId: string): StructureInfo | null => {
      return structures.get(pdbId) || null;
    },
    [structures]
  );

  const logState = useCallback(() => {
    console.group('🔬 Registry State');
    console.log('Total sequences:', sequences.size);
    console.log('Master sequences:', getMasterSequences().length);
    console.log('Added sequences:', getAddedSequences().length);
    console.log('  - PDB chains:', getPDBSequences().length);
    console.log('  - Custom:', getCustomSequences().length);
    console.log('Loaded structures:', structures.size);
    console.table(
      getOrderedSequences().map(seq => ({
        row: seq.rowIndex,
        id: seq.id,
        name: seq.name,
        type: seq.origin.type,
        pdbInfo: seq.origin.type === 'pdb' 
          ? `${seq.origin.pdbId}:${seq.origin.chainId}` 
          : '-'
      }))
    );
    console.groupEnd();
  }, [sequences, structures, getOrderedSequences, getMasterSequences, getAddedSequences, getPDBSequences, getCustomSequences]);

  return {
    sequences,
    structures,
    registerStructure,
    addSequence,
    removeSequence,
    getOrderedSequences,
    getMasterSequences,
    getAddedSequences,
    getPDBSequences,
    getCustomSequences,
    getAddedSequenceGroups, // <-- Make sure this is in the return object
    getSequenceByRow,
    getSequenceById,
    getSequenceByChain,
    getSequencesByStructure,
    hasStructure,
    getStructureInfo,
    logState,
  };
}