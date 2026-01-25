// src/hooks/useMultiChainAnnotations.ts
import { useEffect, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/store';
import { selectPdbSequences } from '@/store/slices/sequence_registry';
import {
    setChainLoading,
    setChainAnnotations,
    setChainError,
    selectChainEntry,
    ChainAnnotationData,
    LigandSite,
    Mutation,
} from '@/store/slices/annotationsSlice';
import {
    useGetPolymerAnnotationsQuery,
    useGetPolymerLigandNeighborhoodsQuery,
} from '@/store/tubxz_api';
import { selectPositionMapping } from '@/store/slices/sequence_registry';

const LIGAND_COLORS: Record<string, string> = {
    GTP: '#4363d8', GDP: '#FFD700', TAX: '#3cb44b', TXL: '#3cb44b',
    EPO: '#f58231', VLB: '#e6194b', COL: '#911eb4', MG: '#42d4f4',
    CA: '#f032e6', ZN: '#bfef45',
};

function getLigandColor(ligandId: string): string {
    if (LIGAND_COLORS[ligandId]) return LIGAND_COLORS[ligandId];
    let hash = 0;
    for (let i = 0; i < ligandId.length; i++) {
        hash = ligandId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return `hsl(${Math.abs(hash) % 360}, 70%, 50%)`;
}

export interface ChainToFetch {
    rcsbId: string;
    authAsymId: string;
    chainKey: string;
}

/**
 * Determines which chains need annotation fetching.
 */
export function useMultiChainAnnotations(primaryRcsbId: string | null, primaryAuthAsymId: string | null) {
    const pdbSequences = useAppSelector(selectPdbSequences);

    const chainsToFetch = useMemo((): ChainToFetch[] => {
        const chains: ChainToFetch[] = [];

        // Primary chain
        if (primaryRcsbId && primaryAuthAsymId) {
            chains.push({
                rcsbId: primaryRcsbId.toUpperCase(),
                authAsymId: primaryAuthAsymId,
                chainKey: `${primaryRcsbId.toUpperCase()}_${primaryAuthAsymId}`,
            });
        }

        // Aligned chains from sequence registry
        for (const seq of pdbSequences) {
            if (seq.chainRef) {
                const chainKey = `${seq.chainRef.pdbId}_${seq.chainRef.chainId}`;
                if (!chains.some(c => c.chainKey === chainKey)) {
                    chains.push({
                        rcsbId: seq.chainRef.pdbId,
                        authAsymId: seq.chainRef.chainId,
                        chainKey,
                    });
                }
            }
        }

        console.log('[useMultiChainAnnotations] Chains to fetch:', chains);
        return chains;
    }, [primaryRcsbId, primaryAuthAsymId, pdbSequences]);

    return {
        chainsToFetch,
        primaryChainKey: primaryRcsbId && primaryAuthAsymId
            ? `${primaryRcsbId.toUpperCase()}_${primaryAuthAsymId}`
            : null,
    };
}

/**
 * Component that fetches annotations for a single chain.
 */
export function ChainAnnotationFetcher({
    rcsbId,
    authAsymId,
    chainKey,
}: ChainToFetch) {
    const dispatch = useAppDispatch();

    const existingEntry = useAppSelector(state => selectChainEntry(state, chainKey));
    const positionMapping = useAppSelector(state => selectPositionMapping(state, chainKey));

    // FIX: Skip only if we already have data loaded
    const shouldSkip = !!existingEntry?.data;

    console.log(`[ChainAnnotationFetcher] ${chainKey}:`, {
        existingEntry: !!existingEntry,
        hasData: !!existingEntry?.data,
        shouldSkip,
        positionMapping: !!positionMapping,
    });

    const variantsQuery = useGetPolymerAnnotationsQuery(
        { rcsbId, authAsymId },
        { skip: shouldSkip }
    );

    const ligandsQuery = useGetPolymerLigandNeighborhoodsQuery(
        { rcsbId, authAsymId },
        { skip: shouldSkip }
    );

    // Debug: Log query states
    useEffect(() => {
        console.log(`[ChainAnnotationFetcher] ${chainKey} query states:`, {
            variantsLoading: variantsQuery.isLoading,
            variantsSuccess: variantsQuery.isSuccess,
            variantsError: variantsQuery.isError,
            variantsData: !!variantsQuery.data,
            ligandsLoading: ligandsQuery.isLoading,
            ligandsSuccess: ligandsQuery.isSuccess,
            ligandsError: ligandsQuery.isError,
            ligandsData: !!ligandsQuery.data,
        });
    }, [
        chainKey,
        variantsQuery.isLoading,
        variantsQuery.isSuccess,
        variantsQuery.isError,
        variantsQuery.data,
        ligandsQuery.isLoading,
        ligandsQuery.isSuccess,
        ligandsQuery.isError,
        ligandsQuery.data,
    ]);

    // Track loading
    useEffect(() => {
        if ((variantsQuery.isLoading || ligandsQuery.isLoading) && !existingEntry?.data) {
            console.log(`[ChainAnnotationFetcher] ${chainKey} - Setting loading state`);
            dispatch(setChainLoading(chainKey));
        }
    }, [chainKey, variantsQuery.isLoading, ligandsQuery.isLoading, existingEntry?.data, dispatch]);

    // Process data when ready
    useEffect(() => {
        if (!variantsQuery.data || !ligandsQuery.data) {
            return;
        }

        if (existingEntry?.data) {
            console.log(`[ChainAnnotationFetcher] ${chainKey} - Already have data, skipping`);
            return;
        }

        console.log(`[ChainAnnotationFetcher] ${chainKey} - Processing data:`, {
            variantsCount: variantsQuery.data.variants?.length ?? 0,
            ligandsCount: ligandsQuery.data.neighborhoods?.length ?? 0,
        });

        const authToMaster: Record<number, number> = {};
        if (positionMapping) {
            for (const [masterStr, authSeqId] of Object.entries(positionMapping)) {
                authToMaster[authSeqId] = parseInt(masterStr, 10);
            }
        }

        const ligandSites: LigandSite[] = (ligandsQuery.data.neighborhoods ?? []).map(n => ({
            id: `${n.ligand_id}_${n.ligand_auth_asym_id}_${n.ligand_auth_seq_id ?? 0}`,
            ligandId: n.ligand_id,
            ligandName: n.ligand_name ?? n.ligand_id,
            ligandChain: n.ligand_auth_asym_id,
            ligandAuthSeqId: n.ligand_auth_seq_id ?? 0,
            color: getLigandColor(n.ligand_id),
            neighborhoodAuthSeqIds: n.residues?.map(r => r.observed_index) ?? [],
        }));

        const mutations: Mutation[] = (variantsQuery.data.variants ?? [])
            .filter(v => v.type === 'substitution' && v.master_index != null)
            .map(v => ({
                masterIndex: v.master_index!,
                authSeqId: positionMapping?.[v.master_index!] ?? null,
                fromResidue: v.wild_type ?? '?',
                toResidue: v.observed ?? '?',
                phenotype: v.phenotype ?? null,
            }));

        const data: ChainAnnotationData = {
            ligandSites,
            mutations,
            family: variantsQuery.data.family ?? null,
        };

        console.log(`[ChainAnnotationFetcher] ${chainKey} - Dispatching annotations:`, {
            ligandSites: ligandSites.length,
            mutations: mutations.length,
        });

        dispatch(setChainAnnotations({ chainKey, data }));
    }, [chainKey, variantsQuery.data, ligandsQuery.data, positionMapping, existingEntry?.data, dispatch]);

    // Handle errors
    useEffect(() => {
        const error = variantsQuery.error || ligandsQuery.error;
        if (error && !existingEntry?.data) {
            console.error(`[ChainAnnotationFetcher] ${chainKey} - Error:`, error);
            dispatch(setChainError({
                chainKey,
                error: 'message' in error ? (error as any).message : 'Failed to fetch annotations',
            }));
        }
    }, [chainKey, variantsQuery.error, ligandsQuery.error, existingEntry?.data, dispatch]);

    return null;
}