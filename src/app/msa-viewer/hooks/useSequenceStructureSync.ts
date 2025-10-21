// hooks/useSequenceStructureRegistry.ts
import { useState, useCallback, useEffect } from 'react';

export interface SequenceOrigin {
  type: 'master' | 'pdb' | 'custom';
  pdbId?: string;
  chainId?: string;
  viewerInstance?: 'main' | 'aux';
  positionMapping?: Record<number, number>; // ✨ NEW: MSA pos → original residue
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
  viewerInstance: 'main' | 'auxiliary';
  chains: string[]; // all chains in this structure
  loadedAt: number;
}

export function useSequenceStructureRegistry() {
  // Core data structures
  const [sequences, setSequences] = useState<Map<string, SequenceRecord>>(new Map());
  const [structures, setStructures] = useState<Map<string, StructureRecord>>(new Map());

  // Derived: Get sequences ordered by rowIndex for MSA display
  const getOrderedSequences = useCallback((): SequenceRecord[] => {
    return Array.from(sequences.values())
      .sort((a, b) => a.rowIndex - b.rowIndex);
  }, [sequences]);

  // Lookup: Get sequence by MSA row index
  const getSequenceByRow = useCallback((rowIndex: number): SequenceRecord | null => {
    return Array.from(sequences.values()).find(s => s.rowIndex === rowIndex) || null;
  }, [sequences]);

  // Lookup: Get sequence by PDB + Chain
  const getSequenceByChain = useCallback((pdbId: string, chainId: string): SequenceRecord | null => {
    return Array.from(sequences.values()).find(
      s => s.origin.type === 'pdb' && 
           s.origin.pdbId?.toUpperCase() === pdbId.toUpperCase() && 
           s.origin.chainId === chainId
    ) || null;
  }, [sequences]);

  // Lookup: Get all sequences from a specific structure
  const getSequencesByStructure = useCallback((pdbId: string): SequenceRecord[] => {
    return Array.from(sequences.values()).filter(
      s => s.origin.type === 'pdb' && s.origin.pdbId?.toUpperCase() === pdbId.toUpperCase()
    );
  }, [sequences]);

  // Register a structure when it's loaded into Molstar
  const registerStructure = useCallback((
    pdbId: string, 
    chains: string[], 
    viewerInstance: 'main' | 'auxiliary'
  ) => {
    const pdbIdUpper = pdbId.toUpperCase();
    
    setStructures(prev => {
      const next = new Map(prev);
      next.set(pdbIdUpper, {
        pdbId: pdbIdUpper,
        viewerInstance,
        chains,
        loadedAt: Date.now()
      });
      return next;
    });

    console.log(`📝 Registered structure ${pdbIdUpper} with ${chains.length} chains in ${viewerInstance} viewer`);
  }, []);

  // Add a sequence to the MSA
  const addSequence = useCallback((
    id: string,
    name: string,
    sequence: string,
    origin: SequenceOrigin
  ) => {
    setSequences(prev => {
      const next = new Map(prev);
      
      // Check if sequence already exists
      if (next.has(id)) {
        console.warn(`⚠️ Sequence ${id} already exists, skipping`);
        return prev;
      }

      const newRowIndex = next.size; // Append to end
      
      next.set(id, {
        id,
        name,
        sequence,
        rowIndex: newRowIndex,
        origin,
        addedAt: Date.now()
      });

      console.log(`✅ Added sequence ${id} at row ${newRowIndex}`, origin);
      return next;
    });
  }, []);

  // Remove a sequence and reindex
  const removeSequence = useCallback((id: string) => {
    setSequences(prev => {
      const next = new Map(prev);
      
      if (!next.has(id)) {
        console.warn(`⚠️ Sequence ${id} not found`);
        return prev;
      }

      next.delete(id);

      // Reindex remaining sequences
      const ordered = Array.from(next.values())
        .sort((a, b) => a.rowIndex - b.rowIndex);
      
      ordered.forEach((seq, idx) => {
        next.set(seq.id, { ...seq, rowIndex: idx });
      });

      console.log(`🗑️ Removed sequence ${id}, reindexed ${next.size} remaining sequences`);
      return next;
    });
  }, []);

  // Remove a structure and optionally its sequences
  const removeStructure = useCallback((pdbId: string, removeSequences: boolean = true) => {
    const pdbIdUpper = pdbId.toUpperCase();

    if (removeSequences) {
      // Get all sequences from this structure
      const seqsToRemove = Array.from(sequences.values()).filter(
        s => s.origin.type === 'pdb' && s.origin.pdbId?.toUpperCase() === pdbIdUpper
      );

      // Remove each sequence
      seqsToRemove.forEach(seq => removeSequence(seq.id));
      
      console.log(`🗑️ Removed ${seqsToRemove.length} sequences from structure ${pdbIdUpper}`);
    }

    setStructures(prev => {
      const next = new Map(prev);
      next.delete(pdbIdUpper);
      return next;
    });

    console.log(`🗑️ Removed structure ${pdbIdUpper}`);
  }, [sequences, removeSequence]);

  // Clear everything
  const clearAll = useCallback(() => {
    setSequences(new Map());
    setStructures(new Map());
    console.log(`🧹 Cleared all sequences and structures`);
  }, []);

  // Debug helper
  const logState = useCallback(() => {
    console.log('📊 Registry State:');
    console.log('  Structures:', Array.from(structures.keys()));
    console.log('  Sequences:', sequences.size);
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
    // State
    sequences,
    structures,
    
    // Getters
    getOrderedSequences,
    getSequenceByRow,
    getSequenceByChain,
    getSequencesByStructure,
    
    // Mutators
    registerStructure,
    addSequence,
    removeSequence,
    removeStructure,
    clearAll,
    
    // Debug
    logState
  };
}