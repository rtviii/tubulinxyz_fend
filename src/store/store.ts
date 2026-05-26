// src/store/store.ts
import { configureStore } from '@reduxjs/toolkit';
import { TypedUseSelectorHook, useDispatch, useSelector, useStore } from 'react-redux';

import { tubxz_api } from './tubxz_api';
import molstarInstancesReducer from '@/components/molstar/state/molstarInstancesSlice';
import structuresReducer from './slices/slice_structures';
import sequenceRegistryReducer from './slices/sequence_registry';
import annotationsReducer from './slices/annotationsSlice';
import annotationTracksReducer from './slices/annotationTracksSlice';
import chainFocusReducer from './slices/chainFocusSlice';
import colorOverridesReducer from './slices/colorOverridesSlice';
import assistantToastReducer from './slices/assistantToastSlice';

export const makeStore = () => {
  return configureStore({
    reducer: {
      molstarInstances: molstarInstancesReducer,
      annotations: annotationsReducer,
      annotationTracks: annotationTracksReducer,
      sequenceRegistry: sequenceRegistryReducer,
      chainFocus: chainFocusReducer,
      colorOverrides: colorOverridesReducer,
      structures_page: structuresReducer,
      assistantToast: assistantToastReducer,
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
