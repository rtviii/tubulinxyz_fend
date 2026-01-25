// src/hooks/annotations/useAnnotationDisplay.ts
import { useMemo, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/store';
import {
  setMutationsVisible,
  toggleLigandSite,
  showAllLigands,
  hideAllLigands,
  selectChainDisplayState,
} from '@/store/slices/annotationsSlice';
import type { PolymerAnnotationsResponse, PolymerNeighborhoodsResponse } from '@/store/tubxz_api';
import type { DisplayableLigandSite, DisplayableMutation } from '@/lib/types/annotations';

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

function makeLigandSiteKey(ligandId: string, chain: string, seqId: number): string {
  return `${ligandId}_${chain}_${seqId}`;
}

interface UseAnnotationDisplayOptions {
  chainKey: string;
  variantsData: PolymerAnnotationsResponse | undefined;
  ligandsData: PolymerNeighborhoodsResponse | undefined;
  positionMapping: Record<number, number> | null; // masterIndex -> authSeqId
}

/**
 * Transforms raw annotation data into displayable format.
 * Manages visibility state through Redux.
 */
export function useAnnotationDisplay({
  chainKey,
  variantsData,
  ligandsData,
  positionMapping,
}: UseAnnotationDisplayOptions) {
  const dispatch = useAppDispatch();
  const displayState = useAppSelector(state => selectChainDisplayState(state, chainKey));

  // Build reverse map: authSeqId -> masterIndex
  const authToMaster = useMemo(() => {
    const map: Record<number, number> = {};
    if (positionMapping) {
      Object.entries(positionMapping).forEach(([masterStr, authSeqId]) => {
        map[authSeqId] = parseInt(masterStr, 10);
      });
    }
    return map;
  }, [positionMapping]);

  // Transform ligands to displayable format
  const ligandSites: DisplayableLigandSite[] = useMemo(() => {
    if (!ligandsData?.neighborhoods) return [];

    return ligandsData.neighborhoods.map(n => {
      const siteKey = makeLigandSiteKey(n.ligand_id, n.ligand_auth_asym_id, 0);
      const authSeqIds = n.residues?.map(r => r.observed_index) ?? [];
      const masterIndices = authSeqIds
        .map(auth => authToMaster[auth])
        .filter((m): m is number => m !== undefined);

      return {
        id: siteKey,
        ligandId: n.ligand_id,
        ligandName: n.ligand_name ?? n.ligand_id,
        ligandChain: n.ligand_auth_asym_id,
        color: getLigandColor(n.ligand_id),
        masterIndices,
        authSeqIds,
        interactionCount: n.residue_count,
      };
    });
  }, [ligandsData, authToMaster]);

  // Transform mutations to displayable format
  const mutations: DisplayableMutation[] = useMemo(() => {
    if (!variantsData?.variants) return [];

    return variantsData.variants
      .filter(v => v.type === 'substitution' && v.master_index != null)
      .map(v => ({
        masterIndex: v.master_index!,
        fromResidue: v.wild_type ?? '?',
        toResidue: v.observed ?? '?',
        phenotype: v.phenotype ?? null,
        label: `${v.wild_type ?? '?'}${v.master_index}${v.observed ?? '?'}`,
      }));
  }, [variantsData]);

  // Visible ligand IDs based on Redux state
  const visibleLigandIds = useMemo(
    () => new Set(displayState?.visibleLigandSites ?? []),
    [displayState]
  );

  // Actions
  const setShowMutations = useCallback(
    (visible: boolean) => dispatch(setMutationsVisible({ chainKey, visible })),
    [dispatch, chainKey]
  );

  const toggleLigand = useCallback(
    (siteId: string) => dispatch(toggleLigandSite({ chainKey, siteKey: siteId })),
    [dispatch, chainKey]
  );

  const showAll = useCallback(
    () => dispatch(showAllLigands(chainKey)),
    [dispatch, chainKey]
  );

  const hideAll = useCallback(
    () => dispatch(hideAllLigands(chainKey)),
    [dispatch, chainKey]
  );

  return {
    ligandSites,
    mutations,
    visibleLigandIds,
    showMutations: displayState?.showMutations ?? false,
    setShowMutations,
    toggleLigand,
    showAll,
    hideAll,
  };
}