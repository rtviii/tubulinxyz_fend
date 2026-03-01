import { useState, useCallback, useMemo } from 'react';
import { StructureElement, StructureProperties, Structure } from 'molstar/lib/mol-model/structure';
import { MolScriptBuilder as MS } from 'molstar/lib/mol-script/language/builder';
import type { ExplorerContext, ExplorerQuestion } from '../types';
import type { StructureProfile } from '@/lib/profile_utils';
import {
  buildChainQuery,
  buildSurroundingsQuery,
  buildMultiResidueQuery,
  executeQuery,
} from '@/components/molstar/core/queries';
import { getMolstarGhostColor } from '@/components/molstar/colors/palette';
import { Color } from 'molstar/lib/mol-util/color';

const CONTACT_RADIUS = 4.5;

interface ChainInfo {
  chainId: string;
  family?: string;
}

function getPolymerChains(profile: StructureProfile | null): ChainInfo[] {
  if (!profile) return [];
  const chains: ChainInfo[] = [];
  for (const poly of profile.polypeptides) {
    const entity = profile.entities[poly.entity_id];
    const family =
      entity && 'family' in entity ? (entity.family as string) ?? undefined : undefined;
    chains.push({ chainId: poly.auth_asym_id, family });
  }
  return chains;
}

function getInterfaceResidues(
  structure: Structure,
  chainA: string,
  chainB: string
): number[] {
  const surroundsExpr = buildSurroundingsQuery(buildChainQuery(chainA), CONTACT_RADIUS);
  const loci = executeQuery(surroundsExpr, structure);
  if (!loci) return [];

  const ids = new Set<number>();
  StructureElement.Loci.forEachLocation(loci, (loc) => {
    if (StructureProperties.chain.auth_asym_id(loc) === chainB) {
      ids.add(StructureProperties.residue.auth_seq_id(loc));
    }
  });
  return Array.from(ids);
}

function blendColors(a: Color, b: Color): Color {
  const rA = (a >> 16) & 0xFF, gA = (a >> 8) & 0xFF, bA = a & 0xFF;
  const rB = (b >> 16) & 0xFF, gB = (b >> 8) & 0xFF, bB = b & 0xFF;
  return Color.fromRgb(
    Math.round((rA + rB) / 2),
    Math.round((gA + gB) / 2),
    Math.round((bA + bB) / 2),
  );
}

