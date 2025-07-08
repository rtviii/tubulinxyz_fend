import { MolstarViewer } from './molstar_viewer';
import { AppDispatch, RootState } from '@/store/store';
import { setStructureRef, addComponents, clearStructure, clearAll, PolymerComponent, LigandComponent } from '@/store/slices/molstar_refs';
import { initializePolymer, clearPolymersForStructure, clearAllPolymers, setPolymerVisibility, setPolymerHovered } from '@/store/slices/polymer_states';
import { setLoading, setError } from '@/store/slices/tubulin_structures';

// Mol* imports
import { QueryContext, Structure, StructureProperties, StructureSelection, Unit } from 'molstar/lib/mol-model/structure';
import { MolScriptBuilder as MS } from 'molstar/lib/mol-script/language/builder';
import { StateObjectSelector, StateSelection } from 'molstar/lib/mol-state';
import { createStructureRepresentationParams } from 'molstar/lib/mol-plugin-state/helpers/structure-representation-params';
import { StateTransforms } from 'molstar/lib/mol-plugin-state/transforms';
import { PluginCommands } from 'molstar/lib/mol-plugin/commands';
import { setSubtreeVisibility } from 'molstar/lib/mol-plugin/behavior/static/state';
import { PresetObjects, TubulinClass, TubulinClassification } from './molstar_preset';
import { initializeNonPolymer, setNonPolymerHovered, setNonPolymerVisibility } from '@/store/slices/nonpolymer_states';
import { compile } from 'molstar/lib/mol-script/runtime/query/compiler';
import { StructureSelectionQueries } from 'molstar/lib/mol-plugin-state/helpers/structure-selection-query';
import { StructureComponentManager } from 'molstar/lib/mol-plugin-state/manager/structure/component';
import { Script } from 'molstar/lib/mol-script/script';
import { StructureSelectionQuery } from 'molstar/lib/mol-plugin-state/helpers/structure-selection-query';




import { InteractionsProvider, Interactions } from 'molstar/lib/mol-model-props/computed/interactions';
import { PluginContext } from 'molstar/lib/mol-plugin/context';
import { StructureElement } from 'molstar/lib/mol-model/structure';
import { interactionTypeLabel } from 'molstar/lib/mol-model-props/computed/interactions/common';
import { SyncRuntimeContext } from 'molstar/lib/mol-task/execution/synchronous';
import { AssetManager } from 'molstar/lib/mol-util/assets';

// NOTE: Other necessary imports for the full controller class are assumed to be present.
// e.g., import { setError } from '@/store/slices/tubulin_structures';

// Define a simple structure for our interaction data
export interface InteractionInfo {
    type: string;
    partnerA: string;
    partnerB: string;
}

/**
 * CORRECTED Helper function to extract interaction data from a given structure.
 * This is the core logic for iterating through bonds.
 * @param structure The structure to analyze. It MUST have interactions computed already.
 * @returns An array of interaction information.
 */
function getInteractionData(structure: Structure): InteractionInfo[] {
    // 1. Correctly get the pre-computed interactions from the structure property.
    const interactions = InteractionsProvider.get(structure).value;
    if (!interactions) {
        console.warn('Interactions have not been computed for this structure.');
        return [];
    }

    const results: InteractionInfo[] = [];
    const { units } = structure;
    const { unitsFeatures, unitsContacts, contacts: interUnitContacts } = interactions;

    // Helper to create a descriptive label for an interaction partner (feature)
    const getPartnerLabel = (unit: Unit, feature: number): string => {
        const featuresOfUnit = unitsFeatures.get(unit.id);
        if (!featuresOfUnit) return 'Unknown';
        // Location of the first atom in the feature
        const loc = StructureElement.Location.create(structure, unit, featuresOfUnit.members[featuresOfUnit.offsets[feature]]);
        const compId = StructureProperties.atom.auth_comp_id(loc);
        const seqId = StructureProperties.chain.auth_asym_id(loc);
        const atomId = StructureProperties.atom.auth_atom_id(loc);
        return `[${compId}]${seqId}:${atomId}`;
    };

    // 2. Iterate over interactions within the same unit (intra-unit)
    for (const unit of units) {
        const intraContacts = unitsContacts.get(unit.id);
        if (!intraContacts) continue;
        const { edgeCount, a, b, edgeProps } = intraContacts;
        for (let i = 0; i < edgeCount; i++) {
            if (a[i] < b[i]) { // Process each bond only once to avoid duplicates
                results.push({
                    type: interactionTypeLabel(edgeProps.type[i]),
                    partnerA: getPartnerLabel(unit, a[i]),
                    partnerB: getPartnerLabel(unit, b[i]),
                });
            }
        }
    }

    // 3. Iterate over interactions between different units (inter-unit)
    for (const bond of interUnitContacts.edges) {
        const unitA = structure.unitMap.get(bond.unitA);
        const unitB = structure.unitMap.get(bond.unitB);
        if (!unitA || !unitB) continue;

        if (unitA.id > unitB.id || (unitA.id === unitB.id && bond.indexA > bond.indexB)) continue;

        results.push({
            type: interactionTypeLabel(bond.props.type),
            partnerA: getPartnerLabel(unitA, bond.indexA),
            partnerB: getPartnerLabel(unitB, bond.indexB),
        });
    }

    return results;
}

