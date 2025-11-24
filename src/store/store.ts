// src/store/store.ts
'use client';
import { configureStore } from '@reduxjs/toolkit';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';

// Slices
import { tubulinStructuresSlice } from './slices/tubulin_structures';
import { molstarRefsSlice } from './slices/molstar_refs';
import { polymerStatesSlice } from './slices/polymer_states';
import { nonPolymerStatesSlice } from './slices/nonpolymer_states'; 
import sequenceViewerReducer from './slices/sequence_viewer';
import { sequenceStructureSyncSlice} from './slices/sequence_structure_sync';
import interactionReducer from './slices/interaction_slice';
import structuresReducer from './slices/slice_structures'; 
import polymersReducer from './slices/slice_polymers'; // <--- You need to create this file still!

// API - Now importing from the correct filename
import { tubxz_api } from './tubxz_api'; 

export const makeStore = () => {
    const store = configureStore({
        reducer: {
            tubulinStructures    : tubulinStructuresSlice.reducer,
            molstarRefs          : molstarRefsSlice.reducer,
            polymerStates        : polymerStatesSlice.reducer,
            nonPolymerStates     : nonPolymerStatesSlice.reducer,
            sequenceViewer       : sequenceViewerReducer,
            sequenceStructureSync: sequenceStructureSyncSlice.reducer,
            interaction          : interactionReducer,
            
            // Your new filter slices
            structures_page: structuresReducer,
            polymers_page: polymersReducer, // Uncomment once you create the file
            
            // The API
            [tubxz_api.reducerPath]: tubxz_api.reducer,
        },
        middleware: getDefaultMiddleware =>
            getDefaultMiddleware({
                serializableCheck: false 
            }).concat(tubxz_api.middleware)
    });

    return store;
};

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
