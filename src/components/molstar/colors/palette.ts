import { Color } from 'molstar/lib/mol-util/color';

// ============================================================
// Molstar Color objects -- used in representations and presets
// ============================================================

// Full-intensity colors for the structure overview (slightly softened from original
// to reduce visual jarring when transitioning to ghost/monomer view).
export const TUBULIN_COLORS: Record<string, Color> = {
  tubulin_alpha:   Color(0x4F92E8),  // softer blue (was 0x3784F0)
  tubulin_beta:    Color(0xE07850),  // softer terracotta (was 0xEB6134)
  tubulin_gamma:   Color(0xA07CC0),
  tubulin_delta:   Color(0x5EAB70),
  tubulin_epsilon: Color(0xD4C060),
  Default:         Color(0xBDC3C7),
};

// Ghost colors for monomer view -- very muted, low-saturation neutrals.
// Annotations painted on top will pop against these.
export const TUBULIN_GHOST_COLORS: Record<string, Color> = {
  tubulin_alpha: Color(0xD4C4A8),  // warm sandy beige
  tubulin_beta:  Color(0xB8C4D0),  // cool blue-gray
  Default:       Color(0xCCCCCC),
};

export const MAP_COLORS: Record<string, Color> = {
  map_eb_family:             Color(0x00CED1),
  map_camsap1:               Color(0x20B2AA),
  map_camsap2:               Color(0x48D1CC),
  map_camsap3:               Color(0x40E0D0),
  map_kinesin13:             Color(0xFF1493),
  map_katanin_p60:           Color(0xFF69B4),
  map_spastin:               Color(0xDA70D6),
  map_tau:                   Color(0xFF8C00),
  map_map2:                  Color(0xE67E22),
  map_doublecortin:          Color(0xD35400),
  map_gcp2_3:                Color(0x1F618D),
  map_gcp4:                  Color(0x2874A6),
  map_gcp5_6:                Color(0x2E86C1),
  map_vash_detyrosinase:     Color(0x27AE60),
  map_atat1:                 Color(0x2ECC71),
  map_ttll_glutamylase_long: Color(0xA9DFBF),
};

export const LIGAND_COLORS: Record<string, Color> = {
  GTP: Color(0x859799),
  GDP: Color(0xFFD700),
  TXL: Color(0xFF00FF),
  VLB: Color(0x00FFFF),
  MG:  Color(0xFF4500),
};

// ============================================================
// Hex strings -- for Tailwind / React inline styles / UI chips.
// Keep in sync with the Color values above.
// ============================================================

export const TUBULIN_HEX: Record<string, string> = {
  tubulin_alpha:   '#4F92E8',
  tubulin_beta:    '#E07850',
  tubulin_gamma:   '#A07CC0',
  tubulin_delta:   '#5EAB70',
  tubulin_epsilon: '#D4C060',
  Default:         '#BDC3C7',
};

export const MAP_HEX: Record<string, string> = {
  map_eb_family:             '#00CED1',
  map_camsap1:               '#20B2AA',
  map_camsap2:               '#48D1CC',
  map_camsap3:               '#40E0D0',
  map_kinesin13:             '#FF1493',
  map_katanin_p60:           '#FF69B4',
  map_spastin:               '#DA70D6',
  map_tau:                   '#FF8C00',
  map_map2:                  '#E67E22',
  map_doublecortin:          '#D35400',
  map_gcp2_3:                '#1F618D',
  map_gcp4:                  '#2874A6',
  map_gcp5_6:                '#2E86C1',
  map_vash_detyrosinase:     '#27AE60',
  map_atat1:                 '#2ECC71',
  map_ttll_glutamylase_long: '#A9DFBF',
};

export const LIGAND_HEX: Record<string, string> = {
  GTP: '#859799',
  GDP: '#FFD700',
  TXL: '#FF00FF',
  VLB: '#00FFFF',
  MG:  '#FF4500',
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
  return LIGAND_COLORS[compId] ?? _hashColor(compId, 85, 60);
}

export function getHexForFamily(family?: string | null): string {
  if (!family) return TUBULIN_HEX.Default;
  return TUBULIN_HEX[family] ?? MAP_HEX[family] ?? '#94a3b8';
}

export function getHexForLigand(compId: string): string {
  if (LIGAND_HEX[compId]) return LIGAND_HEX[compId];
  let hash = 0;
  for (let i = 0; i < compId.length; i++) hash = compId.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360}, 70%, 45%)`;
}

// ============================================================
// Internal utilities
// ============================================================

function _hashColor(s: string, saturation = 75, lightness = 55): Color {
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = s.charCodeAt(i) + ((hash << 5) - hash);
  const h = Math.abs(hash) % 360;
  return _hslToColor(h / 360, saturation / 100, lightness / 100);
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