// src/hooks/useBindingSites.ts

import { useState, useCallback, useMemo } from 'react';
import { SyncDispatcher } from '@/lib/controllers/SyncDispatcher';
import { BindingSite } from '@/lib/types/sync';
import { expandRegionsToPositions } from '@/app/structures/[rcsb_id]/BindingSitePanel';

/**
 * Hook to manage binding site state and sync with the dispatcher.
 * 
 * @param dispatcher - The SyncDispatcher instance
 * @param sites - Array of binding site definitions
 */
export function useBindingSites(
  dispatcher: SyncDispatcher | null,
  sites: BindingSite[]
) {
  const [activeSites, setActiveSites] = useState<Set<string>>(new Set());

  /**
   * Toggle a binding site on/off.
   * When enabled, adds a color rule to the dispatcher.
   * When disabled, removes the color rule.
   */
  const toggleSite = useCallback(
    (siteId: string, enabled: boolean) => {
      if (!dispatcher) return;

      const site = sites.find((s) => s.id === siteId);
      if (!site) return;

      if (enabled) {
        // Add binding site color rule
        const msaPositions = expandRegionsToPositions(site.msaRegions);
        dispatcher.addBindingSite(siteId, site.name, site.color, msaPositions);

        setActiveSites((prev) => {
          const next = new Set(prev);
          next.add(siteId);
          return next;
        });
      } else {
        // Remove binding site color rule
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

  /**
   * Focus on a binding site (jump MSA and camera to the region).
   */
  const focusSite = useCallback(
    (siteId: string) => {
      if (!dispatcher) return;

      const site = sites.find((s) => s.id === siteId);
      if (!site || site.msaRegions.length === 0) return;

      // Focus on the first region
      const firstRegion = site.msaRegions[0];
      dispatcher.dispatch({
        type: 'JUMP_TO_RANGE',
        start: firstRegion.start,
        end: firstRegion.end,
      });
    },
    [dispatcher, sites]
  );

  /**
   * Highlight a site on hover (preview without enabling).
   * Shows highlight in both MSA and structure.
   */
  const hoverSite = useCallback(
    (siteId: string, msaStart: number, msaEnd: number) => {
      if (!dispatcher) return;
      dispatcher.highlightRangeFromAnnotation(msaStart, msaEnd);
    },
    [dispatcher]
  );

  /**
   * Clear hover highlight.
   */
  const hoverEnd = useCallback(() => {
    dispatcher?.clearHighlight();
  }, [dispatcher]);

  /**
   * Clear all active binding sites.
   */
  const clearAll = useCallback(() => {
    if (!dispatcher) return;

    // Remove all active sites from dispatcher
    for (const siteId of activeSites) {
      dispatcher.removeBindingSite(siteId);
    }

    setActiveSites(new Set());
  }, [dispatcher, activeSites]);

  /**
   * Enable multiple sites at once.
   */
  const enableSites = useCallback(
    (siteIds: string[]) => {
      for (const siteId of siteIds) {
        toggleSite(siteId, true);
      }
    },
    [toggleSite]
  );

  /**
   * Get site by ID.
   */
  const getSite = useCallback(
    (siteId: string): BindingSite | undefined => {
      return sites.find((s) => s.id === siteId);
    },
    [sites]
  );

  return {
    activeSites,
    toggleSite,
    focusSite,
    hoverSite,
    hoverEnd,
    clearAll,
    enableSites,
    getSite,
  };
}