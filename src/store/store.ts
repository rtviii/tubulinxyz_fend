import { configureStore } from '@reduxjs/toolkit';
import { TypedUseSelectorHook, useDispatch, useSelector, useStore } from 'react-redux';

import { tubxz_api } from './tubxz_api';

import molstarRefsReducer from './slices/molstar_refs';
import polymerStatesReducer from './slices/polymer_states';
import nonPolymerStatesReducer from './slices/nonpolymer_states';
import sequenceViewerReducer from './slices/sequence_viewer';
import sequenceStructureSyncReducer from './slices/sequence_structure_sync';
import interactionReducer from './slices/interaction_slice';
import structuresReducer from './slices/slice_structures';
import polymersReducer from './slices/slice_polymers';
import sequenceRegistryReducer from './slices/sequence_registry';

export const makeStore = () => {
  return configureStore({
    reducer: {
      molstarRefs: molstarRefsReducer,
      polymerStates: polymerStatesReducer,
      nonPolymerStates: nonPolymerStatesReducer,
      sequenceViewer: sequenceViewerReducer,
      sequenceStructureSync: sequenceStructureSyncReducer,
      interaction: interactionReducer,
      structures_page: structuresReducer,
      polymers_page: polymersReducer,
      sequenceRegistry: sequenceRegistryReducer,
      [tubxz_api.reducerPath]: tubxz_api.reducer,
    },
    middleware: getDefaultMiddleware =>
      getDefaultMiddleware({
        serializableCheck: false
      }).concat(tubxz_api.middleware)
  });
};

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
export const useAppStore: () => AppStore = useStore;
