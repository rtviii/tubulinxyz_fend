import { ConservationManager } from "../types/types";
import { ColorStructure } from "./schemeclass";

const A_OFFSET = "A".charCodeAt(0);
const ALPHA_SIZE = 26;
const gaps = new Set(["", " ", "-", "_", "."]);

// --- Tunable thresholds ---
const CONSENSUS_FLOOR = 0.40;
const COMMON_THRESHOLD = 0.30;

// --- Colors ---
const COLOR_GAP          = "#ffffff";
const COLOR_CONSENSUS    = "#f0f0f0";
const COLOR_AMBIGUOUS    = "#cdc4b4";
const COLOR_COMMON_SUB   = "#e8c87a";
const COLOR_RARE_CONSERV = "#e09850";
const COLOR_RARE_RADICAL = "#c8553a";

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
// A=0
PROPERTY_GROUP[0] = 0;
// C=3
PROPERTY_GROUP[2] = 3;
// D=5, E=5
PROPERTY_GROUP[3] = 5;
PROPERTY_GROUP[4] = 5;
// F=1
PROPERTY_GROUP[5] = 1;
// G=2
PROPERTY_GROUP[6] = 2;
// H=4
PROPERTY_GROUP[7] = 4;
// I=0
PROPERTY_GROUP[8] = 0;
// K=4
PROPERTY_GROUP[10] = 4;
// L=0
PROPERTY_GROUP[11] = 0;
// M=0
PROPERTY_GROUP[12] = 0;
// N=3
PROPERTY_GROUP[13] = 3;
// P=2
PROPERTY_GROUP[15] = 2;
// Q=3
PROPERTY_GROUP[16] = 3;
// R=4
PROPERTY_GROUP[17] = 4;
// S=3
PROPERTY_GROUP[18] = 3;
// T=3
PROPERTY_GROUP[19] = 3;
// V=0
PROPERTY_GROUP[21] = 0;
// W=1
PROPERTY_GROUP[22] = 1;
// Y=1
PROPERTY_GROUP[24] = 1;

// --- Consensus cache ---
// Per-column: index of the consensus letter (0-25), or -1 if below floor.
let consensusCache: Int8Array | null        = null;
let consensusFreqCache: Float32Array | null = null;
let cachedMapRef: ArrayLike<number> | null  = null;
let _loggedOnce                             = false;

const substitutionSalience: ColorStructure = {
  init: function () {
    consensusCache = null;
    consensusFreqCache = null;
    cachedMapRef = null;
    _loggedOnce = false;
    console.log('[SubstitutionSalience] init called');
  },

  run: function (
    baseRaw: string,
    pos: number,
    conservationRaw?: unknown,
    _row?: number
  ): string {
    const base = baseRaw.toUpperCase();
    const conservation = conservationRaw as ConservationManager | undefined;

    if (!_loggedOnce) {
      _loggedOnce = true;
      console.log('[SubstitutionSalience] first run() call:', {
        base,
        pos,
        hasConservation: !!conservation,
        progress: conservation?.progress,
        mapLength: conservation?.map?.length,
      });
    }

    if (!conservation || conservation.progress !== 1 || gaps.has(base))
      return COLOR_GAP;

    const totalPositions = conservation.map.length / ALPHA_SIZE;
    if (pos >= totalPositions) return COLOR_GAP;

    const letterIdx = base.charCodeAt(0) - A_OFFSET;
    if (letterIdx < 0 || letterIdx >= ALPHA_SIZE) return COLOR_GAP;

    // Rebuild consensus cache if conservation data changed
    if (cachedMapRef !== conservation.map) {
      cachedMapRef = conservation.map;
      const numPos = Math.floor(totalPositions);
      consensusCache = new Int8Array(numPos);
      consensusFreqCache = new Float32Array(numPos);

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
        if (maxFreq >= CONSENSUS_FLOOR) {
          consensusCache[p] = maxIdx;
          consensusFreqCache[p] = maxFreq;
        } else {
          consensusCache[p] = -1;
          consensusFreqCache[p] = maxFreq;
        }
      }
    }

    // No consensus at this column
    const consensusIdx = consensusCache![pos];
    if (consensusIdx === -1) return COLOR_AMBIGUOUS;

    // Consensus match
    if (letterIdx === consensusIdx) return COLOR_CONSENSUS;

    // Substitution: check frequency of the current residue
    const freq = conservation.map[pos * ALPHA_SIZE + letterIdx] || 0;
    if (freq > COMMON_THRESHOLD) return COLOR_COMMON_SUB;

    // Rare substitution: conservative vs radical
    const baseGroup = PROPERTY_GROUP[letterIdx];
    const consGroup = PROPERTY_GROUP[consensusIdx];

    if (baseGroup >= 0 && consGroup >= 0 && baseGroup === consGroup) {
      return COLOR_RARE_CONSERV;
    }
    return COLOR_RARE_RADICAL;
  },

  map: {
    "Consensus"          : COLOR_CONSENSUS,
    "Ambiguous column"   : COLOR_AMBIGUOUS,
    "Common substitution": COLOR_COMMON_SUB,
    "Conservative (rare)": COLOR_RARE_CONSERV,
    "Radical (rare)"     : COLOR_RARE_RADICAL,
  },
};

export default substitutionSalience;