interface StateSnapshot {
    currentStructure: string | null;
    // Keeping these for context, though they aren't used in the provided snippet
    // components: Record<string, any>; 
    // structureRefs: Record<string, string>;
}

export class MolstarController {
    private viewer: MolstarViewer;
    private dispatch: AppDispatch;
    private getState: () => RootState;

    constructor(viewer: MolstarViewer, dispatch: AppDispatch, getState: () => RootState) {
        this.viewer = viewer;
        this.dispatch = dispatch;
        this.getState = getState;
    }


    async getLigandInterfaceData(ligandChemId: string): Promise<InteractionInfo[] | undefined> {
        if (!this.viewer.ctx) {
            this.dispatch(setError('Mol* context not available.'));
            return;
        }
        const plugin = this.viewer.ctx;

        const structureRef = plugin.managers.structure.hierarchy.current.structures[0]?.cell;
        if (!structureRef?.obj?.data) {
            this.dispatch(setError('No structure loaded.'));
            return;
        }
        const sourceStructure = structureRef.obj.data;

        // 1. Create a temporary structure containing just the ligand and its surroundings
        const surroundingsQuery = MS.struct.modifier.includeSurroundings({
            0: MS.struct.filter.first({
                0: MS.struct.generator.atomGroups({
                    'residue-test': MS.core.rel.eq([MS.ammp('auth_comp_id'), ligandChemId]),
                    'group-by': MS.ammp('residueKey')
                })
            }),
            radius: 5,
            'as-whole-residues': true
        });

        // Correctly create a new Structure object from the query without using the state builder
        const compiledQuery = compile(surroundingsQuery);
        const selection = compiledQuery(new QueryContext(sourceStructure));
        const focusedStructure = StructureSelection.unionStructure(selection);

        if (focusedStructure.elementCount === 0) {
            this.dispatch(setError(`No surroundings found for ${ligandChemId}.`));
            return [];
        }

        // 2. CRITICAL STEP: Ensure interactions are computed for this new, focused structure.
        // The `attach` method requires a `CustomProperty.Context`. We create one manually,
        // as shown in Mol* examples for standalone analysis.
        const customPropertyContext = {
            runtime: SyncRuntimeContext,
            assetManager: new AssetManager() // Interactions don't load external assets, so a temp manager is fine.
        };
        await InteractionsProvider.attach(customPropertyContext, focusedStructure, undefined, true);

        // 3. Run the data extraction helper on this new, focused structure
        const interactionData = getInteractionData(focusedStructure);

        console.log('Extracted Interaction Data:', interactionData);
        return interactionData;
    }

    private getCurrentState(): StateSnapshot {
        const state = this.getState();
        return {
            currentStructure: state.molstarRefs.currentStructure,
        };
    }

    async loadStructure(pdbId: string, tubulinClassification: TubulinClassification): Promise<boolean> {
        try {
            await this.clearCurrentStructure();
            if (!this.viewer.ctx) throw new Error('Molstar not initialized');

            const asset_url = `https://models.rcsb.org/${pdbId.toUpperCase()}.bcif`;

            const data = await this.viewer.ctx.builders.data.download({ url: asset_url, isBinary: true, label: pdbId.toUpperCase() });
            const trajectory = await this.viewer.ctx.builders.structure.parseTrajectory(data, 'mmcif');
            const model = await this.viewer.ctx.builders.structure.createModel(trajectory);
            const structure = await this.viewer.ctx.builders.structure.createStructure(model);

            const { objects_polymer, objects_ligand } = await this.viewer.ctx.builders.structure.representation.applyPreset(structure, 'tubulin-split-preset', {
                pdbId: pdbId.toUpperCase(),
                tubulinClassification
            }) as Partial<PresetObjects>;


            const polymerComponents = Object.entries(objects_polymer || {}).reduce((acc, [chainId, data]) => {
                acc[chainId] = { type: 'polymer', pdbId: pdbId.toUpperCase(), ref: data.ref, chainId: chainId };
                return acc;
            }, {} as Record<string, PolymerComponent>);

            const ligandComponents = Object.entries(objects_ligand || {}).reduce((acc, [uniqueKey, data]) => {
                const [compId, auth_asym_id, auth_seq_id_str] = uniqueKey.split('_');
                const auth_seq_id = parseInt(auth_seq_id_str, 10);
                acc[uniqueKey] = {
                    type: 'ligand',
                    pdbId: pdbId.toUpperCase(),
                    ref: data.ref,
                    uniqueKey,
                    compId,
                    auth_asym_id,
                    auth_seq_id
                };
                return acc;
            }, {} as Record<string, LigandComponent>);

            this.dispatch(setStructureRef({ pdbId: pdbId.toUpperCase(), ref: structure.ref }));
            this.dispatch(addComponents({ pdbId: pdbId.toUpperCase(), components: { ...polymerComponents, ...ligandComponents } }));

            Object.keys(polymerComponents).forEach(chainId => {
                this.dispatch(initializePolymer({ pdbId: pdbId.toUpperCase(), chainId }));
            });
            Object.keys(ligandComponents).forEach(uniqueKey => {
                this.dispatch(initializeNonPolymer({ pdbId: pdbId.toUpperCase(), chemId: uniqueKey }));
            });

            return true;
        } catch (error) {
            console.error('Error loading structure:', error);
            this.dispatch(setError(error instanceof Error ? error.message : 'Unknown error'));
            return false;
        }
    }

