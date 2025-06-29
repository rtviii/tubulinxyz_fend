import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface TubulinStructure {
    pdbId: string;
    title: string;
    description: string;
    resolution?: number;
    method?: string;
}

interface TubulinStructuresState {
    availableStructures: TubulinStructure[];
    selectedStructure: string | null;
    isLoading: boolean;
    error: string | null;
}

// Sample tubulin structures for the prototype
const SAMPLE_STRUCTURES: TubulinStructure[] = [
    {
        pdbId: '1JFF',
        title: 'Tubulin-Colchicine Complex',
        description: 'Structure of tubulin in complex with colchicine',
        resolution: 3.58,
        method: 'X-ray crystallography'
    },
    {
        pdbId: '1SA0',
        title: 'Tubulin-Stathmin Complex',
        description: 'Crystal structure of the tubulin-stathmin complex',
        resolution: 3.20,
        method: 'X-ray crystallography'
    },
    {
        pdbId: '3RYH',
        title: 'Tubulin-Vinblastine Complex',
        description: 'Structure of tubulin bound to vinblastine',
        resolution: 4.15,
        method: 'X-ray crystallography'
    },
    {
        pdbId: '4O2B',
        title: 'Tubulin-TN16 Complex',
        description: 'Crystal structure of tubulin in complex with TN16',
        resolution: 2.30,
        method: 'X-ray crystallography'
    },
    {
        pdbId: '6O2T',
        title: 'Acetylated Microtubules',
        description: 'Effects of alpha-tubulin acetylation on microtubule structure and stability.',
        resolution: 4.10,
        method: 'Electron Microscopy'
    }
];

const initialState: TubulinStructuresState = {
    availableStructures: SAMPLE_STRUCTURES,
    selectedStructure: null,
    isLoading: false,
    error: null,
};

export const tubulinStructuresSlice = createSlice({
    name: 'tubulinStructures',
    initialState,
    reducers: {
        selectStructure: (state, action: PayloadAction<string>) => {
            state.selectedStructure = action.payload;
            state.error = null;
        },
        clearSelection: (state) => {
            state.selectedStructure = null;
        },
        setLoading: (state, action: PayloadAction<boolean>) => {
            state.isLoading = action.payload;
        },
        setError: (state, action: PayloadAction<string | null>) => {
            state.error = action.payload;
            state.isLoading = false;
        },
    },
});

export const { selectStructure, clearSelection, setLoading, setError } = tubulinStructuresSlice.actions;

// Selectors
export const selectAvailableStructures = (state: { tubulinStructures: TubulinStructuresState }) => 
    state.tubulinStructures.availableStructures;

export const selectSelectedStructure = (state: { tubulinStructures: TubulinStructuresState }) => 
    state.tubulinStructures.selectedStructure;

export const selectSelectedStructureData = (state: { tubulinStructures: TubulinStructuresState }) => {
    const selected = state.tubulinStructures.selectedStructure;
    return selected ? state.tubulinStructures.availableStructures.find(s => s.pdbId === selected) : null;
};

export const selectIsLoading = (state: { tubulinStructures: TubulinStructuresState }) => 
    state.tubulinStructures.isLoading;

export const selectError = (state: { tubulinStructures: TubulinStructuresState }) => 
    state.tubulinStructures.error;