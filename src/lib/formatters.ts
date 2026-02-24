export function formatFamilyShort(family: string): string {
  const tubulinMatch = family.match(/^tubulin_(\w+)$/);
  if (tubulinMatch) {
    const t = tubulinMatch[1];
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  const mapMatch = family.match(/^map_(\w+)/);
  if (mapMatch) return mapMatch[1].toUpperCase();
  return family;
}