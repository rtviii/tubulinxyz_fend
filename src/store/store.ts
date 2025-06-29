// src/store/store.ts
'use client';
import { configureStore } from '@reduxjs/toolkit';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import { tubulinStructuresSlice } from './slices/tubulin_structures';
import { molstarRefsSlice } from './slices/molstar_refs';
import { polymerStatesSlice } from './slices/polymer_states';
import { nonPolymerStatesSlice } from './slices/nonpolymer_states'; // Import the new slice

export const makeStore = () => {
    const store = configureStore({
        reducer: {
            tubulinStructures: tubulinStructuresSlice.reducer,
            molstarRefs: molstarRefsSlice.reducer,
            polymerStates: polymerStatesSlice.reducer,
            nonPolymerStates: nonPolymerStatesSlice.reducer, // Add the new reducer
        },
        middleware: getDefaultMiddleware =>
            getDefaultMiddleware({
                serializableCheck: false // Needed for Molstar objects
            })
    });

    return store;
};

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