    /**
        * CORRECTED: Creates a component showing a ligand, its 5Å surroundings (residues),
        * and all non-covalent interactions between them.
        * @param ligandChemId The chemical ID of the ligand (e.g., 'GTP').
        */
    async createLigandSurroundings(ligandChemId: string) {
        if (!this.viewer.ctx) {
            this.dispatch(setError('Mol* context not available.'));
            return;
        }
        const plugin = this.viewer.ctx;

        const structureRef = plugin.managers.structure.hierarchy.current.structures[0]?.cell;
        if (!structureRef?.obj?.data) {
            this.dispatch(setError('No structure loaded. Please load a structure first.'));
            return;
        }

        // 1. Create a query for the ligand and its surroundings
        const surroundingsQuery = MS.struct.modifier.includeSurroundings({
            0: MS.struct.filter.first({
                0: MS.struct.generator.atomGroups({
                    'residue-test': MS.core.rel.eq([MS.ammp('auth_comp_id'), ligandChemId]),
                    'group-by': MS.ammp('residueKey')
                })
            }),
            radius: 5,
            'as-whole-residues': true
        });

        // 2. Build a new component from this query
        const stateUpdate = plugin.state.data.build();
        const surroundingsComponent = stateUpdate.to(structureRef)
            .apply(StateTransforms.Model.StructureSelectionFromExpression, {
                expression: surroundingsQuery,
                label: `[${ligandChemId}] Surroundings`
            });

        // 3. Add a ball-and-stick representation for the atoms
        surroundingsComponent.apply(StateTransforms.Representation.StructureRepresentation3D,
            createStructureRepresentationParams(plugin, structureRef.obj.data, {
                type: 'ball-and-stick'
            })
        );

        // 4. ALSO add the interactions representation to show non-covalent bonds
        surroundingsComponent.apply(StateTransforms.Representation.StructureRepresentation3D, {
            type: { name: 'interactions', params: {} },
            colorTheme: { name: 'interaction-type', params: {} },
            sizeTheme: { name: 'uniform', params: { value: 0.15 } },
        });

        await stateUpdate.commit();
    }

