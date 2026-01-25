// src/hooks/useChainAnnotations.ts
import { useEffect, useCallback, useRef, useMemo } from 'react';
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
import {
    useGetPolymerAnnotationsAnnotationsPolymerRcsbIdAuthAsymIdGetQuery,
    useGetLigandNeighborhoodsLigandsNeighborhoodsRcsbIdAuthAsymIdGetQuery
} from '@/store/tubxz_api';
import type {
    ChainAnnotations,
    DisplayableLigandSite,
    DisplayableMutation,
    LigandSite,
    MutationAnnotation
} from '@/lib/types/annotations';
import { BindingSite } from '@/lib/sync/types';

function indicesToRegions(indices: number[]): Array<{ start: number; end: number }> {
    if (!indices || indices.length === 0) return [];
    const sorted = [...indices].sort((a, b) => a - b);
    const regions = [];
    let start = sorted[0];
    for (let i = 1; i <= sorted.length; i++) {
        if (i === sorted.length || sorted[i] !== sorted[i - 1] + 1) {
            regions.push({ start, end: sorted[i - 1] });
            if (i < sorted.length) start = sorted[i];
        }
    }
    return regions;
}

export function useChainAnnotations(rcsbId: string | null, authAsymId: string | null) {
    const dispatch = useAppDispatch();
    const normalizedRcsbId = rcsbId?.toUpperCase() || '';
    const chainKey = normalizedRcsbId && authAsymId ? `${normalizedRcsbId}_${authAsymId}` : '';

    const { data: variantData, isLoading: isLoadingVariants } = useGetPolymerAnnotationsAnnotationsPolymerRcsbIdAuthAsymIdGetQuery(
        { rcsbId: normalizedRcsbId, authAsymId: authAsymId || '' },
        { skip: !normalizedRcsbId || !authAsymId }
    );

    const { data: ligandData, isLoading: isLoadingLigands } = useGetLigandNeighborhoodsLigandsNeighborhoodsRcsbIdAuthAsymIdGetQuery(
        { rcsbId: normalizedRcsbId, authAsymId: authAsymId || '' },
        { skip: !normalizedRcsbId || !authAsymId }
    );

    const processedRef = useRef<string | null>(null);

    useEffect(() => {
        // CRITICAL: We need BOTH data objects to build the full annotation record
        if (variantData && ligandData && chainKey && processedRef.current !== chainKey) {
            console.log(`[useChainAnnotations] Merging real data for ${chainKey}`);

            const converted: ChainAnnotations = {
                rcsbId: normalizedRcsbId,
                authAsymId: variantData.auth_asym_id,
                entityId: variantData.entity_id,
                family: variantData.family,
                mutations: variantData.variants.map((v): MutationAnnotation => ({
                    masterIndex: v.master_index ?? 0,
                    fromResidue: v.wild_type ?? '?',
                    toResidue: v.observed ?? '?',
                    phenotype: v.phenotype ?? null,
                    uniprotId: v.uniprot_id ?? null,
                    species: null,
                    tubulinType: null,
                    keywords: null,
                    databaseSource: v.source,
                    referenceLink: v.reference ?? null,
                })),
                ligandSites: ligandData.neighborhoods.map((ls): LigandSite => ({
                    ligandId: ls.ligand_id,
                    ligandName: ls.ligand_name ?? ls.ligand_id,
                    ligandChain: ls.ligand_auth_asym_id,
                    ligandAuthSeqId: 0,
                    drugbankId: ls.drugbank_id ?? null,
                    smiles: null,
                    neighborhoodAuthSeqIds: ls.residues?.map(r => r.observed_index) ?? [],
                    interactions: ls.residues?.map(r => ({
                        authSeqId: r.observed_index,
                        masterIndex: r.master_index ?? null,
                        interactionType: 'contact',
                        residueCompId: r.comp_id,
                        residueAtomId: '',
                    })) ?? [],
                })),
                mutationCount: variantData.total_count,
                ligandCount: ligandData.total_ligands,
                uniqueLigandTypes: Array.from(new Set(ligandData.neighborhoods.map(n => n.ligand_id))),
            };

            dispatch(setChainAnnotations(converted));
            processedRef.current = chainKey;
        }
    }, [variantData, ligandData, chainKey, dispatch, normalizedRcsbId]);

    const annotations = useAppSelector(state => selectChainAnnotations(state, chainKey));
    const displayState = useAppSelector(state => selectChainDisplayState(state, chainKey));
    const ligandSites = useAppSelector(state => selectDisplayableLigandSites(state, chainKey)) || [];
    const mutations = useAppSelector(state => selectDisplayableMutations(state, chainKey)) || [];

    const formattedBindingSites: BindingSite[] = useMemo(() => {
        return ligandSites.map(ls => ({
            id: ls.id,
            name: ls.ligandName,
            color: ls.color,
            msaRegions: indicesToRegions(ls.masterIndices)
        }));
    }, [ligandSites]);

    const activeLigandIds = useMemo(() =>
        new Set(displayState?.visibleLigandSites || []),
        [displayState]);

    return {
        annotations,
        ligandSites,
        bindingSites: formattedBindingSites,
        activeLigandIds,
        mutations,
        isLoading: isLoadingVariants || isLoadingLigands,
        showMutations: displayState?.showMutations ?? false,
        setShowMutations: (v: boolean) => dispatch(setMutationsVisible({ chainKey, visible: v })),
        toggleLigand: (id: string) => dispatch(toggleLigandSite({ chainKey, siteKey: id })),
        clearAll: () => {
            dispatch(setMutationsVisible({ chainKey, visible: false }));
            dispatch(hideAllLigands(chainKey));
        }
    };
}