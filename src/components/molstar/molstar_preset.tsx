import { ResidueIndex, Structure, StructureProperties } from 'molstar/lib/mol-model/structure';
import { MolScriptBuilder as MS } from 'molstar/lib/mol-script/language/builder';
import { StateObjectRef, StateObjectSelector } from 'molstar/lib/mol-state';
import { StructureRepresentationPresetProvider } from 'molstar/lib/mol-plugin-state/builder/structure/representation-preset';
import { ParamDefinition as PD } from 'molstar/lib/mol-util/param-definition';
import { Color } from 'molstar/lib/mol-util/color';
import { getRandomPolymerColor } from './colors/colorscheme';

const TubulinChainColors = [
    Color(0x1f77b4), Color(0xff7f0e), Color(0x2ca02c), Color(0xd62728),
    Color(0x9467bd), Color(0x8c564b), Color(0xe377c2), Color(0x7f7f7f),
    Color(0xbcbd22), Color(0x17becf), Color(0xaec7e8), Color(0xffbb78),
    Color(0x98df8a), Color(0xff9896), Color(0xc5b0d5), Color(0xc49c94)
];

export const AMINO_ACIDS_3_TO_1_CODE: { [key: string]: string } = {
    ALA: 'A', ARG: 'R', ASN: 'N', ASP: 'D', ASX: 'B', CYS: 'C',
    GLU: 'E', GLN: 'Q', GLX: 'Z', GLY: 'G', HIS: 'H', ILE: 'I',
    LEU: 'L', LYS: 'K', MET: 'M', PHE: 'F', PRO: 'P', SER: 'S',
    THR: 'T', TRP: 'W', TYR: 'Y', VAL: 'V'
};
export type ResidueData = [string, number];
function getResidueSequence(component: StateObjectSelector, chainId: string): ResidueData[] {
    // ... no changes needed in this function
    const sequence: ResidueData[] = [];
    const structure = component.obj?.data as Structure;
    if (!structure) return [];

    const { _rowCount: residueCount } = structure.model.atomicHierarchy.residues;
    const { offsets: residueOffsets } = structure.model.atomicHierarchy.residueAtomSegments;
    const chainIndex = structure.model.atomicHierarchy.chainAtomSegments.index;

    for (let rI = 0 as ResidueIndex; rI < residueCount; rI++) {
        const offset = residueOffsets[rI];
        const cI = chainIndex[offset];
        const residueChainId = structure.model.atomicHierarchy.chains.auth_asym_id.value(cI);

        if (residueChainId !== chainId) continue;

        const label_comp_id = structure.model.atomicHierarchy.atoms.label_comp_id.value(offset);
        const auth_seq_id = structure.model.atomicHierarchy.residues.auth_seq_id.value(rI);

        const oneLetterCode = AMINO_ACIDS_3_TO_1_CODE[label_comp_id] || label_comp_id;
        sequence.push([oneLetterCode, auth_seq_id]);
    }
    return sequence;
}


export const TubulinSplitPreset = StructureRepresentationPresetProvider({
    id: 'tubulin-split-preset',
    display: {
        name: 'Split Polymer Chains',
        group: 'TubulinXYZ',
        description: 'Shows each polymer chain as a separate selectable component.'
    },
    params: () => ({
        ...StructureRepresentationPresetProvider.CommonParams,
        pdbId: PD.Text('', { description: 'PDB ID used for tagging components' }),
    }),



    async apply(ref, params, plugin) {
        const structureCell = StateObjectRef.resolveAndCheck(plugin.state.data, ref);
        if (!structureCell) return {};

        const structure = structureCell.obj!.data;
        const uniqueChains = new Set<string>();

        // for (const unit of structure.units) {
        //     if (unit.kind !== 0) continue;

        //     const { auth_asym_id, label_entity_id } = StructureProperties.chain;
        //     const entityId = label_entity_id({ unit, element: unit.elements[0] });
        //     const entity = structure.model.entities.data[entityId];

        //     // ========================= THE FIX =========================
        //     // Old check was: if (entity?.type === 'polymer')
        //     // New, more robust check: A polymer is any entity with a sequence.
        //     if (entity && entity.sequence.length > 0) {
        //         uniqueChains.add(auth_asym_id({ unit, element: unit.elements[0] }));
        //     }
        // }        
            // =========================================================
        const chains = new Set<string>();
        for (const unit of structure.units) {
            const chainLocation = {
                structure,
                unit,
                element: unit.elements[0],
                kind: 'unit' as const
            };

            // @ts-ignore
            const unitChains = StructureProperties.chain.auth_asym_id(chainLocation);
            chains.add(unitChains);
        }

        const chainArray = Array.from(uniqueChains).sort();
        const objects_polymer: { [k: string]: { ref: string; sequence: ResidueData[] } } = {};

        const components: {[k: string]: StateObjectSelector | undefined} = {};
        const representations: {[k: string]: StateObjectSelector | undefined} = {};
// should come from params
        const rcsbIdPrefix = 'struct_prefix'

        for (const chainId of Array.from(chains)) {
            const chainSelection = MS.struct.generator.atomGroups({
                'chain-test': MS.core.rel.eq([MS.struct.atomProperty.macromolecular.auth_asym_id(), chainId])
            });
            const component = await plugin.builders.structure.tryCreateComponentFromExpression(
                ref,
                chainSelection,
                `${rcsbIdPrefix}chain-${chainId}`,
                {
                    label: `${rcsbIdPrefix ? `${rcsbIdPrefix} ` : ''}Polymer ${chainId}`,
                    tags: [`${rcsbIdPrefix}chain-${chainId}`, rcsbIdPrefix]
                }
            );

            if (component) {
                const representation = await plugin.builders.structure.representation.addRepresentation(component, {
                    type: 'cartoon',
                    color: 'uniform',
                    colorParams: {
                        value: getRandomPolymerColor()
                    }
                });

                components[`${chainId}`] = component;
                representations[`${chainId}`] = representation;

                objects_polymer[chainId] = {
                    ref: component.ref,
                    sequence: getResidueSequence(component, chainId )
                };
            }
        }

        return {
            objects_polymer,
            objects_ligand: {}
        };
    }
});