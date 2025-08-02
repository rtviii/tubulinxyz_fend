import { Structure, StructureProperties } from 'molstar/lib/mol-model/structure';
import { MolScriptBuilder as MS } from 'molstar/lib/mol-script/language/builder';
import { StateObjectRef, StateObjectSelector } from 'molstar/lib/mol-state';
import { StructureRepresentationPresetProvider } from 'molstar/lib/mol-plugin-state/builder/structure/representation-preset';
import { ParamDefinition as PD } from 'molstar/lib/mol-util/param-definition';
import { Color } from 'molstar/lib/mol-util/color';
import { AMINO_ACIDS_3_TO_1_CODE, ResidueData, getLigandInstances, getResidueSequence } from './preset-helpers';

// Define the Tubulin types and the parameter object shape
export enum TubulinClass {
    Alpha = "alpha",
    Beta = "beta",
}
export type TubulinClassification = Record<string, TubulinClass>;

// Computed residue annotation interface
export interface ComputedResidueAnnotation {
    auth_asym_id: string;
    auth_seq_id: number;
    method: string;
    confidence: number;
}

// Define specific colors for each tubulin type
const TubulinColors = {
    [TubulinClass.Alpha]: Color(0x3b82f6), // Blue
    [TubulinClass.Beta]: Color(0xf97316),  // Orange
    Default: Color(0x808080)              // Gray for any unclassified chains
};

// Colors for computed residues
const ComputedResidueColors = {
    'MD_simulation': Color(0xff6b6b), // Red
    'Modeller': Color(0x4ecdc4),      // Teal
    'Default': Color(0xffa726)        // Orange
};

interface PolymerObject {
    ref: string;
    sequence: ResidueData[];
}

interface LigandObject {
    ref: string;
}

export interface PresetObjects {
    objects_polymer: { [chainId: string]: PolymerObject };
    objects_ligand: { [uniqueKey: string]: LigandObject };
}

function createComputedResidueSelection(chainId: string, computedResidues: ComputedResidueAnnotation[]) {
    const chainResidues = computedResidues.filter(r => r.auth_asym_id === chainId);
    if (chainResidues.length === 0) return null;

    const residueIds = chainResidues.map(r => r.auth_seq_id);

    return MS.struct.generator.atomGroups({
        'residue-test': MS.core.logic.and([
            MS.core.rel.eq([MS.struct.atomProperty.macromolecular.auth_asym_id(), chainId]),
            MS.core.set.has([MS.set(...residueIds), MS.struct.atomProperty.macromolecular.auth_seq_id()])
        ])
    });
}

function createNonComputedResidueSelection(chainId: string, computedResidues: ComputedResidueAnnotation[]) {
    const chainResidues = computedResidues.filter(r => r.auth_asym_id === chainId);
    if (chainResidues.length === 0) {
        return MS.struct.generator.atomGroups({
            'chain-test': MS.core.rel.eq([MS.struct.atomProperty.macromolecular.auth_asym_id(), chainId])
        });
    }

    const residueIds = chainResidues.map(r => r.auth_seq_id);

    return MS.struct.generator.atomGroups({
        'residue-test': MS.core.logic.and([
            MS.core.rel.eq([MS.struct.atomProperty.macromolecular.auth_asym_id(), chainId]),
            MS.core.logic.not([
                MS.core.set.has([MS.set(...residueIds), MS.struct.atomProperty.macromolecular.auth_seq_id()])
            ])
        ])
    });
}

