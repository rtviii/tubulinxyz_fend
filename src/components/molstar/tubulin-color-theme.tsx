import { StructureElement, Unit } from 'molstar/lib/mol-model/structure';
import { ColorTheme, LocationColor } from 'molstar/lib/mol-theme/color';
import { ThemeDataContext } from 'molstar/lib/mol-theme/theme';
import { Color } from 'molstar/lib/mol-util/color';
import { ParamDefinition as PD } from 'molstar/lib/mol-util/param-definition';
import { Location } from 'molstar/lib/mol-model/location';
import { ColorThemeCategory } from 'molstar/lib/mol-theme/color/categories';
import { getPaletteParams } from 'molstar/lib/mol-util/color/palette';
import { StructureProperties } from 'molstar/lib/mol-model/structure'; // Make sure this import is at the top


// Define the colors we want to use
const AlphaTubulinColor = Color(0x3b82f6); // Blue
const BetaTubulinColor = Color(0xf97316);  // Orange
const DefaultColor = Color(0x808080);      // Gray

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