    /**
     * CORRECTED: Creates a component showing ONLY the non-covalent interaction bonds
     * between a ligand and its 5Å surroundings.
     * @param ligandChemId The chemical ID of the ligand (e.g., 'GTP').
     */
    async createLigandInterfaceBonds(ligandChemId: string) {
        if (!this.viewer.ctx) {
            this.dispatch(setError('Mol* context not available.'));
            return;
        }
        const plugin = this.viewer.ctx;

        const structureRef = plugin.managers.structure.hierarchy.current.structures[0]?.cell;
        if (!structureRef?.obj?.data) {
            this.dispatch(setError('No structure loaded. Please load a structure first.'));
            return;
        }

        // 1. Create a new structure component that contains ONLY the ligand and its surroundings.
        // This is the context in which interactions will be calculated.
        const surroundingsQuery = MS.struct.modifier.includeSurroundings({
            0: MS.struct.filter.first({
                0: MS.struct.generator.atomGroups({
                    'residue-test': MS.core.rel.eq([MS.ammp('auth_comp_id'), ligandChemId]),
                    'group-by': MS.ammp('residueKey')
                })
            }),
            radius: 5,
            'as-whole-residues': true
        });

        const stateUpdate = plugin.state.data.build();
        const interfaceComponent = stateUpdate.to(structureRef)
            .apply(StateTransforms.Model.StructureSelectionFromExpression, {
                expression: surroundingsQuery,
                label: `[${ligandChemId}] Interaction Context`
            });

        // 2. To this new component, add ONLY the interactions representation.
        // This will calculate and display interactions *only within this subset of atoms*.
        interfaceComponent.apply(StateTransforms.Representation.StructureRepresentation3D, {
            type: { name: 'interactions', params: {} },
            colorTheme: { name: 'interaction-type', params: {} },
            sizeTheme: { name: 'uniform', params: { value: 0.15 } },
            label: 'Interface Interactions'
        });

        // 3. For context, add a ball-and-stick view of the LIGAND ONLY to the same component.
        // This shows what the interaction lines are connecting to, without cluttering the view
        // with the surrounding residues.
        const ligandInContextQuery = MS.struct.generator.atomGroups({
            'residue-test': MS.core.rel.eq([MS.ammp('auth_comp_id'), ligandChemId]),
        });

        interfaceComponent
            .apply(StateTransforms.Model.StructureSelectionFromExpression, {
                expression: ligandInContextQuery,
                label: `Ligand ${ligandChemId}`
            })
            .apply(StateTransforms.Representation.StructureRepresentation3D,
                createStructureRepresentationParams(plugin, structureRef.obj.data, {
                    type: 'ball-and-stick'
                })
            );

        await stateUpdate.commit();
    }

    private getComponentRef(pdbId: string, chainId: string): string | undefined {
        const state = this.getState();
        const component = state.molstarRefs.components[`${pdbId}_${chainId}`];
        return component?.ref;
    }
    async focusChain(pdbId: string, chainId: string) {
        try {
            const ref = this.getComponentRef(pdbId, chainId);
            if (!ref || !this.viewer.ctx) {
                console.warn(`No ref found for chain ${chainId} in structure ${pdbId}`);
                return;
            }

            const cell = this.viewer.ctx.state.data.select(StateSelection.Generators.byRef(ref))[0];
            if (!cell?.obj?.data) {
                console.warn(`No cell data found for chain ${chainId}`);
                return;
            }

            const structure = cell.obj.data as Structure;
            const loci = Structure.toStructureElementLoci(structure);

            this.viewer.ctx.managers.camera.focusLoci(loci);

            console.log(`Successfully focused on chain ${chainId}`);

        } catch (error) {
            console.error(`Error focusing chain ${chainId}:`, error);

            try {
                await this.highlightChain(pdbId, chainId, true);
                console.log(`Fallback: highlighted chain ${chainId} instead of focusing`);
            } catch (fallbackError) {
                console.error(`Fallback highlighting also failed:`, fallbackError);
            }
        }
    }

    async setChainVisibility(pdbId: string, chainId: string, isVisible: boolean) {
        const ref = this.getComponentRef(pdbId, chainId);
        if (ref && this.viewer.ctx) {
            setSubtreeVisibility(this.viewer.ctx.state.data, ref, !isVisible);
            this.dispatch(setPolymerVisibility({ pdbId, chainId, visible: isVisible }));
        }
    }

    async highlightChain(pdbId: string, chainId: string, shouldHighlight: boolean) {
        if (!this.viewer.ctx) return;

        if (!shouldHighlight) {
            this.viewer.ctx.managers.interactivity.lociHighlights.clearHighlights();
            this.dispatch(setPolymerHovered({ pdbId, chainId, hovered: false }));
            return;
        }

        const ref = this.getComponentRef(pdbId, chainId);
        if (ref) {
            const cell = this.viewer.ctx.state.data.select(StateSelection.Generators.byRef(ref))[0];
            if (cell?.obj?.data) {
                const loci = Structure.toStructureElementLoci(cell.obj.data as Structure);
                this.viewer.ctx.managers.interactivity.lociHighlights.highlight({ loci }, false);
                this.dispatch(setPolymerHovered({ pdbId, chainId, hovered: true }));
            }
        }
    }
    async clearCurrentStructure(): Promise<void> {
        const currentState = this.getCurrentState();
        if (!currentState.currentStructure) return;
        try {
            await this.viewer.clear();
            this.dispatch(clearStructure(currentState.currentStructure));
            this.dispatch(clearPolymersForStructure(currentState.currentStructure));
        } catch (error) {
            console.error('Error clearing structure:', error);
        }
    }

    async clearAll(): Promise<void> {
        try {
            await this.viewer.clear();
            this.dispatch(clearAll());
            this.dispatch(clearAllPolymers());
        } catch (error) {
            console.error('Error clearing all structures:', error);
            throw error;
        }
    }

    dispose() {
        this.viewer.dispose();
    }
}
