// src/lib/tubulin-colors.ts
import { TubulinFamily, MapFamily } from '@/store/tubxz_api';

// src/lib/tubulin-colors.ts
export const TubulinFamilyColors: Record<string, string> = {
    "tubulin_alpha": "#3784F0",
    "tubulin_beta": "#EB6134",
    "tubulin_gamma": "#884EA0",
    "tubulin_delta": "#1D8348",
    "tubulin_epsilon": "#D4AC0D",
    "Default": "#BDC3C7"
};

export const MapFamilyColors: Record<string, string> = {
    "map_eb_family": "#00CED1",
    "map_camsap1": "#20B2AA",
    "map_camsap2": "#48D1CC",
    "map_camsap3": "#40E0D0",
    "map_kinesin13": "#FF1493",
    "map_katanin_p60": "#FF69B4",
    "map_spastin": "#DA70D6",
    "map_tau": "#FF8C00",
    "map_map2": "#E67E22",
    "map_doublecortin": "#D35400",
    "map_gcp2_3": "#1F618D",
    "map_gcp4": "#2874A6",
    "map_gcp5_6": "#2E86C1",
    "map_vash_detyrosinase": "#27AE60",
    "map_atat1": "#2ECC71",
    "map_ttll_glutamylase_long": "#A9DFBF",
};

export const LigandColors: Record<string, string> = {
    'GTP': "#859799",
    'GDP': "#FFD700",
    'TXL': "#FF00FF",
    'VLB': "#00FFFF",
    'MG': "#FF4500",
};

export function getHexColor(value: string): string {
    return TubulinFamilyColors[value] || MapFamilyColors[value] || LigandColors[value] || "#94a3b8";
}

export function getFamilyColor(family?: string | null): string {
    if (!family) return TubulinFamilyColors.Default;
    return TubulinFamilyColors[family] || MapFamilyColors[family] || "#94a3b8";
}

export function getLigandColor(compId: string): string {
    if (LigandColors[compId]) return LigandColors[compId];
    
    // Simple JS hash for dynamic fallback if not in anchors
    let hash = 0;
    for (let i = 0; i < compId.length; i++) {
        hash = compId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash) % 360;
    return `hsl(${h}, 70%, 45%)`;
}