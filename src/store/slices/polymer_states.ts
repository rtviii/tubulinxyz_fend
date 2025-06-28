import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface PolymerState {
    pdbId: string;
    chainId: string;
    visible: boolean;
    selected: boolean;
    hovered: boolean;
}

interface PolymerStatesState {
    polymers: Record<string, PolymerState>; // key: `${pdbId}_${chainId}`
}

const initialState: PolymerStatesState = {
    polymers: {},
};

// Helper to create polymer key
const makePolymerKey = (pdbId: string, chainId: string) => `${pdbId}_${chainId}`;

export const polymerStatesSlice = createSlice({
    name: 'polymerStates',
    initialState,
    reducers: {
        initializePolymer: (state, action: PayloadAction<{ pdbId: string; chainId: string }>) => {
            const { pdbId, chainId } = action.payload;
            const key = makePolymerKey(pdbId, chainId);
            
            if (!state.polymers[key]) {
                state.polymers[key] = {
                    pdbId,
                    chainId,
                    visible: true,
                    selected: false,
                    hovered: false,
                };
            }
        },
        
        setPolymerVisibility: (state, action: PayloadAction<{ 
            pdbId: string; 
            chainId: string; 
            visible: boolean 
        }>) => {
            const { pdbId, chainId, visible } = action.payload;
            const key = makePolymerKey(pdbId, chainId);
            
            if (state.polymers[key]) {
                state.polymers[key].visible = visible;
            }
        },
        
        setPolymerSelected: (state, action: PayloadAction<{ 
            pdbId: string; 
            chainId: string; 
            selected: boolean 
        }>) => {
            const { pdbId, chainId, selected } = action.payload;
            const key = makePolymerKey(pdbId, chainId);
            
            if (state.polymers[key]) {
                state.polymers[key].selected = selected;
            }
        },
        
        setPolymerHovered: (state, action: PayloadAction<{ 
            pdbId: string; 
            chainId: string; 
            hovered: boolean 
        }>) => {
            const { pdbId, chainId, hovered } = action.payload;
            const key = makePolymerKey(pdbId, chainId);
            
            if (state.polymers[key]) {
                state.polymers[key].hovered = hovered;
            }
        },
        
        clearPolymersForStructure: (state, action: PayloadAction<string>) => {
            const pdbId = action.payload;
            Object.keys(state.polymers).forEach(key => {
                if (state.polymers[key].pdbId === pdbId) {
                    delete state.polymers[key];
                }
            });
        },
        
        clearAllPolymers: (state) => {
            state.polymers = {};
        },
    },
});

export const {
    initializePolymer,
    setPolymerVisibility,
    setPolymerSelected,
    setPolymerHovered,
    clearPolymersForStructure,
    clearAllPolymers,
} = polymerStatesSlice.actions;

// Selectors
export const selectPolymerState = (
    state: { polymerStates: PolymerStatesState }, 
    pdbId: string, 
    chainId: string
) => {
    const key = makePolymerKey(pdbId, chainId);
    return state.polymerStates.polymers[key];
};

export const selectPolymersForStructure = (
    state: { polymerStates: PolymerStatesState }, 
    pdbId: string
) => {
    return Object.values(state.polymerStates.polymers).filter(p => p.pdbId === pdbId);
};