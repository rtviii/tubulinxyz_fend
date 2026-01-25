// src/hooks/useAnnotationVisibility.ts
import { useCallback, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/store';
import {
    setMutationsVisible,
    toggleLigandSite,
    showAllLigands,
    hideAllLigands,
    selectChainData,
    selectChainVisibility,
} from '@/store/slices/annotationsSlice';

export function useAnnotationVisibility(chainKey: string) {
    const dispatch = useAppDispatch();

    const data = useAppSelector(state => selectChainData(state, chainKey));
    const visibility = useAppSelector(state => selectChainVisibility(state, chainKey));

    // Debug logging
    console.log(`[useAnnotationVisibility] ${chainKey}:`, {
        hasData: !!data,
        ligandSites: data?.ligandSites?.length ?? 0,
        mutations: data?.mutations?.length ?? 0,
        visibility: visibility,
    });

    const visibleLigandIds = useMemo(
        () => new Set(visibility?.visibleLigandIds ?? []),
        [visibility?.visibleLigandIds]
    );

    const actions = useMemo(() => ({
        setShowMutations: (visible: boolean) =>
            dispatch(setMutationsVisible({ chainKey, visible })),

        toggleLigand: (siteId: string) =>
            dispatch(toggleLigandSite({ chainKey, siteId })),

        showAll: () => dispatch(showAllLigands(chainKey)),

        hideAll: () => dispatch(hideAllLigands(chainKey)),

        clearAll: () => {
            dispatch(setMutationsVisible({ chainKey, visible: false }));
            dispatch(hideAllLigands(chainKey));
        },
    }), [dispatch, chainKey]);

    return {
        ligandSites: data?.ligandSites ?? [],
        mutations: data?.mutations ?? [],
        family: data?.family ?? null,
        showMutations: visibility?.showMutations ?? false,
        visibleLigandIds,
        ...actions,
    };
}