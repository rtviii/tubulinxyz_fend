// src/hooks/useBindingSites.ts

import { useState, useCallback } from 'react';
import { SyncDispatcher, BindingSite } from '@/lib/sync';

/**
 * Expand regions to individual MSA positions.
 */
function expandRegionsToPositions(regions: { start: number; end: number }[]): number[] {
  const positions: number[] = [];
  for (const { start, end } of regions) {
    for (let i = start; i <= end; i++) {
      positions.push(i);
    }
  }
  return positions;
}

/**
 * Hook to manage binding site state and sync with the dispatcher.
 */
export function useBindingSites(dispatcher: SyncDispatcher | null, sites: BindingSite[]) {
  const [activeSites, setActiveSites] = useState<Set<string>>(new Set());

  const toggleSite = useCallback(
    (siteId: string, enabled: boolean) => {
      if (!dispatcher) return;

      const site = sites.find((s) => s.id === siteId);
      if (!site) return;

      if (enabled) {
        const msaPositions = expandRegionsToPositions(site.msaRegions);
        dispatcher.addBindingSite(siteId, site.name, site.color, msaPositions);
        setActiveSites((prev) => new Set(prev).add(siteId));
      } else {
        dispatcher.removeBindingSite(siteId);
        setActiveSites((prev) => {
          const next = new Set(prev);
          next.delete(siteId);
          return next;
        });
      }
    },
    [dispatcher, sites]
  );

  const focusSite = useCallback(
    (siteId: string) => {
      if (!dispatcher) return;

      const site = sites.find((s) => s.id === siteId);
      if (!site || site.msaRegions.length === 0) return;

      const firstRegion = site.msaRegions[0];
      dispatcher.dispatch({
        type: 'JUMP_TO_RANGE',
        start: firstRegion.start,
        end: firstRegion.end,
      });
    },
    [dispatcher, sites]
  );

  const hoverSite = useCallback(
    (siteId: string, msaStart: number, msaEnd: number) => {
      dispatcher?.highlightRangeFromAnnotation(msaStart, msaEnd);
    },
    [dispatcher]
  );

  const hoverEnd = useCallback(() => {
    dispatcher?.clearHighlight();
  }, [dispatcher]);

  const clearAll = useCallback(() => {
    if (!dispatcher) return;
    for (const siteId of activeSites) {
      dispatcher.removeBindingSite(siteId);
    }
    setActiveSites(new Set());
  }, [dispatcher, activeSites]);

  const getSite = useCallback(
    (siteId: string): BindingSite | undefined => sites.find((s) => s.id === siteId),
    [sites]
  );

  return { activeSites, toggleSite, focusSite, hoverSite, hoverEnd, clearAll, getSite };
}