import { createSlice, PayloadAction, createSelector } from '@reduxjs/toolkit';
import { RootState } from '../store';

interface PolymerUIState {
    visible: boolean;
    selected: boolean;
    hovered: boolean;
}

interface PolymerStatesState {
    states: Record<string, PolymerUIState>; // key is `${pdbId}_${chainId}`
}

const initialState: PolymerStatesState = {
    states: {},
};

export const polymerStatesSlice = createSlice({
    name: 'polymerStates',
    initialState,
    reducers: {
        initializePolymer: (state, action: PayloadAction<{ pdbId: string; chainId: string }>) => {
            const key = `${action.payload.pdbId}_${action.payload.chainId}`;
            if (!state.states[key]) {
                state.states[key] = { visible: true, selected: false, hovered: false };
            }
        },
        setPolymerVisibility: (state, action: PayloadAction<{ pdbId: string; chainId: string; visible: boolean }>) => {
            const key = `${action.payload.pdbId}_${action.payload.chainId}`;
            if (state.states[key]) {
                state.states[key].visible = action.payload.visible;
            }
        },
        setPolymerHovered: (state, action: PayloadAction<{ pdbId: string; chainId: string; hovered: boolean }>) => {
            const key = `${action.payload.pdbId}_${action.payload.chainId}`;
            if (state.states[key]) {
                state.states[key].hovered = action.payload.hovered;
            }
        },
        clearPolymersForStructure: (state, action: PayloadAction<string>) => {
            const pdbId = action.payload;
            Object.keys(state.states).forEach(key => {
                if (key.startsWith(`${pdbId}_`)) {
                    delete state.states[key];
                }
            });
        },
        clearAllPolymers: () => initialState,
    },
});

export const { initializePolymer, setPolymerVisibility, setPolymerHovered, clearPolymersForStructure, clearAllPolymers } = polymerStatesSlice.actions;

// --- SELECTORS ---
export const selectPolymerState = createSelector(
    [(state: RootState) => state.polymerStates.states, (_state, props: { pdbId: string; chainId: string }) => props],
    (states, { pdbId, chainId }) => {
        const key = `${pdbId}_${chainId}`;
        return states[key] || { visible: true, selected: false, hovered: false };
    }
);

export default polymerStatesSlice.reducer;;