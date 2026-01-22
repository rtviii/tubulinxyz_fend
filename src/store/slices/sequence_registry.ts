// src/store/slices/sequence_registry.ts
import { createSlice, PayloadAction, createSelector } from '@reduxjs/toolkit';
import { RootState } from '../store';

export interface ChainRef {
  pdbId: string;
  chainId: string;
}

export type SequenceOriginType = 'master' | 'custom' | 'pdb';

export interface MsaSequence {
  id: string;
  name: string;
  sequence: string;
  rowIndex: number;
  originType: SequenceOriginType;
  chainRef?: ChainRef;
  family?: string;
}

export type PositionMapping = Record<number, number>;

interface SequenceRegistryState {
  sequences: Record<string, MsaSequence>;
  positionMappings: Record<string, PositionMapping>;
  nextRowIndex: number;
}

const initialState: SequenceRegistryState = {
  sequences: {},
  positionMappings: {},
  nextRowIndex: 0,
};

export const sequenceRegistrySlice = createSlice({
  name: 'sequenceRegistry',
  initialState,
  reducers: {
    addSequence: (state, action: PayloadAction<{
      id: string;
      name: string;
      sequence: string;
      originType: SequenceOriginType;
      chainRef?: ChainRef;
      family?: string;
    }>) => {
      const { id, name, sequence, originType, chainRef, family } = action.payload;
      const existingRowIndex = state.sequences[id]?.rowIndex;

      state.sequences[id] = {
        id,
        name,
        sequence,
        rowIndex: existingRowIndex ?? state.nextRowIndex,
        originType,
        chainRef,
        family,
      };

      if (existingRowIndex === undefined) {
        state.nextRowIndex += 1;
      }
    },

    setPositionMapping: (state, action: PayloadAction<{
      sequenceId: string;
      mapping: PositionMapping;
    }>) => {
      state.positionMappings[action.payload.sequenceId] = action.payload.mapping;
    },

    removeSequence: (state, action: PayloadAction<string>) => {
      const id = action.payload;
      delete state.sequences[id];
      delete state.positionMappings[id];

      const sorted = Object.values(state.sequences).sort((a, b) => a.rowIndex - b.rowIndex);
      sorted.forEach((seq, idx) => {
        state.sequences[seq.id].rowIndex = idx;
      });
      state.nextRowIndex = sorted.length;
    },

    clearPdbSequences: (state) => {
      Object.keys(state.sequences).forEach(id => {
        if (state.sequences[id].originType === 'pdb') {
          delete state.sequences[id];
          delete state.positionMappings[id];
        }
      });

      const sorted = Object.values(state.sequences).sort((a, b) => a.rowIndex - b.rowIndex);
      sorted.forEach((seq, idx) => {
        state.sequences[seq.id].rowIndex = idx;
      });
      state.nextRowIndex = sorted.length;
    },

    clearAllSequences: () => initialState,
  },
});

export const {
  addSequence,
  setPositionMapping,
  removeSequence,
  clearPdbSequences,
  clearAllSequences,
} = sequenceRegistrySlice.actions;

// ============================================================
// STABLE EMPTY REFERENCES - Critical for selector stability
// ============================================================

const EMPTY_SEQUENCES: Record<string, MsaSequence> = {};
const EMPTY_MAPPINGS: Record<string, PositionMapping> = {};
const EMPTY_SEQUENCE_ARRAY: MsaSequence[] = [];
const EMPTY_GROUPS: { title: string; sequences: MsaSequence[] }[] = [];

// ============================================================
// Base Selectors - Return stable references
// ============================================================

const selectSequencesMap = (state: RootState): Record<string, MsaSequence> => 
  state.sequenceRegistry?.sequences ?? EMPTY_SEQUENCES;

const selectPositionMappingsMap = (state: RootState): Record<string, PositionMapping> => 
  state.sequenceRegistry?.positionMappings ?? EMPTY_MAPPINGS;

// ============================================================
// Derived Selectors
// ============================================================

export const selectOrderedSequences = createSelector(
  [selectSequencesMap],
  (sequences): MsaSequence[] => {
    const values = Object.values(sequences);
    if (values.length === 0) return EMPTY_SEQUENCE_ARRAY;
    return values.sort((a, b) => a.rowIndex - b.rowIndex);
  }
);

export const selectMasterSequences = createSelector(
  [selectOrderedSequences],
  (sequences): MsaSequence[] => {
    const filtered = sequences.filter(s => s.originType === 'master');
    if (filtered.length === 0) return EMPTY_SEQUENCE_ARRAY;
    return filtered;
  }
);

export const selectPdbSequences = createSelector(
  [selectOrderedSequences],
  (sequences): MsaSequence[] => {
    const filtered = sequences.filter(s => s.originType === 'pdb');
    if (filtered.length === 0) return EMPTY_SEQUENCE_ARRAY;
    return filtered;
  }
);

export const selectAddedSequenceGroups = createSelector(
  [selectOrderedSequences],
  (sequences) => {
    const added = sequences.filter(s => s.originType !== 'master');
    if (added.length === 0) return EMPTY_GROUPS;

    const pdbGroups: Record<string, MsaSequence[]> = {};
    const customSeqs: MsaSequence[] = [];

    added.forEach(seq => {
      if (seq.originType === 'pdb' && seq.chainRef) {
        const pdbId = seq.chainRef.pdbId;
        if (!pdbGroups[pdbId]) pdbGroups[pdbId] = [];
        pdbGroups[pdbId].push(seq);
      } else if (seq.originType === 'custom') {
        customSeqs.push(seq);
      }
    });

    const groups: { title: string; sequences: MsaSequence[] }[] = [];

    Object.keys(pdbGroups).sort().forEach(pdbId => {
      groups.push({ title: `Structure: ${pdbId}`, sequences: pdbGroups[pdbId] });
    });

    if (customSeqs.length > 0) {
      groups.push({ title: 'Custom Sequences', sequences: customSeqs });
    }

    return groups;
  }
);

// ============================================================
// Parameterized Selectors
// ============================================================

export const selectSequenceById = createSelector(
  [selectSequencesMap, (_state: RootState, id: string) => id],
  (sequences, id): MsaSequence | null => sequences[id] ?? null
);

export const selectSequenceByChain = createSelector(
  [
    selectSequencesMap, 
    (_state: RootState, pdbId: string, _chainId: string) => pdbId, 
    (_state: RootState, _pdbId: string, chainId: string) => chainId
  ],
  (sequences, pdbId, chainId): MsaSequence | null => {
    return Object.values(sequences).find(
      s => s.originType === 'pdb' &&
        s.chainRef?.pdbId === pdbId &&
        s.chainRef?.chainId === chainId
    ) ?? null;
  }
);

export const selectPositionMapping = createSelector(
  [selectPositionMappingsMap, (_state: RootState, sequenceId: string) => sequenceId],
  (mappings, sequenceId): PositionMapping | null => mappings[sequenceId] ?? null
);

export const selectIsChainAligned = createSelector(
  [
    selectSequencesMap, 
    (_state: RootState, pdbId: string, _chainId: string) => pdbId, 
    (_state: RootState, _pdbId: string, chainId: string) => chainId
  ],
  (sequences, pdbId, chainId): boolean => {
    return Object.values(sequences).some(
      s => s.originType === 'pdb' &&
        s.chainRef?.pdbId === pdbId &&
        s.chainRef?.chainId === chainId
    );
  }
);

export default sequenceRegistrySlice.reducer;