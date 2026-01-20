import { createSelector } from '@reduxjs/toolkit';
import { RootState } from '@/store/store';
import {
  MolstarInstanceId,
  Component,
  PolymerComponent,
  LigandComponent,
  isPolymerComponent,
  isLigandComponent,
  ComponentUIState,
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
// Convenience Hooks Factory
// ============================================================

// These are designed to be used with useMemo in components
export const makeSelectorsForInstance = (instanceId: MolstarInstanceId) => ({
  selectLoadedStructure: (state: RootState) => selectLoadedStructure(state, instanceId),
  selectStructureRef: (state: RootState) => selectStructureRef(state, instanceId),
  selectActiveColorscheme: (state: RootState) => selectActiveColorscheme(state, instanceId),
  selectAllComponents: (state: RootState) => selectAllComponents(state, instanceId),
  selectPolymerComponents: (state: RootState) => selectPolymerComponents(state, instanceId),
  selectLigandComponents: (state: RootState) => selectLigandComponents(state, instanceId),
  selectComponentByKey: (state: RootState, key: string) => selectComponentByKey(state, instanceId, key),
  selectComponentState: (state: RootState, key: string) => selectComponentState(state, instanceId, key),
});