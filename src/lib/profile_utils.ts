export interface StructureProfile {
  rcsb_id: string;
  entities: Record<string, { family?: string; [key: string]: any }>;
  polypeptides: Array<{ auth_asym_id: string; entity_id: string }>;
  [key: string]: any;
}

export function getFamilyForChain(
  profile: StructureProfile | null,
  chainId: string
): string | undefined {
  if (!profile) return undefined;
  const poly = profile.polypeptides.find(p => p.auth_asym_id === chainId);
  if (!poly) return undefined;
  return profile.entities[poly.entity_id]?.family;
}