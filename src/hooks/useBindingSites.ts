// src/hooks/useBindingSites.ts

import { useState, useCallback, useMemo } from 'react';
import { SyncDispatcher } from '@/lib/controllers/SyncDispatcher';
import { BindingSite } from '@/lib/types/sync';

/**
 * Hook for managing binding site visualization using the unified dispatcher.
 */
export function useBindingSites(
  dispatcher: SyncDispatcher | null,
  sites: BindingSite[]
) {
  const [activeSites, setActiveSites] = useState<Set<string>>(new Set());

  // Build site lookup
  const sitesById = useMemo(() => {
    const map = new Map<string, BindingSite>();
    sites.forEach((s) => map.set(s.id, s));
    return map;
  }, [sites]);

  // Toggle a site on/off
  const toggleSite = useCallback(
    (siteId: string, enabled: boolean) => {
      if (!dispatcher) return;

      setActiveSites((prev) => {
        const next = new Set(prev);

        if (enabled) {
          next.add(siteId);

          // Add the color rule via dispatcher
          const site = sitesById.get(siteId);
          if (site) {
            const positions = expandRegions(site.msaRegions);
            dispatcher.addBindingSite(site.id, site.name, site.color, positions);
          }
        } else {
          next.delete(siteId);

          // Remove the color rule
          dispatcher.removeBindingSite(siteId);
        }

        return next;
      });
    },
    [dispatcher, sitesById]
  );

  // Focus camera on a site
  const focusSite = useCallback(
    (siteId: string) => {
      if (!dispatcher) return;

      const site = sitesById.get(siteId);
      if (!site) return;

      // Get the full range
      const positions = expandRegions(site.msaRegions);
      if (positions.length === 0) return;

      const minPos = Math.min(...positions);
      const maxPos = Math.max(...positions);

      // Dispatch a range focus action
      dispatcher.dispatch({
        type: 'JUMP_TO_RANGE',
        start: minPos,
        end: maxPos,
      });

      // Enable the site if not already
      if (!activeSites.has(siteId)) {
        toggleSite(siteId, true);
      }
    },
    [dispatcher, sitesById, activeSites, toggleSite]
  );

  // Clear all sites
  const clearAll = useCallback(() => {
    if (!dispatcher) return;

    setActiveSites(new Set());
    dispatcher.clearAllColors();
  }, [dispatcher]);

  return {
    activeSites,
    toggleSite,
    focusSite,
    clearAll,
  };
}

// Helper to expand regions to positions
function expandRegions(regions: Array<{ start: number; end: number }>): number[] {
  const positions: number[] = [];
  for (const { start, end } of regions) {
    for (let i = start; i <= end; i++) {
      positions.push(i);
    }
  }
  return positions;
}