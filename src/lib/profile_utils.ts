import type { TubulinStructure } from '@/store/tubxz_api';

export type StructureProfile = TubulinStructure;

export function getFamilyForChain(
  profile: TubulinStructure | null,
  chainId: string
): string | undefined {
  if (!profile) return undefined;
  const poly = profile.polypeptides.find(p => p.auth_asym_id === chainId);
  if (!poly) return undefined;
  const entity = profile.entities[poly.entity_id];
  if (!entity || !('family' in entity)) return undefined;
  return entity.family ?? undefined;
}

/**
 * Families that currently have a master MSA alignment — i.e. for which expert
 * (chain) mode and the MSA panel are actually populated. Everything else (other
 * tubulins γ/δ/ε, MAPs/MIPs, unclassified) has no alignment yet, so expert mode
 * would open an empty MSA and must be blocked. Extend this set as alignments
 * are added on the backend.
 */
export const ALIGNABLE_FAMILIES = new Set<string>(['tubulin_alpha', 'tubulin_beta']);

export function isAlignableFamily(family?: string | null): boolean {
  return !!family && ALIGNABLE_FAMILIES.has(family);
}

/** Whether a given chain can be opened in expert mode (has an MSA alignment). */
export function chainIsAlignable(
  profile: TubulinStructure | null,
  chainId: string
): boolean {
  return isAlignableFamily(getFamilyForChain(profile, chainId));
}

export function getIsotypeForChain(
  profile: TubulinStructure | null,
  chainId: string
): string | null {
  if (!profile) return null;
  for (const entity of Object.values(profile.entities)) {
    if (
      'pdbx_strand_ids' in entity &&
      (entity as any).pdbx_strand_ids?.includes(chainId) &&
      'isotype' in entity
    ) {
      return (entity as any).isotype ?? null;
    }
  }
  return null;
}