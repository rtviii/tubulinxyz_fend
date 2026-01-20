import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import {
  MolstarInstanceId,
  Component,
  PolymerComponent,
  LigandComponent,
  ComponentUIState,
} from '../core/types';

// ============================================================
// State Shape
// ============================================================

interface MolstarInstanceState {
  loadedStructure: string | null;
  structureRef: string | null;
  components: Record<string, Component>;
  componentStates: Record<string, ComponentUIState>;
  activeColorscheme: string | null;
}

interface MolstarInstancesState {
  instances: Record<MolstarInstanceId, MolstarInstanceState>;
}

// ============================================================
// Initial State
// ============================================================

const createEmptyInstanceState = (): MolstarInstanceState => ({
  loadedStructure: null,
  structureRef: null,
  components: {},
  componentStates: {},
  activeColorscheme: null,
});

const initialState: MolstarInstancesState = {
  instances: {
    structure: createEmptyInstanceState(),
    monomer: createEmptyInstanceState(),
    msalite: createEmptyInstanceState(),  // <-- Add this
  },
};

// ============================================================
// Helper to get component key
// ============================================================

export const getComponentKey = (component: Component): string => {
  if (component.type === 'polymer') {
    return component.chainId;
  }
  return component.uniqueKey;
};

// ============================================================
// Slice
// ============================================================

export const molstarInstancesSlice = createSlice({
  name: 'molstarInstances',
  initialState,
  reducers: {
    // --- Structure Loading ---
    setLoadedStructure: (
      state,
      action: PayloadAction<{
        instanceId: MolstarInstanceId;
        pdbId: string;
        structureRef: string;
      }>
    ) => {
      const { instanceId, pdbId, structureRef } = action.payload;
      state.instances[instanceId].loadedStructure = pdbId;
      state.instances[instanceId].structureRef = structureRef;
    },

    // --- Component Registration ---
    registerComponents: (
      state,
      action: PayloadAction<{
        instanceId: MolstarInstanceId;
        components: Component[];
      }>
    ) => {
      const { instanceId, components } = action.payload;
      const instance = state.instances[instanceId];

      for (const component of components) {
        const key = getComponentKey(component);
        instance.components[key] = component;
        instance.componentStates[key] = { visible: true, hovered: false };
      }
    },

    // --- Visibility ---
    setComponentVisibility: (
      state,
      action: PayloadAction<{
        instanceId: MolstarInstanceId;
        componentKey: string;
        visible: boolean;
      }>
    ) => {
      const { instanceId, componentKey, visible } = action.payload;
      const componentState = state.instances[instanceId].componentStates[componentKey];
      if (componentState) {
        componentState.visible = visible;
      }
    },

    // --- Hover ---
    setComponentHovered: (
      state,
      action: PayloadAction<{
        instanceId: MolstarInstanceId;
        componentKey: string;
        hovered: boolean;
      }>
    ) => {
      const { instanceId, componentKey, hovered } = action.payload;
      const componentState = state.instances[instanceId].componentStates[componentKey];
      if (componentState) {
        componentState.hovered = hovered;
      }
    },

    // --- Colorscheme ---
    setActiveColorscheme: (
      state,
      action: PayloadAction<{
        instanceId: MolstarInstanceId;
        colorschemeId: string | null;
      }>
    ) => {
      const { instanceId, colorschemeId } = action.payload;
      state.instances[instanceId].activeColorscheme = colorschemeId;
    },

    // --- Cleanup ---
    clearInstance: (state, action: PayloadAction<MolstarInstanceId>) => {
      state.instances[action.payload] = createEmptyInstanceState();
    },

    clearAllInstances: () => initialState,
  },
});

export const {
  setLoadedStructure,
  registerComponents,
  setComponentVisibility,
  setComponentHovered,
  setActiveColorscheme,
  clearInstance,
  clearAllInstances,
} = molstarInstancesSlice.actions;

export default molstarInstancesSlice.reducer;