// src/hooks/useChainAnnotationsData.ts
import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/store';
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

// Color assignment for ligands
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

interface UseChainAnnotationsDataOptions {
  rcsbId: string | null;
  authAsymId: string | null;
  skip?: boolean;
}

/**
 * Fetches annotation data and stores in Redux.
 * Pure data fetching - no visibility management.
 */
export function useChainAnnotationsData({ rcsbId, authAsymId, skip = false }: UseChainAnnotationsDataOptions) {
  const dispatch = useAppDispatch();
  const chainKey = rcsbId && authAsymId ? `${rcsbId.toUpperCase()}_${authAsymId}` : '';
  const shouldSkip = skip || !rcsbId || !authAsymId;

  const existingEntry = useAppSelector(state => selectChainEntry(state, chainKey));
  const positionMapping = useAppSelector(state => selectPositionMapping(state, chainKey));

  const variantsQuery = useGetPolymerAnnotationsQuery(
    { rcsbId: rcsbId?.toUpperCase() ?? '', authAsymId: authAsymId ?? '' },
    { skip: shouldSkip }
  );

  const ligandsQuery = useGetPolymerLigandNeighborhoodsQuery(
    { rcsbId: rcsbId?.toUpperCase() ?? '', authAsymId: authAsymId ?? '' },
    { skip: shouldSkip }
  );

  // Track loading state
  useEffect(() => {
    if (chainKey && (variantsQuery.isLoading || ligandsQuery.isLoading)) {
      dispatch(setChainLoading(chainKey));
    }
  }, [chainKey, variantsQuery.isLoading, ligandsQuery.isLoading, dispatch]);

  // Process and store data when both queries complete
  useEffect(() => {
    if (!chainKey || !variantsQuery.data || !ligandsQuery.data) return;
    if (existingEntry?.data) return; // Already processed

    // Build auth->master mapping for mutations
    const authToMaster: Record<number, number> = {};
    if (positionMapping) {
      for (const [masterStr, authSeqId] of Object.entries(positionMapping)) {
        authToMaster[authSeqId] = parseInt(masterStr, 10);
      }
    }

    // Transform ligand data
    const ligandSites: LigandSite[] = ligandsQuery.data.neighborhoods.map(n => ({
      id: `${n.ligand_id}_${n.ligand_auth_asym_id}_${n.ligand_auth_seq_id ?? 0}`,
      ligandId: n.ligand_id,
      ligandName: n.ligand_name ?? n.ligand_id,
      ligandChain: n.ligand_auth_asym_id,
      ligandAuthSeqId: n.ligand_auth_seq_id ?? 0,
      color: getLigandColor(n.ligand_id),
      neighborhoodAuthSeqIds: n.residues?.map(r => r.observed_index) ?? [],
    }));

    // Transform mutation data
    const mutations: Mutation[] = variantsQuery.data.variants
      .filter(v => v.type === 'substitution' && v.master_index != null)
      .map(v => {
        // Try to find authSeqId from position mapping
        let authSeqId: number | null = null;
        if (positionMapping && v.master_index != null) {
          authSeqId = positionMapping[v.master_index] ?? null;
        }

        return {
          masterIndex: v.master_index!,
          authSeqId,
          fromResidue: v.wild_type ?? '?',
          toResidue: v.observed ?? '?',
          phenotype: v.phenotype ?? null,
        };
      });

    const data: ChainAnnotationData = {
      ligandSites,
      mutations,
      family: variantsQuery.data.family,
    };

    dispatch(setChainAnnotations({ chainKey, data }));
  }, [
    chainKey,
    variantsQuery.data,
    ligandsQuery.data,
    positionMapping,
    existingEntry?.data,
    dispatch,
  ]);

  // Handle errors
  useEffect(() => {
    if (!chainKey) return;
    const error = variantsQuery.error || ligandsQuery.error;
    if (error) {
      dispatch(setChainError({
        chainKey,
        error: 'message' in error ? error.message : 'Failed to fetch annotations',
      }));
    }
  }, [chainKey, variantsQuery.error, ligandsQuery.error, dispatch]);

  return {
    isLoading: variantsQuery.isLoading || ligandsQuery.isLoading,
    isError: variantsQuery.isError || ligandsQuery.isError,
    refetch: () => {
      variantsQuery.refetch();
      ligandsQuery.refetch();
    },
  };
}