export const EnhancedTubulinSplitPreset = StructureRepresentationPresetProvider({
    id: 'tubulin-split-preset-computed-res',
    display: {
        name: 'Enhanced Split Tubulin Chains',
        group: 'TubulinXYZ',
        description: 'Colors alpha-tubulin blue and beta-tubulin orange, with computed residues highlighted.'
    },
    params: () => ({
        ...StructureRepresentationPresetProvider.CommonParams,
        pdbId: PD.Text('', { description: 'PDB ID used for tagging components' }),
        tubulinClassification: PD.Value<TubulinClassification>({}, { isHidden: true }),
        computedResidues: PD.Value<ComputedResidueAnnotation[]>([], { isHidden: true })
    }),

    async apply(ref, params, plugin): Promise<Partial<PresetObjects>> {
        const structureCell = StateObjectRef.resolveAndCheck(plugin.state.data, ref);
        if (!structureCell) return {};

        const structure = structureCell.obj!.data;
        const { update, builder } = StructureRepresentationPresetProvider.reprBuilder(plugin, params);

        const objects_polymer: { [k: string]: PolymerObject } = {};
        const objects_ligand: { [k: string]: LigandObject } = {};

        // 🚨 FIX: Get all polymer chains by checking the entity type
        const polymerChains = new Set<string>();
        const { entities } = structure.model;
        const { auth_asym_id } = structure.model.atomicHierarchy.chains;
        for (let i = 0, il = entities.data.rowCount; i < il; i++) {
            if (entities.data.type.value(i) === 'polymer') {
                const chains = entities.chainIndex.getChains(i);
                for (let j = 0, jl = chains.length; j < jl; j++) {
                    polymerChains.add(auth_asym_id.value(chains[j]));
                }
            }
        }

        for (const chainId of Array.from(polymerChains).sort()) {
            const chainSelection = MS.struct.generator.atomGroups({
                'chain-test': MS.core.rel.eq([MS.struct.atomProperty.macromolecular.auth_asym_id(), chainId])
            });

            const component = await plugin.builders.structure.tryCreateComponentFromExpression(
                structureCell,
                chainSelection,
                `${params.pdbId}_${chainId}`,
                { label: `Polymer ${chainId}` }
            );

            if (component) {
                const tubulinClass = params.tubulinClassification[chainId];
                const chainColor = TubulinColors[tubulinClass] || TubulinColors.Default;

                const chainComputedResidues = params.computedResidues.filter(r => r.auth_asym_id === chainId);

                if (chainComputedResidues.length > 0) {
                    console.log(`🔬 Chain ${chainId}: Found ${chainComputedResidues.length} computed residues`);

                    const nonComputedSelection = createNonComputedResidueSelection(chainId, params.computedResidues);
                    const nonComputedComp = await plugin.builders.structure.tryCreateComponentFromExpression(
                        component,
                        nonComputedSelection,
                        `${params.pdbId}_${chainId}_exp`,
                        { label: `${chainId} Experimental`, tags: [`chain-${chainId}`, 'experimental'] }
                    );

                    if (nonComputedComp) {
                        await plugin.builders.structure.representation.addRepresentation(nonComputedComp, {
                            type: 'cartoon',
                            color: 'uniform',
                            colorParams: { value: chainColor }
                        });
                    }

                    const computedSelection = createComputedResidueSelection(chainId, params.computedResidues);
                    if (computedSelection) {
                        const computedComp = await plugin.builders.structure.tryCreateComponentFromExpression(
                            component,
                            computedSelection,
                            `${params.pdbId}_${chainId}_comp`,
                            { label: `${chainId} Computed`, tags: [`chain-${chainId}`, 'computed'] }
                        );

                        if (computedComp) {
                            const computedColor = ComputedResidueColors['Default'];
                            await plugin.builders.structure.representation.addRepresentation(computedComp, {
                                type: 'ball-and-stick',
                                color: 'uniform',
                                colorParams: { value: computedColor },
                                sizeTheme: { name: 'uniform', params: { value: 0.8 } }
                            });
                            console.log(`🎨 Added computed residue representation for chain ${chainId}`);
                        }
                    }
                } else {
                    await plugin.builders.structure.representation.addRepresentation(component, {
                        type: 'cartoon',
                        color: 'uniform',
                        colorParams: { value: chainColor }
                    });
                }

                objects_polymer[chainId] = {
                    ref: component.ref,
                    sequence: getResidueSequence(component, chainId)
                };
            }
        }

        const ligandInstances = getLigandInstances(structure);
        for (const instance of ligandInstances) {
            const ligandSelection = MS.struct.generator.atomGroups({
                'residue-test': MS.core.logic.and([
                    MS.core.rel.eq([MS.struct.atomProperty.macromolecular.label_comp_id(), instance.compId]),
                    MS.core.rel.eq([MS.struct.atomProperty.macromolecular.auth_asym_id(), instance.auth_asym_id]),
                    MS.core.rel.eq([MS.struct.atomProperty.macromolecular.auth_seq_id(), instance.auth_seq_id])
                ])
            });

            const component = await plugin.builders.structure.tryCreateComponentFromExpression(
                ref,
                ligandSelection,
                `${params.pdbId}_${instance.uniqueKey}`,
                {
                    label: `Ligand ${instance.uniqueKey}`,
                    tags: [`ligand-${instance.compId}`]
                }
            );

            if (component) {
                await plugin.builders.structure.representation.addRepresentation(component, {
                    type: 'ball-and-stick',
                    color: 'element-symbol'
                });

                objects_ligand[instance.uniqueKey] = {
                    ref: component.ref
                };
            }
        }

        await update.commit({ revertOnError: true });

        return {
            objects_polymer,
            objects_ligand
        };
    }
});