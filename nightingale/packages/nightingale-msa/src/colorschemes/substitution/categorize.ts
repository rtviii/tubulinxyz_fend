import { ConservationManager } from "../../types/types";

const A_OFFSET = "A".charCodeAt(0);
const ALPHA_SIZE = 26;
const gaps = new Set(["", " ", "-", "_", "."]);

// --- Tunable thresholds ---
export const CONSENSUS_FLOOR = 0.40;
export const COMMON_THRESHOLD = 0.30;

export type Category =
  | "gap"
  | "consensus"
  | "ambiguous"
  | "common"
  | "conservative"
  | "radical";

// --- Amino acid property groups ---
// 0: Hydrophobic aliphatic (A, V, L, I, M)
// 1: Aromatic (F, W, Y)
// 2: Small/structural (G, P)
// 3: Polar uncharged (S, T, N, Q, C)
// 4: Positively charged (K, R, H)
// 5: Negatively charged (D, E)
// -1: non-standard
const PROPERTY_GROUP = new Int8Array(26);
PROPERTY_GROUP.fill(-1);
PROPERTY_GROUP[0]  = 0; // A
PROPERTY_GROUP[2]  = 3; // C
PROPERTY_GROUP[3]  = 5; // D
PROPERTY_GROUP[4]  = 5; // E
PROPERTY_GROUP[5]  = 1; // F
PROPERTY_GROUP[6]  = 2; // G
PROPERTY_GROUP[7]  = 4; // H
PROPERTY_GROUP[8]  = 0; // I
PROPERTY_GROUP[10] = 4; // K
PROPERTY_GROUP[11] = 0; // L
PROPERTY_GROUP[12] = 0; // M
PROPERTY_GROUP[13] = 3; // N
PROPERTY_GROUP[15] = 2; // P
PROPERTY_GROUP[16] = 3; // Q
PROPERTY_GROUP[17] = 4; // R
PROPERTY_GROUP[18] = 3; // S
PROPERTY_GROUP[19] = 3; // T
PROPERTY_GROUP[21] = 0; // V
PROPERTY_GROUP[22] = 1; // W
PROPERTY_GROUP[24] = 1; // Y

// --- Consensus cache ---
// Per-column: index of the consensus letter (0-25), or -1 if below floor.
let consensusCache: Int8Array | null = null;
let cachedMapRef: ArrayLike<number> | null = null;

export function resetCategorizeCache(): void {
  consensusCache = null;
  cachedMapRef = null;
}

export function categorizeCell(
  baseRaw: string,
  pos: number,
  conservationRaw?: unknown,
): Category {
  const base = baseRaw.toUpperCase();
  const conservation = conservationRaw as ConservationManager | undefined;

  if (!conservation || conservation.progress !== 1 || gaps.has(base)) {
    return "gap";
  }

  const totalPositions = conservation.map.length / ALPHA_SIZE;
  if (pos >= totalPositions) return "gap";

  const letterIdx = base.charCodeAt(0) - A_OFFSET;
  if (letterIdx < 0 || letterIdx >= ALPHA_SIZE) return "gap";

  // Rebuild consensus cache if conservation data changed
  if (cachedMapRef !== conservation.map) {
    cachedMapRef = conservation.map;
    const numPos = Math.floor(totalPositions);
    consensusCache = new Int8Array(numPos);

    for (let p = 0; p < numPos; p++) {
      let maxFreq = 0;
      let maxIdx = -1;
      const offset = p * ALPHA_SIZE;
      for (let a = 0; a < ALPHA_SIZE; a++) {
        const f = conservation.map[offset + a] || 0;
        if (f > maxFreq) {
          maxFreq = f;
          maxIdx = a;
        }
      }
      consensusCache[p] = maxFreq >= CONSENSUS_FLOOR ? maxIdx : -1;
    }
  }

  const consensusIdx = consensusCache![pos];
  if (consensusIdx === -1) return "ambiguous";
  if (letterIdx === consensusIdx) return "consensus";

  const freq = conservation.map[pos * ALPHA_SIZE + letterIdx] || 0;
  if (freq > COMMON_THRESHOLD) return "common";

  const baseGroup = PROPERTY_GROUP[letterIdx];
  const consGroup = PROPERTY_GROUP[consensusIdx];
  if (baseGroup >= 0 && consGroup >= 0 && baseGroup === consGroup) {
    return "conservative";
  }
  return "radical";
}