export function useInterfaceContacts(ctx: ExplorerContext): ExplorerQuestion {
  const [isLoading, setIsLoading] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [createdRefs, setCreatedRefs] = useState<string[]>([]);

  const chains = useMemo(() => getPolymerChains(ctx.profile), [ctx.profile]);

  const available = !!ctx.instance && chains.length >= 2 && chains.length <= 8;

  const execute = useCallback(async () => {
    const plugin = ctx.instance?.viewer.ctx;
    const structure = ctx.instance?.viewer.getCurrentStructure();
    if (!plugin || !structure) return;

    setIsLoading(true);
    const refs: string[] = [];

    try {
      const hierarchy = plugin.managers.structure.hierarchy.current;
      if (hierarchy.structures.length === 0) return;
      const structureCell = hierarchy.structures[0].cell;

      for (let i = 0; i < chains.length; i++) {
        for (let j = i + 1; j < chains.length; j++) {
          const a = chains[i];
          const b = chains[j];

          const bNearA = getInterfaceResidues(structure, a.chainId, b.chainId);
          const aNearB = getInterfaceResidues(structure, b.chainId, a.chainId);

          if (bNearA.length === 0 && aNearB.length === 0) continue;

          const colorA = getMolstarGhostColor(a.family);
          const colorB = getMolstarGhostColor(b.family);

          // --- Per-chain ball-and-stick (ghost colored) ---

          if (aNearB.length > 0) {
            const compA = await plugin.builders.structure.tryCreateComponentFromExpression(
              structureCell,
              buildMultiResidueQuery(a.chainId, aNearB),
              `iface-${a.chainId}-near-${b.chainId}`,
              { label: `${a.chainId} interface (near ${b.chainId})` }
            );
            if (compA) {
              refs.push(compA.ref);
              await plugin.builders.structure.representation.addRepresentation(compA, {
                type: 'ball-and-stick',
                color: 'uniform',
                colorParams: { value: colorA },
                typeParams: { sizeFactor: 0.2 },
              });
            }
          }

          if (bNearA.length > 0) {
            const compB = await plugin.builders.structure.tryCreateComponentFromExpression(
              structureCell,
              buildMultiResidueQuery(b.chainId, bNearA),
              `iface-${b.chainId}-near-${a.chainId}`,
              { label: `${b.chainId} interface (near ${a.chainId})` }
            );
            if (compB) {
              refs.push(compB.ref);
              await plugin.builders.structure.representation.addRepresentation(compB, {
                type: 'ball-and-stick',
                color: 'uniform',
                colorParams: { value: colorB },
                typeParams: { sizeFactor: 0.2 },
              });
            }
          }

          // --- NCI dashed lines between the two chains ---

          if (aNearB.length > 0 && bNearA.length > 0) {
            const combinedExpr = MS.struct.combinator.merge([
              buildMultiResidueQuery(a.chainId, aNearB),
              buildMultiResidueQuery(b.chainId, bNearA),
            ]);

            const nciComp = await plugin.builders.structure.tryCreateComponentFromExpression(
              structureCell,
              combinedExpr,
              `iface-nci-${a.chainId}-${b.chainId}`,
              { label: `${a.chainId}/${b.chainId} interactions` }
            );

            if (nciComp) {
              refs.push(nciComp.ref);
              try {
                await plugin.builders.structure.representation.addRepresentation(nciComp, {
                  type: 'interactions',
                  color: 'interaction-type',
                });
              } catch (err) {
                console.warn(`[InterfaceContacts] Could not add interactions repr:`, err);
              }
            }
          }

          // --- Label ---

          if ((aNearB.length > 0 || bNearA.length > 0) && ctx.instance) {
            const labelLoci = aNearB.length > 0
              ? executeQuery(buildMultiResidueQuery(a.chainId, aNearB), structure)
              : executeQuery(buildMultiResidueQuery(b.chainId, bNearA), structure);

            if (labelLoci) {
              const totalResidues = aNearB.length + bNearA.length;
              const labelKey = `iface-label-${a.chainId}-${b.chainId}`;
              const labelColor = blendColors(colorA, colorB);
              await ctx.instance.addExplorerLabel(
                labelKey,
                labelLoci,
                `${a.chainId}/${b.chainId} interface \u00B7 ${totalResidues} residues`,
                labelColor,
              );
              refs.push(labelKey);
            }
          }
        }
      }

      setCreatedRefs(refs);
      setIsActive(true);
    } finally {
      setIsLoading(false);
    }
  }, [ctx.instance, chains]);

  const clear = useCallback(async () => {
    const plugin = ctx.instance?.viewer.ctx;
    if (!plugin) return;

    for (const ref of createdRefs) {
      if (ref.startsWith('iface-label-')) {
        ctx.instance?.removeExplorerLabel(ref);
      } else {
        try {
          await plugin.build().delete(ref).commit();
        } catch { /* already gone */ }
      }
    }

    setCreatedRefs([]);
    setIsActive(false);
  }, [ctx.instance, createdRefs]);

  const label = useMemo(() => {
    if (chains.length === 2) {
      return `Show ${chains[0].chainId}/${chains[1].chainId} interface`;
    }
    return 'Show chain interfaces';
  }, [chains]);

  return {
    id: 'interface-contacts',
    label,
    description: 'Ball-and-stick at inter-chain contact residues with non-covalent interactions',
    available,
    isLoading,
    isActive,
    execute,
    clear,
  };
}