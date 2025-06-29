// src/store/slices/non_polymer_states.ts
import { createSlice, PayloadAction, createSelector } from '@reduxjs/toolkit';
import { RootState } from '../store';

interface NonPolymerUIState {
    visible: boolean;
    selected: boolean;
    hovered: boolean;
}

interface NonPolymerStatesState {
    states: Record<string, NonPolymerUIState>; // key is `${pdbId}_${chemId}`
}

const initialState: NonPolymerStatesState = {
    states: {},
};

export const nonPolymerStatesSlice = createSlice({
    name: 'nonPolymerStates',
    initialState,
    reducers: {
        initializeNonPolymer: (state, action: PayloadAction<{ pdbId: string; chemId: string }>) => {
            const key = `${action.payload.pdbId}_${action.payload.chemId}`;
            if (!state.states[key]) {
                state.states[key] = { visible: true, selected: false, hovered: false };
            }
        },
        setNonPolymerVisibility: (state, action: PayloadAction<{ pdbId: string; chemId: string; visible: boolean }>) => {
            const key = `${action.payload.pdbId}_${action.payload.chemId}`;
            if (state.states[key]) {
                state.states[key].visible = action.payload.visible;
            }
        },
        setNonPolymerHovered: (state, action: PayloadAction<{ pdbId: string; chemId: string; hovered: boolean }>) => {
            const key = `${action.payload.pdbId}_${action.payload.chemId}`;
            if (state.states[key]) {
                state.states[key].hovered = action.payload.hovered;
            }
        },
        clearNonPolymersForStructure: (state, action: PayloadAction<string>) => {
            const pdbId = action.payload;
            Object.keys(state.states).forEach(key => {
                if (key.startsWith(`${pdbId}_`)) {
                    delete state.states[key];
                }
            });
        },
        clearAllNonPolymers: () => initialState,
    },
});

export const {
    initializeNonPolymer,
    setNonPolymerVisibility,
    setNonPolymerHovered,
    clearNonPolymersForStructure,
    clearAllNonPolymers
} = nonPolymerStatesSlice.actions;

// --- SELECTORS ---
export const selectNonPolymerState = createSelector(
    [(state: RootState) => state.nonPolymerStates.states, (_state, props: { pdbId: string; chemId: string }) => props],
    (states, { pdbId, chemId }) => {
        const key = `${pdbId}_${chemId}`;
        return states[key] || { visible: true, selected: false, hovered: false };
    }
);

export default nonPolymerStatesSlice.reducer;