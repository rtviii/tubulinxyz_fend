import { Color } from 'molstar/lib/mol-util/color';

// ============================================================
// Ligands to skip entirely - crystallography artifacts, buffers,
// solvents, and common additives that carry no biological meaning.
// Used in both the structure preset (skip component creation) and
// the UI (filter from ligand panels).
// ============================================================

export const LIGAND_IGNORE_IDS = new Set([
  'EDO', 'GOL', 'MPD', 'PEG', 'PG4', 'PG0', 'PGE', '1PE', 'P6G', 'P6G',
  'DMS', 'SO4', 'PO4', 'ACT', 'MES', 'CIT', 'BME',
  'HOH', 'DOD', 'WAT',
]);

// ============================================================
// Polymer / MAP family colors
// ============================================================

export const TUBULIN_COLORS: Record<string, Color> = {
  tubulin_alpha: Color(0x4F92E8),
  tubulin_beta: Color(0xE07850),
  tubulin_gamma: Color(0xA07CC0),
  tubulin_delta: Color(0x5EAB70),
  tubulin_epsilon: Color(0xD4C060),
  Default: Color(0xBDC3C7),
};

export const TUBULIN_GHOST_COLORS: Record<string, Color> = {
  tubulin_alpha: Color(0xD4C4A8),
  tubulin_beta: Color(0xB8C4D0),
  Default: Color(0xCCCCCC),
};

export const MAP_COLORS: Record<string, Color> = {
  map_eb_family: Color(0x00CED1),
  map_camsap1: Color(0x20B2AA),
  map_camsap2: Color(0x48D1CC),
  map_camsap3: Color(0x40E0D0),
  map_kinesin13: Color(0xFF1493),
  map_katanin_p60: Color(0xFF69B4),
  map_spastin: Color(0xDA70D6),
  map_tau: Color(0xFF8C00),
  map_map2: Color(0xE67E22),
  map_doublecortin: Color(0xD35400),
  map_gcp2_3: Color(0x1F618D),
  map_gcp4: Color(0x2874A6),
  map_gcp5_6: Color(0x2E86C1),
  map_vash_detyrosinase: Color(0x27AE60),
  map_atat1: Color(0x2ECC71),
  map_ttll_glutamylase_long: Color(0xA9DFBF),
};

// ============================================================
// Ligand colors - single source of truth.
// Hex values are primary; Color() values are derived to stay in sync.
//
// Groupings:
//   Nucleotides        - blues / oranges
//   Taxane-site drugs  - greens
//   Vinca-site drugs   - reds / pinks
//   Kinesin inhibitors - purples
//   Ions               - cyans / yellows
//   Other known        - misc
// ============================================================

const _L = (hex: number): Color => Color(hex);

// The hex strings are the canonical values; Color() objects are
// built from the same literals so they are guaranteed identical.

export const LIGAND_HEX: Record<string, string> = {
  // Nucleotides
  GTP: '#2979FF',  // vivid blue
  GDP: '#FF9100',  // amber
  GCP: '#82B1FF',  // light blue
  GSP: '#448AFF',  // mid blue
  G2P: '#40C4FF',  // sky blue
  G2N: '#00E5FF',  // cyan-blue
  ANP: '#B3E5FC',  // pale blue (GMPPNP)
  ACP: '#FFE082',  // pale amber (GMPPCP)
  ATP: '#5C6BC0',  // indigo
  ADP: '#9FA8DA',  // light indigo
  GP2: '#29B6F6',  // light blue
  O3G: '#0091EA',  // deep sky

  // Taxane-site binders
  TXL: '#00C853',  // vivid green (paclitaxel / taxol)
  EP: '#69F0AE',  // light green (epothilone)
  TA1: '#B9F6CA',  // pale green
  LON: '#1B5E20',  // dark green (laulimalide / peloruside site)
  POD: '#76FF03',  // lime (podophyllotoxin site)

  // Vinca-site binders
  VLB: '#F50057',  // vivid red (vinblastine)
  VCR: '#FF1744',  // red (vincristine - not yet in DB but reserve it)
  CN2: '#FF6D00',  // deep orange (colchicine site)
  COL: '#FF9E80',  // light orange

  // Pironetin / covalent site
  TZT: '#AA00FF',  // purple
  N16: '#E040FB',  // pink-purple

  // Ions - kept as distinct group, not ignored because MG is functionally critical
  MG: '#00E5FF',  // cyan
  ZN: '#EEFF41',  // yellow-green
  CA: '#FF80AB',  // pink
  MN: '#80D8FF',  // light cyan
  NA: '#CCFF90',  // light lime
  K: '#A7FFEB',  // light teal
  CL: '#84FFFF',  // pale cyan
  ZPN: '#B9F6CA',  // pale green

  // Other biologically-relevant ligands in the DB
  BEF: '#FF6E40',  // beryllium fluoride (mimics phosphate)
  AF3: '#FFAB40',  // aluminum fluoride (mimics phosphate)
  ALF: '#FFD740',  // aluminum fluoride variant
  ADP_like: '#9FA8DA',
};

