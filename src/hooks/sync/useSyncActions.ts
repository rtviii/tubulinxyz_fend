// src/hooks/sync/useSyncActions.ts
import { useCallback, useEffect, useRef } from 'react';
import { SyncDispatcher } from '@/lib/sync/SyncDispatcher';
import type { DisplayableLigandSite, DisplayableMutation } from '@/lib/types/annotations';

export const MUTATION_COLOR = '#ff6b6b';

interface UseSyncActionsOptions {
  dispatcher: SyncDispatcher | null;
  rowIndex: number;
  ligandSites: DisplayableLigandSite[];
  visibleLigandIds: Set<string>;
  mutations: DisplayableMutation[];
  showMutations: boolean;
}

export function useSyncActions({
  dispatcher,
  rowIndex,
  ligandSites,
  visibleLigandIds,
  mutations,
  showMutations,
}: UseSyncActionsOptions) {
  const prevVisibleRef = useRef<Set<string>>(new Set());
  const prevShowMutationsRef = useRef(false);

  useEffect(() => {
    if (!dispatcher) return;

    const prev = prevVisibleRef.current;
    const current = visibleLigandIds;

    for (const id of current) {
      if (!prev.has(id)) {
        const site = ligandSites.find(s => s.id === id);
        if (site) {
          dispatcher.addBindingSiteToRow(id, site.ligandName, site.color, site.masterIndices, rowIndex);
        }
      }
    }

    for (const id of prev) {
      if (!current.has(id)) {
        dispatcher.removeBindingSite(id);
      }
    }

    prevVisibleRef.current = new Set(current);
  }, [dispatcher, ligandSites, visibleLigandIds, rowIndex]);

  useEffect(() => {
    if (!dispatcher) return;

    if (showMutations && !prevShowMutationsRef.current && mutations.length > 0) {
      dispatcher.addMutations(
        'active-mutations',
        mutations.map(m => ({ msaPosition: m.masterIndex, color: MUTATION_COLOR })),
        rowIndex
      );
    } else if (!showMutations && prevShowMutationsRef.current) {
      dispatcher.removeMutations('active-mutations');
    }

    prevShowMutationsRef.current = showMutations;
  }, [dispatcher, mutations, showMutations, rowIndex]);

  const focusLigandSite = useCallback((siteId: string) => {
    if (!dispatcher) return;
    const site = ligandSites.find(s => s.id === siteId);
    if (site && site.masterIndices.length > 0) {
      const start = Math.min(...site.masterIndices);
      const end = Math.max(...site.masterIndices);
      dispatcher.dispatch({ type: 'JUMP_TO_RANGE', start, end });
    }
  }, [dispatcher, ligandSites]);

  const clearAll = useCallback(() => {
    if (!dispatcher) return;
    dispatcher.clearAllColors();
  }, [dispatcher]);

  return { focusLigandSite, clearAll };
}