/**
 * Canonical chainKey format: "${RCSB_ID_UPPERCASE}_${authAsymId}"
 * RCSB IDs are always 4 alphanumeric characters with no underscores,
 * so splitting on '_' and taking the tail is unambiguous.
 *
 * Examples: "1JFF_B", "9F3B_A"
 */

export function makeChainKey(rcsbId: string, authAsymId: string): string {
  return `${rcsbId.toUpperCase()}_${authAsymId}`;
}

export function authAsymIdFromChainKey(chainKey: string): string {
  return chainKey.slice(5); // 4-char RCSB ID + '_'
}