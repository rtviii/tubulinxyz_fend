// src/hooks/annotations/useChainAnnotationsComposed.ts
import { useMemo } from 'react';
import { useAppSelector } from '@/store/store';
import { selectPositionMapping, selectSequenceById } from '@/store/slices/sequence_registry';
import { usePolymerAnnotationsQuery } from './usePolymerAnnotationsQuery';
import { useAnnotationDisplay } from './useAnnotationDisplay';
import { useSyncActions } from '../sync/useSyncActions';
import { SyncDispatcher } from '@/lib/controllers/SyncDispatcher';
import type { BindingSite } from '@/lib/sync/types';

interface UseChainAnnotationsComposedOptions {
  rcsbId: string | null;
  authAsymId: string | null;
  dispatcher: SyncDispatcher | null;
}

/**
 * Composed hook that wires together data fetching, display state, and sync actions.
 * Use this in page components for convenience.
 */
export function useChainAnnotationsComposed({
  rcsbId,
  authAsymId,
  dispatcher,
}: UseChainAnnotationsComposedOptions) {
  const chainKey = rcsbId && authAsymId ? `${rcsbId.toUpperCase()}_${authAsymId}` : '';
  const sequenceId = chainKey || null;

  // Data fetching
  const { variants, ligands, isLoading, isError } = usePolymerAnnotationsQuery({
    rcsbId,
    authAsymId,
  });

  // Position mapping from sequence registry
  const positionMapping = useAppSelector(state =>
    sequenceId ? selectPositionMapping(state, sequenceId) : null
  );

  const activeSequence = useAppSelector(state =>
    sequenceId ? selectSequenceById(state, sequenceId) : null
  );

  // Display state + transformations
  const display = useAnnotationDisplay({
    chainKey,
    variantsData: variants,
    ligandsData: ligands,
    positionMapping,
  });

  // Sync to dispatcher
  const { focusLigandSite, clearAll } = useSyncActions({
    dispatcher,
    rowIndex: activeSequence?.rowIndex ?? 0,
    ligandSites: display.ligandSites,
    visibleLigandIds: display.visibleLigandIds,
    mutations: display.mutations,
    showMutations: display.showMutations,
  });

  // Convert to BindingSite format for UI components
  const bindingSites: BindingSite[] = useMemo(() => {
    return display.ligandSites.map(ls => ({
      id: ls.id,
      name: ls.ligandName,
      color: ls.color,
      msaRegions: indicesToRegions(ls.masterIndices),
    }));
  }, [display.ligandSites]);

  return {
    // Raw data
    variants,
    ligands,
    isLoading,
    isError,

    // Displayable
    ligandSites: display.ligandSites,
    mutations: display.mutations,
    bindingSites,

    // State
    visibleLigandIds: display.visibleLigandIds,
    showMutations: display.showMutations,

    // Actions
    setShowMutations: display.setShowMutations,
    toggleLigand: display.toggleLigand,
    showAllLigands: display.showAll,
    hideAllLigands: display.hideAll,
    focusLigandSite,
    clearAll,
  };
}

function indicesToRegions(indices: number[]): Array<{ start: number; end: number }> {
  if (indices.length === 0) return [];
  const sorted = [...indices].sort((a, b) => a - b);
  const regions: Array<{ start: number; end: number }> = [];
  let start = sorted[0];
  for (let i = 1; i <= sorted.length; i++) {
    if (i === sorted.length || sorted[i] !== sorted[i - 1] + 1) {
      regions.push({ start, end: sorted[i - 1] });
      if (i < sorted.length) start = sorted[i];
    }
  }
  return regions;
}