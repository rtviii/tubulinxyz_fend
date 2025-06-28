import { createSlice, PayloadAction } from '@reduxjs/toolkit';

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
    chemicalId: string;
}

export type Component = PolymerComponent | LigandComponent;

interface MolstarRefsState {
    // Map PDB ID to root structure reference
    structureRefs: Record<PdbId, MolstarRef>;
    
    // Map component ID to component data (flattened structure)
    components: Record<string, Component>;
    
    // Currently loaded structure
    currentStructure: PdbId | null;
}

const initialState: MolstarRefsState = {
    structureRefs: {},
    components: {},
    currentStructure: null,
};

export const molstarRefsSlice = createSlice({
    name: 'molstarRefs',
    initialState,
    reducers: {
        setStructureRef: (state, action: PayloadAction<{ pdbId: PdbId; ref: MolstarRef }>) => {
            const { pdbId, ref } = action.payload;
            state.structureRefs[pdbId] = ref;
            state.currentStructure = pdbId;
            
            // Initialize components for this structure if not exists
            if (!state.components[pdbId]) {
                state.components[pdbId] = {};
            }
        },
        
        addComponents: (state, action: PayloadAction<{ 
            pdbId: PdbId; 
            components: Record<string, Component> 
        }>) => {
            const { pdbId, components } = action.payload;
            // Add components directly to the flattened structure
            Object.assign(state.components, components);
        },
        
        clearStructure: (state, action: PayloadAction<PdbId>) => {
            const pdbId = action.payload;
            delete state.structureRefs[pdbId];
            
            // Remove components for this structure
            Object.keys(state.components).forEach(componentId => {
                if (state.components[componentId].pdbId === pdbId) {
                    delete state.components[componentId];
                }
            });
            
            if (state.currentStructure === pdbId) {
                state.currentStructure = null;
            }
        },
        
        clearAll: (state) => {
            state.structureRefs = {};
            state.components = {};
            state.currentStructure = null;
        },
    },
});

export const { setStructureRef, addComponents, clearStructure, clearAll } = molstarRefsSlice.actions;

// Selectors
export const selectCurrentStructure = (state: { molstarRefs: MolstarRefsState }) => 
    state.molstarRefs.currentStructure;

export const selectStructureRef = (state: { molstarRefs: MolstarRefsState }, pdbId: PdbId) => 
    state.molstarRefs.structureRefs[pdbId];

export const selectComponents = (state: { molstarRefs: MolstarRefsState }, pdbId: PdbId) => {
    return Object.values(state.molstarRefs.components).filter(comp => comp.pdbId === pdbId);
};

export const selectPolymerComponents = (state: { molstarRefs: MolstarRefsState }, pdbId: PdbId) => {
    return Object.values(state.molstarRefs.components)
        .filter((comp): comp is PolymerComponent => comp.type === 'polymer' && comp.pdbId === pdbId);
};;