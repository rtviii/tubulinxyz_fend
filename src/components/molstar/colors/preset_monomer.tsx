import { MolScriptBuilder as MS } from 'molstar/lib/mol-script/language/builder';
import { StateObjectRef } from 'molstar/lib/mol-state';
import { StructureRepresentationPresetProvider } from 'molstar/lib/mol-plugin-state/builder/structure/representation-preset';
import { ParamDefinition as PD } from 'molstar/lib/mol-util/param-definition';
import { Color } from 'molstar/lib/mol-util/color';
import { getResidueSequence, ResidueData } from './preset-helpers';

const DEFAULT_CHAIN_COLOR = Color(0x5A9BD5);

export interface MonomerPresetResult {
  chainRef: string;
  chainId: string;
  sequence: ResidueData[];
}

export const MonomerPreset = StructureRepresentationPresetProvider({
  id: 'monomer-single-chain',
  display: {
    name: 'Single Chain (Monomer View)',
    group: 'TubulinXYZ',
    description: 'Isolated single chain for detailed analysis'
  },
  params: () => ({
    ...StructureRepresentationPresetProvider.CommonParams,
    chainId: PD.Text('', { description: 'Chain to display' }),
    chainColor: PD.Value<Color>(DEFAULT_CHAIN_COLOR, { isHidden: true }),
  }),

  async apply(ref, params, plugin): Promise<MonomerPresetResult | {}> {
    const structureCell = StateObjectRef.resolveAndCheck(plugin.state.data, ref);
    if (!structureCell || !params.chainId) return {};

    const { update } = StructureRepresentationPresetProvider.reprBuilder(plugin, params);

    const component = await plugin.builders.structure.tryCreateComponentFromExpression(
      structureCell,
      MS.struct.generator.atomGroups({
        'chain-test': MS.core.rel.eq([
          MS.struct.atomProperty.macromolecular.auth_asym_id(),
          params.chainId
        ])
      }),
      `monomer_${params.chainId}`,
      { label: `Chain ${params.chainId}` }
    );

    if (!component) return {};

    await plugin.builders.structure.representation.addRepresentation(component, {
      type: 'cartoon',
      color: 'uniform',
      colorParams: { value: params.chainColor }
    });

    await update.commit({ revertOnError: true });

    return {
      chainRef: component.ref,
      chainId: params.chainId,
      sequence: getResidueSequence(component, params.chainId)
    };
  }
});