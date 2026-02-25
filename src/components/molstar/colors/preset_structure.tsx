import { Structure } from 'molstar/lib/mol-model/structure';
import { MolScriptBuilder as MS } from 'molstar/lib/mol-script/language/builder';
import { StateObjectRef } from 'molstar/lib/mol-state';
import { StructureRepresentationPresetProvider } from 'molstar/lib/mol-plugin-state/builder/structure/representation-preset';
import { ParamDefinition as PD } from 'molstar/lib/mol-util/param-definition';
import { getLigandInstances, getResidueSequence, ResidueData } from './preset-helpers';
import { MapFamily, TubulinFamily } from '@/store/tubxz_api';
import {
    getMolstarColorForFamily,
    getMolstarLigandColor,
} from './palette';

export type TubulinClassification = Record<string, TubulinFamily | MapFamily | string>;

interface PolymerObject { ref: string; sequence: ResidueData[]; }
interface LigandObject { ref: string; }
export interface PresetObjects {
    objects_polymer: { [chainId: string]: PolymerObject };
    objects_ligand: { [uniqueKey: string]: LigandObject };
}

export const EnhancedTubulinSplitPreset = StructureRepresentationPresetProvider({
    id: 'tubulin-split-preset-computed-res',
    display: {
        name: 'Tubulin superfamily',
        group: 'TubulinXYZ',
        description: 'Per-chain coloring with ligands.',
    },
    params: () => ({
        ...StructureRepresentationPresetProvider.CommonParams,
        pdbId: PD.Text('', { description: 'PDB ID' }),
        tubulinClassification: PD.Value<TubulinClassification>({}, { isHidden: true }),
    }),

    async apply(ref, params, plugin): Promise<Partial<PresetObjects>> {
        const structureCell = StateObjectRef.resolveAndCheck(plugin.state.data, ref);
        if (!structureCell) return {};

        const structure = structureCell.obj!.data as Structure;
        const { update } = StructureRepresentationPresetProvider.reprBuilder(plugin, params);
        const objects_polymer: { [k: string]: PolymerObject } = {};
        const objects_ligand: { [k: string]: LigandObject } = {};

        // Polymer chains
        const { auth_asym_id } = structure.model.atomicHierarchy.chains;
        const chainCount = structure.model.atomicHierarchy.chains._rowCount;

        for (let cI = 0; cI < chainCount; cI++) {
            const chainId = auth_asym_id.value(cI);
            const eI = structure.model.atomicHierarchy.index.getEntityFromChain(cI);
            if (structure.model.entities.data.type.value(eI) !== 'polymer') continue;

            // Skip duplicate chain IDs (multiple units can share auth_asym_id)
            if (objects_polymer[chainId]) continue;

            const family = params.tubulinClassification[chainId];
            const chainColor = getMolstarColorForFamily(family);

            const component = await plugin.builders.structure.tryCreateComponentFromExpression(
                structureCell,
                MS.struct.generator.atomGroups({
                    'chain-test': MS.core.rel.eq([MS.struct.atomProperty.macromolecular.auth_asym_id(), chainId]),
                }),
                `${params.pdbId}_${chainId}`,
                { label: `${family || 'Polymer'} (${chainId})` }
            );

            if (component) {
                await plugin.builders.structure.representation.addRepresentation(component, {
                    type: 'cartoon',
                    color: 'uniform',
                    colorParams: { value: chainColor },
                });

                objects_polymer[chainId] = {
                    ref: component.ref,
                    sequence: getResidueSequence(component, chainId),
                };
            }
        }

        // Ligands
        const ligandInstances = getLigandInstances(structure);
        for (const instance of ligandInstances) {
            const ligandSelection = MS.struct.generator.atomGroups({
                'residue-test': MS.core.logic.and([
                    MS.core.rel.eq([MS.struct.atomProperty.macromolecular.label_comp_id(), instance.compId]),
                    MS.core.rel.eq([MS.struct.atomProperty.macromolecular.auth_asym_id(), instance.auth_asym_id]),
                    MS.core.rel.eq([MS.struct.atomProperty.macromolecular.auth_seq_id(), instance.auth_seq_id]),
                ]),
            });

            const component = await plugin.builders.structure.tryCreateComponentFromExpression(
                structureCell,
                ligandSelection,
                `${params.pdbId}_${instance.uniqueKey}`,
                { label: `Ligand ${instance.compId}` }
            );

            if (component) {
                await plugin.builders.structure.representation.addRepresentation(component, {
                    type: 'ball-and-stick',
                    color: 'uniform',
                    colorParams: { value: getMolstarLigandColor(instance.compId) },
                    typeParams: { sizeFactor: 0.3 },
                });
                objects_ligand[instance.uniqueKey] = { ref: component.ref };
            }
        }

        await update.commit({ revertOnError: true });
        return { objects_polymer, objects_ligand };
    },
});