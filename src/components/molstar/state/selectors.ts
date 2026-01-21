import { createSelector } from '@reduxjs/toolkit';
import { RootState } from '@/store/store';
import {
  MolstarInstanceId,
  ViewMode,
  Component,
  PolymerComponent,
  LigandComponent,
  isPolymerComponent,
  isLigandComponent,
  ComponentUIState,
  MonomerChainState,
  AlignedStructure,
} from '../core/types';

// ============================================================
// Base Selectors
// ============================================================

const selectMolstarInstances = (state: RootState) => state.molstarInstances.instances;

const selectInstance = (state: RootState, instanceId: MolstarInstanceId) =>
  state.molstarInstances.instances[instanceId];

// ============================================================
// Instance Selectors
// ============================================================

export const selectLoadedStructure = createSelector(
  [selectInstance],
  (instance) => instance?.loadedStructure ?? null
);

export const selectStructureRef = createSelector(
  [selectInstance],
  (instance) => instance?.structureRef ?? null
);

export const selectActiveColorscheme = createSelector(
  [selectInstance],
  (instance) => instance?.activeColorscheme ?? null
);

export const selectViewMode = createSelector(
  [selectInstance],
  (instance): ViewMode => instance?.viewMode ?? 'structure'
);

export const selectActiveMonomerChainId = createSelector(
  [selectInstance],
  (instance) => instance?.activeMonomerChainId ?? null
);

// ============================================================
// Component Selectors
// ============================================================

export const selectAllComponents = createSelector(
  [selectInstance],
  (instance): Component[] => (instance ? Object.values(instance.components) : [])
);

export const selectPolymerComponents = createSelector(
  [selectAllComponents],
  (components): PolymerComponent[] => components.filter(isPolymerComponent)
);

export const selectLigandComponents = createSelector(
  [selectAllComponents],
  (components): LigandComponent[] => components.filter(isLigandComponent)
);

export const selectComponentByKey = createSelector(
  [selectInstance, (_state: RootState, _instanceId: MolstarInstanceId, key: string) => key],
  (instance, key): Component | null => instance?.components[key] ?? null
);

// ============================================================
// UI State Selectors
// ============================================================

export const selectComponentState = createSelector(
  [selectInstance, (_state: RootState, _instanceId: MolstarInstanceId, key: string) => key],
  (instance, key): ComponentUIState => instance?.componentStates[key] ?? { visible: true, hovered: false }
);

export const selectVisibleComponents = createSelector(
  [selectInstance],
  (instance): Component[] => {
    if (!instance) return [];
    return Object.entries(instance.components)
      .filter(([key]) => instance.componentStates[key]?.visible)
      .map(([, component]) => component);
  }
);

// ============================================================
// Monomer Chain State Selectors
// ============================================================

export const selectMonomerChainState = createSelector(
  [selectInstance, (_state: RootState, _instanceId: MolstarInstanceId, chainId: string) => chainId],
  (instance, chainId): MonomerChainState | null => instance?.monomerChainStates[chainId] ?? null
);

export const selectAlignedStructures = createSelector(
  [selectMonomerChainState],
  (chainState): AlignedStructure[] => chainState ? Object.values(chainState.alignedStructures) : []
);

export const selectAlignedStructuresForActiveChain = createSelector(
  [selectInstance],
  (instance): AlignedStructure[] => {
    if (!instance || !instance.activeMonomerChainId) return [];
    const chainState = instance.monomerChainStates[instance.activeMonomerChainId];
    return chainState ? Object.values(chainState.alignedStructures) : [];
  }
);

// ============================================================
// Convenience Hooks Factory
// ============================================================

export const makeSelectorsForInstance = (instanceId: MolstarInstanceId) => ({
  selectLoadedStructure: (state: RootState) => selectLoadedStructure(state, instanceId),
  selectStructureRef: (state: RootState) => selectStructureRef(state, instanceId),
  selectActiveColorscheme: (state: RootState) => selectActiveColorscheme(state, instanceId),
  selectViewMode: (state: RootState) => selectViewMode(state, instanceId),
  selectActiveMonomerChainId: (state: RootState) => selectActiveMonomerChainId(state, instanceId),
  selectAllComponents: (state: RootState) => selectAllComponents(state, instanceId),
  selectPolymerComponents: (state: RootState) => selectPolymerComponents(state, instanceId),
  selectLigandComponents: (state: RootState) => selectLigandComponents(state, instanceId),
  selectComponentByKey: (state: RootState, key: string) => selectComponentByKey(state, instanceId, key),
  selectComponentState: (state: RootState, key: string) => selectComponentState(state, instanceId, key),
  selectMonomerChainState: (state: RootState, chainId: string) => selectMonomerChainState(state, instanceId, chainId),
  selectAlignedStructuresForActiveChain: (state: RootState) => selectAlignedStructuresForActiveChain(state, instanceId),
});