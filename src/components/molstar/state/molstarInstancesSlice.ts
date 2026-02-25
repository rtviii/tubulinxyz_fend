import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import {
  MolstarInstanceId,
  ViewMode,
  Component,
  ComponentUIState,
  AlignedStructure,
  MonomerChainState,
  TubulinClassification,
} from '../core/types';

interface MolstarInstanceState {
  loadedStructure: string | null;
  structureRef: string | null;
  tubulinClassification: TubulinClassification;
  components: Record<string, Component>;
  componentStates: Record<string, ComponentUIState>;
  activeColorscheme: string | null;
  viewMode: ViewMode;
  activeMonomerChainId: string | null;
  monomerChainStates: Record<string, MonomerChainState>;
}

interface MolstarInstancesState {
  instances: Record<MolstarInstanceId, MolstarInstanceState>;
}

const createEmptyInstanceState = (): MolstarInstanceState => ({
  loadedStructure: null,
  structureRef: null,
  tubulinClassification: {},
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

export const getComponentKey = (component: Component): string =>
  component.type === 'polymer' ? component.chainId : component.uniqueKey;

export const molstarInstancesSlice = createSlice({
  name: 'molstarInstances',
  initialState,
  reducers: {
    setLoadedStructure: (
      state,
      action: PayloadAction<{
        instanceId: MolstarInstanceId;
        pdbId: string;
        structureRef: string;
        tubulinClassification: TubulinClassification;
      }>
    ) => {
      const { instanceId, pdbId, structureRef, tubulinClassification } = action.payload;
      state.instances[instanceId].loadedStructure = pdbId;
      state.instances[instanceId].structureRef = structureRef;
      state.instances[instanceId].tubulinClassification = tubulinClassification;
    },

    registerComponents: (
      state,
      action: PayloadAction<{ instanceId: MolstarInstanceId; components: Component[] }>
    ) => {
      const { instanceId, components } = action.payload;
      const instance = state.instances[instanceId];
      for (const component of components) {
        const key = getComponentKey(component);
        instance.components[key] = component;
        instance.componentStates[key] = { visible: true, hovered: false };
        if (component.type === 'polymer' && !instance.monomerChainStates[key]) {
          instance.monomerChainStates[key] = createEmptyMonomerChainState();
        }
      }
    },

    setComponentVisibility: (
      state,
      action: PayloadAction<{ instanceId: MolstarInstanceId; componentKey: string; visible: boolean }>
    ) => {
      const { instanceId, componentKey, visible } = action.payload;
      const s = state.instances[instanceId].componentStates[componentKey];
      if (s) s.visible = visible;
    },

    setComponentHovered: (
      state,
      action: PayloadAction<{ instanceId: MolstarInstanceId; componentKey: string; hovered: boolean }>
    ) => {
      const { instanceId, componentKey, hovered } = action.payload;
      const s = state.instances[instanceId].componentStates[componentKey];
      if (s) s.hovered = hovered;
    },

    setActiveColorscheme: (
      state,
      action: PayloadAction<{ instanceId: MolstarInstanceId; colorschemeId: string | null }>
    ) => {
      const { instanceId, colorschemeId } = action.payload;
      state.instances[instanceId].activeColorscheme = colorschemeId;
    },

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
      delete state.instances[instanceId].monomerChainStates[targetChainId]?.alignedStructures[alignedStructureId];
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
      if (aligned) aligned.visible = visible;
    },

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