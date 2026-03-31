// src/hooks/useAnnotationVisibility.ts
import { useCallback, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/store';
import {
    setVariantsVisible,
    setModificationsVisible,
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

    const visibleLigandIds = useMemo(
        () => new Set(visibility?.visibleLigandIds ?? []),
        [visibility?.visibleLigandIds]
    );

    const actions = useMemo(() => ({
        setShowVariants: (visible: boolean) =>
            dispatch(setVariantsVisible({ chainKey, visible })),

        setShowModifications: (visible: boolean) =>
            dispatch(setModificationsVisible({ chainKey, visible })),

        toggleLigand: (siteId: string) =>
            dispatch(toggleLigandSite({ chainKey, siteId })),

        showAll: () => dispatch(showAllLigands(chainKey)),

        hideAll: () => dispatch(hideAllLigands(chainKey)),

        clearAll: () => {
            dispatch(setVariantsVisible({ chainKey, visible: false }));
            dispatch(setModificationsVisible({ chainKey, visible: false }));
            dispatch(hideAllLigands(chainKey));
        },
    }), [dispatch, chainKey]);

    return {
        ligandSites: data?.ligandSites ?? [],
        variants: data?.variants ?? [],
        modifications: data?.modifications ?? [],
        family: data?.family ?? null,
        showVariants: visibility?.showVariants ?? false,
        showModifications: visibility?.showModifications ?? false,
        visibleLigandIds,
        ...actions,
    };
}