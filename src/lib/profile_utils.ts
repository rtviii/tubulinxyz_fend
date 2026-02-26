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