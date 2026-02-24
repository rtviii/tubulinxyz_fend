// src/hooks/useMultiChainAnnotations.tsx
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
    Variant,
    VariantType,
} from '@/store/slices/annotationsSlice';
import {
    useGetPolymerAnnotationsQuery,
    useGetPolymerLigandNeighborhoodsQuery,
} from '@/store/tubxz_api';
import { selectPositionMapping } from '@/store/slices/sequence_registry';
import { makeChainKey } from '@/lib/chain_key';




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

export function useMultiChainAnnotations(primaryRcsbId: string | null, primaryAuthAsymId: string | null) {
    const pdbSequences = useAppSelector(selectPdbSequences);

    const chainsToFetch = useMemo((): ChainToFetch[] => {
        const chains: ChainToFetch[] = [];

        if (primaryRcsbId && primaryAuthAsymId) {
            chains.push({
                rcsbId: primaryRcsbId.toUpperCase(),
                authAsymId: primaryAuthAsymId,
                chainKey: makeChainKey(primaryRcsbId, primaryAuthAsymId),
            });
        }

        for (const seq of pdbSequences) {
            if (seq.chainRef) {
                const chainKey = makeChainKey(seq.chainRef.pdbId, seq.chainRef.chainId);
                if (!chains.some(c => c.chainKey === chainKey)) {
                    chains.push({
                        rcsbId: seq.chainRef.pdbId,
                        authAsymId: seq.chainRef.chainId,
                        chainKey,
                    });
                }
            }
        }

        return chains;
    }, [primaryRcsbId, primaryAuthAsymId, pdbSequences]);

    return {
        chainsToFetch,
        primaryChainKey: primaryRcsbId && primaryAuthAsymId
            ? makeChainKey(primaryRcsbId, primaryAuthAsymId)
            : null,
    };
}

export function ChainAnnotationFetcher({
    rcsbId,
    authAsymId,
    chainKey,
}: ChainToFetch) {
    const dispatch = useAppDispatch();

    const existingEntry = useAppSelector(state => selectChainEntry(state, chainKey));
    const positionMapping = useAppSelector(state => selectPositionMapping(state, chainKey));

    const shouldSkip = !!existingEntry?.data;

    const variantsQuery = useGetPolymerAnnotationsQuery(
        { rcsbId, authAsymId },
        { skip: shouldSkip }
    );

    const ligandsQuery = useGetPolymerLigandNeighborhoodsQuery(
        { rcsbId, authAsymId },
        { skip: shouldSkip }
    );

    // Track loading
    useEffect(() => {
        if ((variantsQuery.isLoading || ligandsQuery.isLoading) && !existingEntry?.data) {
            dispatch(setChainLoading(chainKey));
        }
    }, [chainKey, variantsQuery.isLoading, ligandsQuery.isLoading, existingEntry?.data, dispatch]);

    // Process data when ready
    useEffect(() => {
        if (!variantsQuery.data || !ligandsQuery.data) {
            return;
        }

        if (existingEntry?.data) {
            return;
        }

        const ligandSites: LigandSite[] = (ligandsQuery.data.neighborhoods ?? []).map(n => ({
            id: `${n.ligand_id}_${n.ligand_auth_asym_id}_${n.ligand_auth_seq_id}`,
            ligandAuthSeqId: n.ligand_auth_seq_id,
            ligandId: n.ligand_id,
            ligandName: n.ligand_name ?? n.ligand_id,
            ligandChain: n.ligand_auth_asym_id,
            color: getLigandColor(n.ligand_id),
            drugbankId: n.drugbank_id ?? null,
            residueCount: n.residue_count,
            masterIndices: n.residues
                ?.map(r => r.master_index)
                .filter((i): i is number => i != null) ?? [],
            authSeqIds: n.residues?.map(r => r.auth_seq_id) ?? [],
        }));

        // Include ALL variant types, not just substitutions
        const variants: Variant[] = (variantsQuery.data.variants ?? [])
            .filter(v => v.master_index != null)
            .map(v => ({
                type: (v.type as VariantType) ?? 'substitution',
                masterIndex: v.master_index!,
                authSeqId: positionMapping?.[v.master_index!] ?? null,
                fromResidue: v.wild_type ?? '?',
                toResidue: v.observed ?? '?',
                phenotype: v.phenotype ?? null,
                source: v.source ?? null,
                uniprotId: v.uniprot_id ?? null,
            }));

        const data: ChainAnnotationData = {
            ligandSites,
            variants,
            family: variantsQuery.data.family ?? null,
        };

        dispatch(setChainAnnotations({ chainKey, data }));
    }, [chainKey, variantsQuery.data, ligandsQuery.data, positionMapping, existingEntry?.data, dispatch]);

    // Handle errors
    useEffect(() => {
        const error = variantsQuery.error || ligandsQuery.error;
        if (error && !existingEntry?.data) {
            dispatch(setChainError({
                chainKey,
                error: 'message' in error ? (error as any).message : 'Failed to fetch annotations',
            }));
        }
    }, [chainKey, variantsQuery.error, ligandsQuery.error, existingEntry?.data, dispatch]);

    return null;
}