// src/store/store.ts
import { configureStore } from '@reduxjs/toolkit';
import { TypedUseSelectorHook, useDispatch, useSelector, useStore } from 'react-redux';

import { tubxz_api } from './tubxz_api';
import molstarInstancesReducer from '@/components/molstar/state/molstarInstancesSlice';
import structuresReducer from './slices/slice_structures';
import polymersReducer from './slices/slice_polymers';
import sequenceRegistryReducer from './slices/sequence_registry';
import annotationsReducer from './slices/annotationsSlice';

export const makeStore = () => {
  return configureStore({
    reducer: {
      molstarInstances: molstarInstancesReducer,
      annotations: annotationsReducer,
      sequenceRegistry: sequenceRegistryReducer,
      structures_page: structuresReducer,
      polymers_page: polymersReducer,
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
