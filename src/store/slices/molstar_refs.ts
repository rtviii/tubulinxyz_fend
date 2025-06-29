import { createSelector, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../store';

export type MolstarRef = string;
export type PdbId = string;
export type ChainId = string;
export type ComponentType = 'polymer' | 'ligand';

interface BaseComponent {
    type: ComponentType;
    pdbId: PdbId;
    ref: MolstarRef;
}

export interface PolymerComponent extends BaseComponent {
    type: 'polymer';
    chainId: ChainId;
}

export interface LigandComponent extends BaseComponent {
    type: 'ligand';
    uniqueKey: string;      
    compId: string;         
    auth_asym_id: string;   
    auth_seq_id: number;   
}


export type Component = PolymerComponent | LigandComponent;

interface MolstarRefsState {
    currentStructure: string | null;
    structureRefs: Record<string, string>; // pdbId -> ref
    components: Record<string, PolymerComponent | LigandComponent>; // uniqueId -> component
}

const initialState: MolstarRefsState = {
    currentStructure: null,
    structureRefs: {},
    components: {},
};

export const molstarRefsSlice = createSlice({
    name: 'molstarRefs',
    initialState,
    reducers: {
        setStructureRef: (state, action: PayloadAction<{ pdbId: string; ref: string }>) => {
            state.currentStructure = action.payload.pdbId;
            state.structureRefs[action.payload.pdbId] = action.payload.ref;
        },
        addComponents: (state, action: PayloadAction<{ pdbId: string; components: Record<string, PolymerComponent | LigandComponent> }>) => {
            for (const key in action.payload.components) {
                const uniqueId = `${action.payload.pdbId}_${key}`;
                state.components[uniqueId] = action.payload.components[key];
            }
        },
        clearStructure: (state, action: PayloadAction<string>) => {
            const pdbId = action.payload;
            if (state.currentStructure === pdbId) {
                state.currentStructure = null;
            }
            delete state.structureRefs[pdbId];
            Object.keys(state.components).forEach(key => {
                if (key.startsWith(`${pdbId}_`)) {
                    delete state.components[key];
                }
            });
        },
        clearAll: () => initialState,
    },
});

export const { setStructureRef, addComponents, clearStructure, clearAll } = molstarRefsSlice.actions;

// --- SELECTORS ---
export const selectComponentsForStructure = createSelector(
    [(state: RootState) => state.molstarRefs.components, (_state, pdbId: string) => pdbId],
    (components, pdbId) => {
        if (!pdbId) return [];
        return Object.values(components).filter(c => c.pdbId === pdbId);
    }
);

export default molstarRefsSlice.reducer;
