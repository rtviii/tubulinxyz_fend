import { useState, useCallback, useMemo } from 'react';
import { API_BASE_URL } from '@/config';
import type { ExplorerContext, ExplorerQuestion } from '../types';
import type { StructureProfile } from '@/lib/profile_utils';
import { masterFrequenciesToColorings } from '../heatmapColors';
import { getMolstarLigandColor } from '@/components/molstar/colors/palette';
import { buildMultiResidueQuery, executeQuery } from '@/components/molstar/core/queries';

interface CanonicalBindingSiteResponse {
  chemical_id: string;
  chemical_name: string | null;
  family: string;
  structure_count: number;
  residues: Array<{ master_index: number; count: number; frequency: number }>;
}

function getChainsForFamily(
  profile: StructureProfile | null,
  family: string
): Array<{ chainId: string; masterToAuth: Record<string, number | null> }> {
  if (!profile) return [];
  const result: Array<{ chainId: string; masterToAuth: Record<string, number | null> }> = [];

  for (const poly of profile.polypeptides) {
    const entity = profile.entities[poly.entity_id];
    if (!entity || !('family' in entity) || entity.family !== family) continue;
    if (!('chain_index_mappings' in entity) || !entity.chain_index_mappings) continue;

    const mapping = entity.chain_index_mappings[poly.auth_asym_id];
    if (!mapping) continue;

    result.push({
      chainId: poly.auth_asym_id,
      masterToAuth: mapping.master_to_auth_seq_id,
    });
  }

  return result;
}

export function useCanonicalBindingSite(
  ctx: ExplorerContext,
  chemicalId: string,
  family: string,
  label?: string,
): ExplorerQuestion {
  const [isLoading, setIsLoading] = useState(false);
  const [isActive, setIsActive] = useState(false);

  const chains = useMemo(
    () => getChainsForFamily(ctx.profile, family),
    [ctx.profile, family]
  );

  const available = chains.length > 0 && !!ctx.instance;

  // Ligand color from the palette -- used for both heatmap gradient and label
  const ligandColor = useMemo(() => getMolstarLigandColor(chemicalId), [chemicalId]);

  const execute = useCallback(async () => {
    if (!ctx.instance || chains.length === 0) return;

    setIsLoading(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/ligands/canonical-site/${chemicalId}/${family}`
      );
      if (!res.ok) return;
      const data: CanonicalBindingSiteResponse = await res.json();

      const freqMap = new Map<number, number>();
      for (const r of data.residues) {
        freqMap.set(r.master_index, r.frequency);
      }

      const allColorings = chains.flatMap(({ chainId, masterToAuth }) =>
        masterFrequenciesToColorings(freqMap, masterToAuth, chainId, ligandColor)
      );

      if (allColorings.length > 0) {
        await ctx.instance.applyColorscheme(`canonical-site-${chemicalId}`, allColorings);

        const structure = ctx.instance.viewer.getCurrentStructure();
        if (structure) {
          const sorted = [...allColorings].sort((a, b) => {
            const freqA = freqMap.get(
              Number(Object.entries(chains[0].masterToAuth)
                .find(([, v]) => v === a.authSeqId)?.[0] ?? 0)
            ) ?? 0;
            const freqB = freqMap.get(
              Number(Object.entries(chains[0].masterToAuth)
                .find(([, v]) => v === b.authSeqId)?.[0] ?? 0)
            ) ?? 0;
            return freqB - freqA;
          });

          const topResidues = sorted.slice(0, Math.min(5, sorted.length));
          if (topResidues.length > 0) {
            const loci = executeQuery(
              buildMultiResidueQuery(
                topResidues[0].chainId,
                topResidues.map(r => r.authSeqId)
              ),
              structure
            );

            if (loci) {
              const familyShort = family.replace('tubulin_', '');
              const labelText = data.chemical_name
                ? `${data.chemical_name} site \u00B7 ${data.structure_count} structures`
                : `${chemicalId} site (${familyShort}) \u00B7 ${data.structure_count} structures`;

              await ctx.instance.addExplorerLabel(
                `canonical-label-${chemicalId}`,
                loci,
                labelText,
                ligandColor,
              );
            }
          }
        }
      }

      setIsActive(true);
    } finally {
      setIsLoading(false);
    }
  }, [ctx.instance, chains, chemicalId, family, ligandColor]);

  const clear = useCallback(async () => {
    if (ctx.instance) {
      ctx.instance.removeExplorerLabel(`canonical-label-${chemicalId}`);
      await ctx.instance.restoreDefaultColors();
    }
    setIsActive(false);
  }, [ctx.instance, chemicalId]);

  return {
    id: `canonical-site-${chemicalId}-${family}`,
    label: label ?? `Where does ${chemicalId} bind?`,
    description: `Binding frequency of ${chemicalId} across all ${family.replace('tubulin_', '')} tubulins in the database`,
    available,
    isLoading,
    isActive,
    execute,
    clear,
  };
}