export const LIGAND_COLORS: Record<string, Color> = {
  GTP: _L(0x2979FF),
  GDP: _L(0xFF9100),
  GCP: _L(0x82B1FF),
  GSP: _L(0x448AFF),
  G2P: _L(0x40C4FF),
  G2N: _L(0x00E5FF),
  ANP: _L(0xB3E5FC),
  ACP: _L(0xFFE082),
  ATP: _L(0x5C6BC0),
  ADP: _L(0x9FA8DA),
  GP2: _L(0x29B6F6),
  O3G: _L(0x0091EA),

  TXL: _L(0x00C853),
  EP: _L(0x69F0AE),
  TA1: _L(0xB9F6CA),
  LON: _L(0x1B5E20),
  POD: _L(0x76FF03),

  VLB: _L(0xF50057),
  CN2: _L(0xFF6D00),
  COL: _L(0xFF9E80),

  TZT: _L(0xAA00FF),
  N16: _L(0xE040FB),

  MG: _L(0x00E5FF),
  ZN: _L(0xEEFF41),
  CA: _L(0xFF80AB),
  MN: _L(0x80D8FF),
  NA: _L(0xCCFF90),
  K: _L(0xA7FFEB),
  CL: _L(0x84FFFF),
  ZPN: _L(0xB9F6CA),

  BEF: _L(0xFF6E40),
  AF3: _L(0xFFAB40),
  ALF: _L(0xFFD740),
};

// ============================================================
// Polymer hex colors (for Tailwind / inline styles)
// ============================================================

export const TUBULIN_HEX: Record<string, string> = {
  tubulin_alpha: '#4F92E8',
  tubulin_beta: '#E07850',
  tubulin_gamma: '#A07CC0',
  tubulin_delta: '#5EAB70',
  tubulin_epsilon: '#D4C060',
  Default: '#BDC3C7',
};

export const MAP_HEX: Record<string, string> = {
  map_eb_family: '#00CED1',
  map_camsap1: '#20B2AA',
  map_camsap2: '#48D1CC',
  map_camsap3: '#40E0D0',
  map_kinesin13: '#FF1493',
  map_katanin_p60: '#FF69B4',
  map_spastin: '#DA70D6',
  map_tau: '#FF8C00',
  map_map2: '#E67E22',
  map_doublecortin: '#D35400',
  map_gcp2_3: '#1F618D',
  map_gcp4: '#2874A6',
  map_gcp5_6: '#2E86C1',
  map_vash_detyrosinase: '#27AE60',
  map_atat1: '#2ECC71',
  map_ttll_glutamylase_long: '#A9DFBF',
};

// ============================================================
// Lookup helpers
// ============================================================

export function getMolstarColorForFamily(family?: string | null): Color {
  if (!family) return TUBULIN_COLORS.Default;
  return TUBULIN_COLORS[family] ?? MAP_COLORS[family] ?? _hashColor(family);
}

export function getMolstarGhostColor(family?: string | null): Color {
  if (!family) return TUBULIN_GHOST_COLORS.Default;
  return TUBULIN_GHOST_COLORS[family] ?? TUBULIN_GHOST_COLORS.Default;
}

export function getMolstarLigandColor(compId: string): Color {
  return LIGAND_COLORS[compId] ?? _hashColorFromString(compId, 75, 55);
}

export function getHexForFamily(family?: string | null): string {
  if (!family) return TUBULIN_HEX.Default;
  return TUBULIN_HEX[family] ?? MAP_HEX[family] ?? '#94a3b8';
}

export function getHexForLigand(compId: string): string {
  return LIGAND_HEX[compId] ?? _hashHex(compId, 70, 50);
}

// ============================================================
// Internal utilities
// ============================================================

function _hashColorFromString(s: string, saturation = 75, lightness = 55): Color {
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = s.charCodeAt(i) + ((hash << 5) - hash);
  const h = Math.abs(hash) % 360;
  return _hslToColor(h / 360, saturation / 100, lightness / 100);
}

// Kept for backward compat with any external call sites
export function _hashColor(s: string, saturation = 75, lightness = 55): Color {
  return _hashColorFromString(s, saturation, lightness);
}

function _hashHex(s: string, saturation = 70, lightness = 45): string {
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = s.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360}, ${saturation}%, ${lightness}%)`;
}

function _hslToColor(h: number, s: number, l: number): Color {
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return Color.fromRgb(
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  );
}