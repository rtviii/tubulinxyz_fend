import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import {
  MolstarInstanceId,
  ViewMode,
  Component,
  ComponentUIState,
  AlignedStructure,
  MonomerChainState,
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

  // View mode
  viewMode: ViewMode;
  activeMonomerChainId: string | null;

  // Per-chain monomer state
  monomerChainStates: Record<string, MonomerChainState>;
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
  viewMode: 'structure',
  activeMonomerChainId: null,
  monomerChainStates: {},
});

const createEmptyMonomerChainState = (): MonomerChainState => ({
  alignedStructures: {},
});

const initialState: MolstarInstancesState = {
  instances: {
    structure: createEmptyInstanceState(),
    monomer: createEmptyInstanceState(),
    msalite: createEmptyInstanceState(),
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

        // Initialize monomer chain state for polymers
        if (component.type === 'polymer' && !instance.monomerChainStates[key]) {
          instance.monomerChainStates[key] = createEmptyMonomerChainState();
        }
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

    // --- View Mode ---
    setViewMode: (
      state,
      action: PayloadAction<{
        instanceId: MolstarInstanceId;
        viewMode: ViewMode;
        activeChainId?: string | null;
      }>
    ) => {
      const { instanceId, viewMode, activeChainId } = action.payload;
      state.instances[instanceId].viewMode = viewMode;
      state.instances[instanceId].activeMonomerChainId = activeChainId ?? null;
    },

    // --- Aligned Structures ---
    addAlignedStructure: (
      state,
      action: PayloadAction<{
        instanceId: MolstarInstanceId;
        targetChainId: string;
        alignedStructure: AlignedStructure;
      }>
    ) => {
      const { instanceId, targetChainId, alignedStructure } = action.payload;
      const instance = state.instances[instanceId];

      if (!instance.monomerChainStates[targetChainId]) {
        instance.monomerChainStates[targetChainId] = createEmptyMonomerChainState();
      }

      instance.monomerChainStates[targetChainId].alignedStructures[alignedStructure.id] = alignedStructure;
    },

    removeAlignedStructure: (
      state,
      action: PayloadAction<{
        instanceId: MolstarInstanceId;
        targetChainId: string;
        alignedStructureId: string;
      }>
    ) => {
      const { instanceId, targetChainId, alignedStructureId } = action.payload;
      const chainState = state.instances[instanceId].monomerChainStates[targetChainId];
      if (chainState) {
        delete chainState.alignedStructures[alignedStructureId];
      }
    },

    setAlignedStructureVisibility: (
      state,
      action: PayloadAction<{
        instanceId: MolstarInstanceId;
        targetChainId: string;
        alignedStructureId: string;
        visible: boolean;
      }>
    ) => {
      const { instanceId, targetChainId, alignedStructureId, visible } = action.payload;
      const aligned = state.instances[instanceId].monomerChainStates[targetChainId]?.alignedStructures[alignedStructureId];
      if (aligned) {
        aligned.visible = visible;
      }
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
  setViewMode,
  addAlignedStructure,
  removeAlignedStructure,
  setAlignedStructureVisibility,
  clearInstance,
  clearAllInstances,
} = molstarInstancesSlice.actions;

export default molstarInstancesSlice.reducer;