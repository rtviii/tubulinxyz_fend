// src/components/explorer/questions/useNucleotideHighlight.ts

import { useState, useCallback, useMemo } from 'react';
import type { ExplorerContext, ExplorerQuestion } from '../types';

const NUCLEOTIDE_IDS = new Set([
  'GTP', 'GDP', 'GNP', 'GSP', 'GMPPCP', 'GMPPNP', 'GPPNHP', 'GTPS',
  'ATP', 'ADP', 'ANP', 'ACP',
]);

export function useNucleotideHighlight(ctx: ExplorerContext): ExplorerQuestion {
  const [isActive, setIsActive] = useState(false);

  const nucleotideLigands = useMemo(() => {
    if (!ctx.profile) return [];
    return ctx.profile.nonpolymers.filter(np => {
      const entity = ctx.profile!.entities[np.entity_id];
      if (!entity || !('chemical_id' in entity)) return false;
      return NUCLEOTIDE_IDS.has(entity.chemical_id);
    });
  }, [ctx.profile]);

  const available = nucleotideLigands.length > 0 && !!ctx.instance;

  const execute = useCallback(async () => {
    if (!ctx.instance || nucleotideLigands.length === 0) return;

    for (const np of nucleotideLigands) {
      const entity = ctx.profile!.entities[np.entity_id];
      if (!entity || !('chemical_id' in entity)) continue;

      const key = `${entity.chemical_id}_${np.auth_asym_id}_${np.auth_seq_id}`;
      ctx.instance.setLigandVisibility(key, true);
    }

    // Focus the first nucleotide
    if (nucleotideLigands.length > 0) {
      const np = nucleotideLigands[0];
      const entity = ctx.profile!.entities[np.entity_id];
      if (entity && 'chemical_id' in entity) {
        const key = `${entity.chemical_id}_${np.auth_asym_id}_${np.auth_seq_id}`;
        ctx.instance.focusLigand(key);
      }
    }

    setIsActive(true);
  }, [ctx.instance, ctx.profile, nucleotideLigands]);

  const clear = useCallback(async () => {
    if (!ctx.instance) return;
    ctx.instance.viewer.resetCamera();
    setIsActive(false);
  }, [ctx.instance]);

  return {
    id: 'nucleotide-sites',
    label: 'Show nucleotide binding sites',
    description: 'Highlight GTP/GDP and other nucleotides bound in this structure',
    available,
    isLoading: false,
    isActive,
    execute,
    clear,
  };
}