import { StructureElement } from 'molstar/lib/mol-model/structure';
import { ColorTheme, LocationColor } from 'molstar/lib/mol-theme/color';
import { ThemeDataContext } from 'molstar/lib/mol-theme/theme';
import { Color } from 'molstar/lib/mol-util/color';
import { ParamDefinition as PD } from 'molstar/lib/mol-util/param-definition';
import { Location } from 'molstar/lib/mol-model/location';
import { ColorThemeCategory } from 'molstar/lib/mol-theme/color/categories';
import { StructureProperties } from 'molstar/lib/mol-model/structure';
import { TUBULIN_COLORS, TUBULIN_HEX, MAP_HEX, LIGAND_HEX } from './palette';

// Re-export hex maps for UI consumers so they import from one place.
export { TUBULIN_HEX as TubulinFamilyColors, MAP_HEX as MapFamilyColors, LIGAND_HEX as LigandColors };

// Also export getHexForFamily / getHexForLigand from palette so callers
// that previously imported getFamilyColor / getLigandColor from here still work.
export { getHexForFamily as getFamilyColor, getHexForLigand as getLigandColor, getHexForFamily as getHexColor } from './palette';

const Description = 'Colors alpha-tubulin and beta-tubulin based on provided classification.';

export const TubulinChainColorThemeParams = {
  classification: PD.Value<Record<string, 'alpha' | 'beta'>>({}, { isHidden: true }),
};
export type TubulinChainColorThemeParams = typeof TubulinChainColorThemeParams;

export function TubulinChainColorTheme(
  ctx: ThemeDataContext,
  props: PD.Values<TubulinChainColorThemeParams>
): ColorTheme<TubulinChainColorThemeParams> {
  const color: LocationColor = (location: Location): Color => {
    if (StructureElement.Location.is(location)) {
      const id = StructureProperties.chain.auth_asym_id(location);
      const cls = props.classification[id];
      if (cls === 'alpha') return TUBULIN_COLORS.tubulin_alpha;
      if (cls === 'beta') return TUBULIN_COLORS.tubulin_beta;
    }
    return TUBULIN_COLORS.Default;
  };

  return {
    factory: TubulinChainColorTheme,
    granularity: 'group',
    color,
    props,
    description: Description,
  };
}

export const TubulinChainColorThemeProvider: ColorTheme.Provider<TubulinChainColorThemeParams, 'tubulin-chain-id'> = {
  name: 'tubulin-chain-id',
  label: 'Tubulin Chain ID',
  category: ColorThemeCategory.Chain,
  factory: TubulinChainColorTheme,
  getParams: () => TubulinChainColorThemeParams,
  defaultValues: PD.getDefaultValues(TubulinChainColorThemeParams),
  isApplicable: (ctx: ThemeDataContext) => !!ctx.structure,
};