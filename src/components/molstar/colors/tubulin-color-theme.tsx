import { StructureElement, Unit } from 'molstar/lib/mol-model/structure';
import { ColorTheme, LocationColor } from 'molstar/lib/mol-theme/color';
import { ThemeDataContext } from 'molstar/lib/mol-theme/theme';
import { Color } from 'molstar/lib/mol-util/color';
import { ParamDefinition as PD } from 'molstar/lib/mol-util/param-definition';
import { Location } from 'molstar/lib/mol-model/location';
import { ColorThemeCategory } from 'molstar/lib/mol-theme/color/categories';
import { getPaletteParams } from 'molstar/lib/mol-util/color/palette';
import { StructureProperties } from 'molstar/lib/mol-model/structure'; // Make sure this import is at the top
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
                                            // Define the colors we want to use
const AlphaTubulinColor = Color(0x3b82f6);  // Blue
const BetaTubulinColor = Color(0xf97316);   // Orange
const DefaultColor = Color(0x808080);       // Gray

const Description = 'Colors alpha-tubulin blue and beta-tubulin orange based on provided classification.';

// Define the parameters our theme will accept. Crucially, it takes our classification map.
export const TubulinChainColorThemeParams = {
    classification: PD.Value<Record<string, 'alpha' | 'beta'>>({}, { isHidden: true })
};
export type TubulinChainColorThemeParams = typeof TubulinChainColorThemeParams;

// This is the core function that performs the coloring logic.
export function TubulinChainColorTheme(ctx: ThemeDataContext, props: PD.Values<TubulinChainColorThemeParams>): ColorTheme<TubulinChainColorThemeParams> {
    const color: LocationColor = (location: Location): Color => {
        if (StructureElement.Location.is(location)) {
            // For a given atom, find its chain ID

            const id = StructureProperties.chain.auth_asym_id(location);

            // Look up the chain ID in our classification map
            const tubulinClass = props.classification[id];

            // Return the correct color
            if (tubulinClass === 'alpha') {
                return AlphaTubulinColor;
            } else if (tubulinClass === 'beta') {
                return BetaTubulinColor;
            }
        }
        return DefaultColor;
    };

    return {
        factory: TubulinChainColorTheme,
        granularity: 'group', // Color whole residues/chains at a time
        color: color,
        props: props,
        description: Description,
    };
}

// Create a "Provider" for the theme, which is how Mol* manages and lists available themes.
export const TubulinChainColorThemeProvider: ColorTheme.Provider<TubulinChainColorThemeParams, 'tubulin-chain-id'> = {
    name: 'tubulin-chain-id',
    label: 'Tubulin Chain ID',
    category: ColorThemeCategory.Chain,
    factory: TubulinChainColorTheme,
    getParams: () => TubulinChainColorThemeParams,
    defaultValues: PD.getDefaultValues(TubulinChainColorThemeParams),
    isApplicable: (ctx: ThemeDataContext) => !!ctx.structure
};