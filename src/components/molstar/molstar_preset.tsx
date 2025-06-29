import { Structure, StructureProperties } from 'molstar/lib/mol-model/structure';
import { MolScriptBuilder as MS } from 'molstar/lib/mol-script/language/builder';
import { StateObjectRef, StateObjectSelector } from 'molstar/lib/mol-state';
import { StructureRepresentationPresetProvider } from 'molstar/lib/mol-plugin-state/builder/structure/representation-preset';
import { ParamDefinition as PD } from 'molstar/lib/mol-util/param-definition';
import { Color } from 'molstar/lib/mol-util/color';
import { AMINO_ACIDS_3_TO_1_CODE, ResidueData, getLigands, getResidueSequence } from './preset-helpers';

// Define the Tubulin types and the parameter object shape
export enum TubulinClass {
    Alpha = "alpha",
    Beta = "beta",
}
export type TubulinClassification = Record<string, TubulinClass>;

// Define specific colors for each tubulin type
const TubulinColors = {
    [TubulinClass.Alpha]: Color(0x3b82f6), // Blue
    [TubulinClass.Beta]: Color(0xf97316),  // Orange
    Default: Color(0x808080)              // Gray for any unclassified chains
};

export const TubulinSplitPreset = StructureRepresentationPresetProvider({
    id: 'tubulin-split-preset',
    display: {
        name: 'Split Tubulin Chains',
        group: 'TubulinXYZ',
        description: 'Colors alpha-tubulin blue and beta-tubulin orange.'
    },
    // UPDATED: Define the parameters the preset will accept
    params: () => ({
        ...StructureRepresentationPresetProvider.CommonParams,
        pdbId: PD.Text('', { description: 'PDB ID used for tagging components' }),
        tubulinClassification: PD.Value<TubulinClassification>({}, { isHidden: true })
    }),

    async apply(ref, params, plugin) {
        const structureCell = StateObjectRef.resolveAndCheck(plugin.state.data, ref);
        if (!structureCell) return {};

        const structure = structureCell.obj!.data;
        const { update, builder, typeParams, color, symmetryColor } = StructureRepresentationPresetProvider.reprBuilder(
            plugin,
            params,
            structure
        );
        const objects_polymer: { [k: string]: { ref: string; sequence: ResidueData[] } } = {};
        const objects_ligand: { [k: string]: { ref: string } } = {};
        const components: { [k: string]: StateObjectSelector | undefined } = {};
        const representations: { [k: string]: StateObjectSelector | undefined } = {};

        // --- USING YOUR WORKING CHAIN DISCOVERY LOGIC ---
        const chains = new Set<string>();
        for (const unit of structure.units) {
            const { auth_asym_id } = StructureProperties.chain;
            // This is a simple and effective way to get all chain IDs in the model
            chains.add(auth_asym_id({ unit, element: unit.elements[0] }));
        }

        for (const chainId of Array.from(chains).sort()) {
            const chainSelection = MS.struct.generator.atomGroups({
                'chain-test': MS.core.rel.eq([MS.struct.atomProperty.macromolecular.auth_asym_id(), chainId])
            });

            // tryCreateComponentFromExpression will return `undefined` for non-polymers (e.g., water, ligands),
            // which is perfect. We only proceed if a valid polymer component is created.
            const component = await plugin.builders.structure.tryCreateComponentFromExpression(
                structureCell,
                chainSelection,
                `${params.pdbId}_${chainId}`, // Use the pdbId from params for a unique ID
                { label: `Polymer ${chainId}` }
            );

            if (component) {
                // --- NEW: Coloring logic based on the classification map ---
                const tubulinClass = params.tubulinClassification[chainId];
                const color = TubulinColors[tubulinClass] || TubulinColors.Default;

                await plugin.builders.structure.representation.addRepresentation(component, {
                    type: 'cartoon',
                    color: 'uniform',
                    colorParams: { value: color }
                });

                objects_polymer[chainId] = {
                    ref: component.ref,
                    sequence: getResidueSequence(component, chainId)
                };
            }
        }



        const ligands = getLigands(structure);
        for (const ligandId of Array.from(ligands)) {
            const ligandSelection = MS.struct.generator.atomGroups({
                'atom-test': MS.core.rel.eq([MS.struct.atomProperty.macromolecular.label_comp_id(), ligandId])
            });

            const component = await plugin.builders.structure.tryCreateComponentFromExpression(
                ref,
                ligandSelection,
                `${ligandId}`,
                {
                    label: `${"toreplacewithpdbid"}${ligandId}`,
                    tags: [`${ligandId}`]
                }
            );

            if (component) {
                const representation = await plugin.builders.structure.representation.addRepresentation(component, {
                    type: 'ball-and-stick',
                    colorParams: {
                        style: {
                            name: 'element-symbol'
                        }
                    }
                });

                components[`${ligandId}`] = component;
                representations[`${ligandId}`] = representation;
                objects_ligand[ligandId] = {
                    ref: component.ref
                };
            }
        }



        await update.commit({ revertOnError: true });


        return {
            objects_polymer,
            objects_ligand,
        };
    }
});