import { useEffect, useCallback, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/store';
import {
    setChainAnnotations,
    setMutationsVisible,
    toggleLigandSite,
    showAllLigands,
    hideAllLigands,
    selectChainAnnotations,
    selectChainDisplayState,
    selectDisplayableLigandSites,
    selectVisibleLigandSites,
    selectDisplayableMutations,
} from '@/store/slices/annotationsSlice';
import { useGetChainAnnotationsQuery } from '@/store/tubxz_api';
import type { ChainAnnotations, DisplayableLigandSite, DisplayableMutation } from '@/lib/types/annotations';

interface UseChainAnnotationsResult {
    annotations: ChainAnnotations | null;
    ligandSites: DisplayableLigandSite[];
    visibleLigandSites: DisplayableLigandSite[];
    mutations: DisplayableMutation[];
    isLoading: boolean;
    error: string | null;
    showMutations: boolean;
    setShowMutations: (visible: boolean) => void;
    toggleLigand: (siteId: string) => void;
    showAllLigandSites: () => void;
    hideAllLigandSites: () => void;
    clearAll: () => void;
    isLigandVisible: (siteId: string) => boolean;
}

export function useChainAnnotations(
    rcsbId: string | null,
    authAsymId: string | null
): UseChainAnnotationsResult {
    const dispatch = useAppDispatch();
    const normalizedRcsbId = rcsbId?.toUpperCase() || '';
    const chainKey = normalizedRcsbId && authAsymId ? `${normalizedRcsbId}_${authAsymId}` : '';

    // RTK Query hook
    const { data, isLoading, error } = useGetChainAnnotationsQuery(
        { rcsbId: normalizedRcsbId, authAsymId: authAsymId || '' },
        { skip: !normalizedRcsbId || !authAsymId }
    );

    const processedRef = useRef<string | null>(null);

    useEffect(() => {
        // Log to verify keys (should be camelCase based on your Backend CamelModel)
        console.log(`[GATE 1] API Response for ${chainKey}:`, data);

        // FIX: The backend sends 'ligandSites', not 'ligand_sites'
        // Inside useChainAnnotations.ts -> useEffect

        if (data?.ligandSites && data?.mutations && chainKey && processedRef.current !== chainKey) {
            const converted: ChainAnnotations = {
                rcsbId: normalizedRcsbId,
                authAsymId: data.authAsymId,
                entityId: data.entityId,
                family: data.family,
                mutations: data.mutations.map((m: any) => ({
                    masterIndex: m.masterIndex,
                    fromResidue: m.fromResidue,
                    toResidue: m.toResidue,
                    phenotype: m.phenotype,
                    uniprotId: m.uniprotId,
                    species: m.species,
                    tubulinType: m.tubulinType,
                    keywords: m.keywords,
                    databaseSource: m.databaseSource,
                    referenceLink: m.referenceLink,
                })),
                // FIX: Use ligandSites (camelCase) from data
                // Inside src/hooks/useChainAnnotations.ts -> converted object

                ligandSites: data.ligandSites.map((ls: any) => ({
                    // FIX: Switch from ls.ligand_id to ls.ligandId
                    ligandId: ls.ligandId,
                    ligandName: ls.ligandName,
                    ligandChain: ls.ligandChain,
                    ligandAuthSeqId: ls.ligandAuthSeqId,
                    // Ensure these fall back to empty arrays if null/missing
                    neighborhoodAuthSeqIds: ls.neighborhoodAuthSeqIds || [],
                    interactions: (ls.interactions || []).map((ix: any) => ({
                        authSeqId: ix.authSeqId,
                        masterIndex: ix.masterIndex,
                        interactionType: ix.interactionType,
                        residueCompId: ix.residueCompId,
                        residueAtomId: ix.residueAtomId,
                    })),
                })),
                mutationCount: data.mutationCount,
                ligandCount: data.ligandCount,
                uniqueLigandTypes: data.uniqueLigandTypes,
            };

            console.log("FINAL MAPPING CHECK:", converted.ligandSites.map(ls => ({
                id: ls.ligandId,
                name: ls.ligandName,
                count: ls.neighborhoodAuthSeqIds.length
            })));
            dispatch(setChainAnnotations(converted));
            processedRef.current = chainKey;
        }
    }, [data, chainKey, dispatch, normalizedRcsbId]);

    const annotations = useAppSelector(state => selectChainAnnotations(state, chainKey));
    const displayState = useAppSelector(state => selectChainDisplayState(state, chainKey));
    const ligandSites = useAppSelector(state => selectDisplayableLigandSites(state, chainKey));
    const visibleLigandSites = useAppSelector(state => selectVisibleLigandSites(state, chainKey));
    const mutations = useAppSelector(state => selectDisplayableMutations(state, chainKey));

    const setShowMutations = useCallback((visible: boolean) => {
        if (chainKey) dispatch(setMutationsVisible({ chainKey, visible }));
    }, [dispatch, chainKey]);

    const toggleLigand = useCallback((siteId: string) => {
        if (chainKey) dispatch(toggleLigandSite({ chainKey, siteKey: siteId }));
    }, [dispatch, chainKey]);

    const showAllLigandSites = useCallback(() => {
        if (chainKey) dispatch(showAllLigands(chainKey));
    }, [dispatch, chainKey]);

    const hideAllLigandSites = useCallback(() => {
        if (chainKey) dispatch(hideAllLigands(chainKey));
    }, [dispatch, chainKey]);

    const clearAll = useCallback(() => {
        if (chainKey) {
            dispatch(setMutationsVisible({ chainKey, visible: false }));
            dispatch(hideAllLigands(chainKey));
        }
    }, [dispatch, chainKey]);

    const isLigandVisible = useCallback((siteId: string): boolean => {
        return displayState?.visibleLigandSites.includes(siteId) ?? false;
    }, [displayState]);

    return {
        annotations,
        ligandSites,
        visibleLigandSites,
        mutations,
        isLoading,
        error: error ? 'Failed to fetch annotations' : null,
        showMutations: displayState?.showMutations ?? false,
        setShowMutations,
        toggleLigand,
        showAllLigandSites,
        hideAllLigandSites,
        clearAll,
        isLigandVisible,
    };
}