import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../store';
import type { VariantType } from './annotationsSlice';

export interface ColorOverridesState {
  ligand: Record<string, string>;
  variant: Partial<Record<VariantType, string>>;
  modification: Record<string, string>;
}

const initialState: ColorOverridesState = {
  ligand: {},
  variant: {},
  modification: {},
};

interface KeyColorPayload<K extends string = string> {
  key: K;
  color: string;
}

export const colorOverridesSlice = createSlice({
  name: 'colorOverrides',
  initialState,
  reducers: {
    setLigandColorOverride(state, action: PayloadAction<KeyColorPayload>) {
      state.ligand[action.payload.key] = action.payload.color;
    },
    clearLigandColorOverride(state, action: PayloadAction<string>) {
      delete state.ligand[action.payload];
    },
    setVariantColorOverride(state, action: PayloadAction<KeyColorPayload<VariantType>>) {
      state.variant[action.payload.key] = action.payload.color;
    },
    clearVariantColorOverride(state, action: PayloadAction<VariantType>) {
      delete state.variant[action.payload];
    },
    setModificationColorOverride(state, action: PayloadAction<KeyColorPayload>) {
      state.modification[action.payload.key] = action.payload.color;
    },
    clearModificationColorOverride(state, action: PayloadAction<string>) {
      delete state.modification[action.payload];
    },
    clearAllColorOverrides() {
      return initialState;
    },
  },
});

export const {
  setLigandColorOverride,
  clearLigandColorOverride,
  setVariantColorOverride,
  clearVariantColorOverride,
  setModificationColorOverride,
  clearModificationColorOverride,
  clearAllColorOverrides,
} = colorOverridesSlice.actions;

export default colorOverridesSlice.reducer;

// Selectors
export const selectLigandOverrides = (state: RootState) => state.colorOverrides.ligand;
export const selectVariantOverrides = (state: RootState) => state.colorOverrides.variant;
export const selectModificationOverrides = (state: RootState) => state.colorOverrides.modification;

export const selectLigandColorOverride = (state: RootState, ligandId: string) =>
  state.colorOverrides.ligand[ligandId];
export const selectVariantColorOverride = (state: RootState, type: VariantType) =>
  state.colorOverrides.variant[type];
export const selectModificationColorOverride = (state: RootState, modType: string) =>
  state.colorOverrides.modification[modType];
