// src/app/msalite/hooks/useBindingSiteSync.ts
import { useState, useCallback, useMemo } from 'react';
import { MolstarInstance } from '@/components/molstar/services/MolstarInstance';
import { PositionMapping } from '@/store/slices/sequence_registry';
import {
  BindingSiteRegion,
  expandRegionsToPositions
} from '../components/BindingSitePanel';
import {
  applyCombinedColoring,
  clearColorConfig,
  RowHighlight,
} from '../services/msaColorService';
import { Color } from 'molstar/lib/mol-util/color';
import { ResidueColoring } from '@/components/molstar/coloring/types';

interface UseBindingSiteSyncParams {
  sites: BindingSiteRegion[];
  chainId: string;
  positionMapping: PositionMapping | null;
  molstarInstance: MolstarInstance | null;
  onMsaRedraw: () => void;
}

export function useBindingSiteSync({
  sites,
  chainId,
  positionMapping,
  molstarInstance,
  onMsaRedraw,
}: UseBindingSiteSyncParams) {
  const [activeSites, setActiveSites] = useState<Set<string>>(new Set());

  // Build site lookup
  const sitesById = useMemo(() => {
    const map = new Map<string, BindingSiteRegion>();
    sites.forEach(s => map.set(s.id, s));
    return map;
  }, [sites]);

  // Apply coloring to both MSA and Molstar
  // In useBindingSiteSync.ts, update the applyColoring callback:

  const applyColoring = useCallback((enabledSiteIds: Set<string>) => {
    console.log('[useBindingSiteSync] applyColoring called, enabled sites:', Array.from(enabledSiteIds));

    // If nothing enabled, clear everything
    if (enabledSiteIds.size === 0) {
      console.log('[useBindingSiteSync] Clearing all coloring');
      clearColorConfig();
      molstarInstance?.restoreDefaultColors();
      onMsaRedraw();
      return;
    }

    // Build MSA column colors
    const columnColors = new Map<number, string>();

    // Build Molstar colorings
    const molstarColorings: ResidueColoring[] = [];

    console.log('[useBindingSiteSync] Position mapping:', positionMapping ? Object.keys(positionMapping).length + ' entries' : 'null');

    for (const siteId of enabledSiteIds) {
      const site = sitesById.get(siteId);
      if (!site) continue;

      const colorHex = site.color;
      const colorInt = parseInt(colorHex.replace('#', ''), 16);
      const positions = expandRegionsToPositions(site.regions);

      console.log(`[useBindingSiteSync] Site ${siteId}: ${positions.length} MSA positions, color: ${colorHex}`);

      for (const msaPos of positions) {
        // MSA coloring
        columnColors.set(msaPos, colorHex);

        // Molstar coloring (translate MSA pos -> auth_seq_id)
        if (positionMapping) {
          const authSeqId = positionMapping[msaPos];
          if (authSeqId !== undefined) {
            molstarColorings.push({
              chainId,
              authSeqId,
              color: Color(colorInt),
            });
          }
        }
      }
    }

    console.log(`[useBindingSiteSync] MSA columnColors: ${columnColors.size} positions`);
    console.log(`[useBindingSiteSync] Molstar colorings: ${molstarColorings.length} residues`);

    // Apply to MSA
    if (columnColors.size > 0) {
      applyCombinedColoring(columnColors, [], '#f8f8f8');
      console.log('[useBindingSiteSync] Applied MSA coloring, calling onMsaRedraw');
    }
    onMsaRedraw();

    // Apply to Molstar
    if (molstarInstance && molstarColorings.length > 0) {
      console.log('[useBindingSiteSync] Applying Molstar colorscheme');
      molstarInstance.applyColorscheme('binding-sites', molstarColorings);
    }
  }, [sitesById, chainId, positionMapping, molstarInstance, onMsaRedraw]);

  // Toggle a site on/off
  const toggleSite = useCallback((siteId: string, enabled: boolean) => {
    setActiveSites(prev => {
      const next = new Set(prev);
      if (enabled) {
        next.add(siteId);
      } else {
        next.delete(siteId);
      }
      applyColoring(next);
      return next;
    });
  }, [applyColoring]);

  // Focus camera on a site's residues
  const focusSite = useCallback((siteId: string) => {
    const site = sitesById.get(siteId);
    if (!site || !molstarInstance || !positionMapping) return;

    // Get the full range of the site
    const allPositions = expandRegionsToPositions(site.regions);
    if (allPositions.length === 0) return;

    // Find the auth_seq_id range
    const authSeqIds: number[] = [];
    for (const msaPos of allPositions) {
      const authSeqId = positionMapping[msaPos];
      if (authSeqId !== undefined) {
        authSeqIds.push(authSeqId);
      }
    }

    if (authSeqIds.length > 0) {
      const minAuth = Math.min(...authSeqIds);
      const maxAuth = Math.max(...authSeqIds);
      molstarInstance.focusResidueRange(chainId, minAuth, maxAuth);
    }

    // Also enable the site if not already
    if (!activeSites.has(siteId)) {
      toggleSite(siteId, true);
    }
  }, [sitesById, chainId, positionMapping, molstarInstance, activeSites, toggleSite]);

  // Clear all
  const clearAll = useCallback(() => {
    setActiveSites(new Set());
    clearColorConfig();
    molstarInstance?.restoreDefaultColors();
    onMsaRedraw();
  }, [molstarInstance, onMsaRedraw]);

  return {
    activeSites,
    toggleSite,
    focusSite,
    clearAll,
  };
}