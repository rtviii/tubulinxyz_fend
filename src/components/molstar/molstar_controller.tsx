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
import { Loci as locii } from 'molstar/lib/mol-model/loci';
import { OrderedSet } from 'molstar/lib/mol-data/int';
import { InteractionsProvider, Interactions } from 'molstar/lib/mol-model-props/computed/interactions';
import { TubulinChainColorThemeProvider } from './tubulin-color-theme'; // ✨ IMPORT OUR NEW THEME
import { PluginContext } from 'molstar/lib/mol-plugin/context';
import { StructureElement } from 'molstar/lib/mol-model/structure';
import { interactionTypeLabel } from 'molstar/lib/mol-model-props/computed/interactions/common';
import { SyncRuntimeContext } from 'molstar/lib/mol-task/execution/synchronous';
import { AssetManager } from 'molstar/lib/mol-util/assets';
import { Loci } from 'molstar/lib/mol-model/structure/structure/element/element';
import { AMINO_ACIDS_3_TO_1_CODE } from './preset-helpers';
import { SequenceData } from '@/store/slices/sequence_viewer';
import { setResidueHover, setResidueSelection } from '@/store/slices/sequence_structure_sync';
import { Color } from 'molstar/lib/mol-util/color/color';
import { clearActiveInteractionComponentRef, setActiveInteractionComponentRef } from '@/store/slices/interaction_slice';
import { StructureFocusRepresentation } from 'molstar/lib/mol-plugin/behavior/dynamic/selection/structure-focus-representation';


interface ComputedResidueAnnotation {
    auth_asym_id: string;
    auth_seq_id: number;
    method: string;
    confidence: number;
}

// NOTE: Other necessary imports for the full controller class are assumed to be present.
// e.g., import { setError } from '@/store/slices/tubulin_structures';

export interface InteractionInfo {
    type: string;
    partnerA: { label: string, loci: StructureElement.Loci };
    partnerB: { label: string, loci: StructureElement.Loci };
}

function getInteractionData(structure: Structure): InteractionInfo[] {
    const interactions = InteractionsProvider.get(structure).value;
    if (!interactions) {
        console.warn('Interactions have not been computed for this structure.');
        return [];
    }
    const results: InteractionInfo[] = [];
    const { units } = structure;
    const { unitsFeatures, unitsContacts, contacts: interUnitContacts } = interactions;
    const getPartnerInfo = (unit: Unit, feature: number): { label: string, loci: StructureElement.Loci } => {
        const featuresOfUnit = unitsFeatures.get(unit.id);
        if (!featuresOfUnit) return { label: 'Unknown', loci: StructureElement.Loci.Empty };
        const firstAtomIndex = featuresOfUnit.members[featuresOfUnit.offsets[feature]];
        const loc = StructureElement.Location.create(structure, unit, firstAtomIndex);
        const compId = StructureProperties.atom.label_comp_id(loc);
        const seqId = StructureProperties.residue.auth_seq_id(loc);
        const atomId = StructureProperties.atom.label_atom_id(loc);
        const chainId = StructureProperties.chain.auth_asym_id(loc);
        const label = `[${compId}]${chainId}.${seqId}:${atomId}`;
        const loci = StructureElement.Loci(structure, [{ unit, indices: OrderedSet.ofSingleton(firstAtomIndex) }]);
        return { label, loci };
    };
    for (const unit of units) {
        const intraContacts = unitsContacts.get(unit.id);
        if (!intraContacts) continue;
        const { edgeCount, a, b, edgeProps } = intraContacts;
        for (let i = 0; i < edgeCount; i++) {
            if (a[i] < b[i]) {
                results.push({
                    type: interactionTypeLabel(edgeProps.type[i]),
                    partnerA: getPartnerInfo(unit, a[i]),
                    partnerB: getPartnerInfo(unit, b[i]),
                });
            }
        }
    }
    for (const bond of interUnitContacts.edges) {
        const unitA = structure.unitMap.get(bond.unitA);
        const unitB = structure.unitMap.get(bond.unitB);
        if (!unitA || !unitB) continue;
        if (unitA.id > unitB.id || (unitA.id === unitB.id && bond.indexA > bond.indexB)) continue;
        results.push({
            type: interactionTypeLabel(bond.props.type),
            partnerA: getPartnerInfo(unitA, bond.indexA),
            partnerB: getPartnerInfo(unitB, bond.indexB),
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
export interface InteractionInfo {
    type: string;
    partnerA: { label: string, loci: StructureElement.Loci };
    partnerB: { label: string, loci: StructureElement.Loci };
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

    async highlightInteraction(interaction: InteractionInfo | undefined, shouldHighlight: boolean = true) {
        if (!this.viewer.ctx) return;
        const plugin = this.viewer.ctx;

        // If hovering ends or no interaction is provided, clear all highlights
        if (!shouldHighlight || !interaction) {
            plugin.managers.interactivity.lociHighlights.clearHighlights();
            return;
        }

        // Combine the loci of both partners into a single loci to highlight them together
        const lociA = interaction.partnerA.loci;
        const lociB = interaction.partnerB.loci;
        const combinedLoci = Loci.union(lociA, lociB);

        plugin.managers.interactivity.lociHighlights.highlight({ loci: combinedLoci }, false);
    }


    async analyzeLigandInteractions(ligand: LigandComponent): Promise<InteractionInfo[] | undefined> {
        if (!this.viewer.ctx) {
            this.dispatch(setError('Mol* context not available.'));
            return;
        }
        const plugin = this.viewer.ctx;

        const currentRef = this.getState().interaction.activeInteractionComponentRef;

        if (currentRef) {
            await plugin.state.data.updateTree(plugin.state.data.build().delete(currentRef));
        }

        const structureRef = plugin.managers.structure.hierarchy.current.structures[0]?.cell;
        if (!structureRef?.obj?.data) {
            this.dispatch(setError('No structure loaded.'));
            return;
        }
        const sourceStructure = structureRef.obj.data;

        const specificLigandQuery = MS.struct.generator.atomGroups({
            'residue-test': MS.core.logic.and([
                MS.core.rel.eq([MS.ammp('auth_comp_id'), ligand.compId]),
                MS.core.rel.eq([MS.ammp('auth_asym_id'), ligand.auth_asym_id]),
                MS.core.rel.eq([MS.ammp('auth_seq_id'), ligand.auth_seq_id])
            ]),
            'group-by': MS.ammp('residueKey')
        });

        const surroundingsQuery = MS.struct.modifier.includeSurroundings({
            0: specificLigandQuery,
            radius: 5,
            'as-whole-residues': true
        });

        const stateUpdate = plugin.state.data.build();
        const surroundingsComponent = stateUpdate.to(structureRef)
            .apply(StateTransforms.Model.StructureSelectionFromExpression, {
                expression: surroundingsQuery,
                label: `[${ligand.compId}] Surroundings`
            });

        surroundingsComponent.apply(StateTransforms.Representation.StructureRepresentation3D,
            createStructureRepresentationParams(plugin, sourceStructure, { type: 'ball-and-stick' })
        );

        surroundingsComponent.apply(StateTransforms.Representation.StructureRepresentation3D, {
            type: { name: 'interactions', params: {} },
            colorTheme: { name: 'interaction-type', params: {} },
            sizeTheme: { name: 'uniform', params: { value: 0.15 } },
        });

        await stateUpdate.commit();

        this.dispatch(setActiveInteractionComponentRef(surroundingsComponent.ref));

        const componentCell = plugin.state.data.cells.get(surroundingsComponent.ref);
        if (!componentCell?.obj?.data) {
            this.dispatch(setError(`Could not create surroundings component for ${ligand.compId}.`));
            return [];
        }
        const focusedStructure = componentCell.obj.data;

        const customPropertyContext = { runtime: SyncRuntimeContext, assetManager: new AssetManager() };
        await InteractionsProvider.attach(customPropertyContext, focusedStructure, undefined, true);

        const interactionData = getInteractionData(focusedStructure);

        console.log(`Analyzed ${interactionData.length} interactions for ${ligand.uniqueKey}.`);
        return interactionData;
    }

    async focusLigandAndGetInteractions(ligand: LigandComponent): Promise<InteractionInfo[] | undefined> {
        if (!this.viewer.ctx) return;
        const plugin = this.viewer.ctx;
        const structure = plugin.managers.structure.hierarchy.current.structures[0]?.cell.obj?.data;
        if (!structure) return;

        // 1. Create a query to find the specific ligand instance
        const specificLigandQuery = MS.struct.generator.atomGroups({
            'residue-test': MS.core.logic.and([
                MS.core.rel.eq([MS.ammp('auth_comp_id'), ligand.compId]),
                MS.core.rel.eq([MS.ammp('auth_asym_id'), ligand.auth_asym_id]),
                MS.core.rel.eq([MS.ammp('auth_seq_id'), ligand.auth_seq_id])
            ]),
        });

        // 2. Compile the query and create a Loci (a precise pointer to the atoms)
        const compiledQuery = compile(specificLigandQuery);
        const selection = compiledQuery(new QueryContext(structure));
        const loci = StructureSelection.toLociWithSourceUnits(selection);

        if (Loci.isEmpty(loci)) {
            console.warn(`Could not find loci for ligand ${ligand.uniqueKey}`);
            return [];
        }

        // 3. Trigger Mol*'s focus manager. It will AUTOMATICALLY clear the previous focus and create the new one.
        plugin.managers.structure.focus.setFromLoci(loci);

        // ✨ ADD THIS LINE TO FOCUS THE CAMERA
        plugin.managers.camera.focusLoci(loci, { durationMs: 100 });

        // 4. Separately, calculate the surroundings to extract interaction data for our UI
        const surroundingsQuery = MS.struct.modifier.includeSurroundings({
            0: specificLigandQuery,
            radius: 5,
            'as-whole-residues': true
        });
        const surroundingsSelection = compile(surroundingsQuery)(new QueryContext(structure));
        const surroundingsStructure = StructureSelection.unionStructure(surroundingsSelection);

        if (surroundingsStructure.elementCount === 0) return [];

        const customPropertyContext = { runtime: SyncRuntimeContext, assetManager: new AssetManager() };
        await InteractionsProvider.attach(customPropertyContext, surroundingsStructure, undefined, true);

        const interactionData = getInteractionData(surroundingsStructure);
        return interactionData;
    }

    // ✨ NEW METHOD: A simple way to clear the focus visualization.
    async clearLigandFocus() {
        if (!this.viewer.ctx) return;
        this.viewer.ctx.managers.structure.focus.clear();
    }


    async clearLigandInteractionView() {
        if (!this.viewer.ctx) return;
        const currentRef = this.getState().interaction.activeInteractionComponentRef;
        if (currentRef) {
            await this.viewer.ctx.state.data.updateTree(this.viewer.ctx.state.data.build().delete(currentRef));
            this.dispatch(clearActiveInteractionComponentRef());
        }
    }

    async focusOnInteraction(lociA: Loci, lociB: Loci) {
        if (!this.viewer.ctx) return;
        this.viewer.ctx.managers.camera.focusLoci(Loci.union(lociA, lociB));
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

        const compiledQuery = compile(surroundingsQuery);
        const selection = compiledQuery(new QueryContext(sourceStructure));
        const focusedStructure = StructureSelection.unionStructure(selection);

        if (focusedStructure.elementCount === 0) {
            this.dispatch(setError(`No surroundings found for ${ligandChemId}.`));
            return [];
        }

        const customPropertyContext = {
            runtime: SyncRuntimeContext,
            assetManager: new AssetManager()
        };
        await InteractionsProvider.attach(customPropertyContext, focusedStructure, undefined, true);

        const interactionData = getInteractionData(focusedStructure);

        console.log('Extracted Interaction Data:', interactionData);
        return interactionData;
    }

    /**
     * Focuses the camera on the bounding sphere of two interaction partners.
     * @param lociA Loci for the first interaction partner.
     * @param lociB Loci for the second interaction partner.
     */
    // async focusOnInteraction(lociA: locii, lociB: locii) {
    //     if (!this.viewer.ctx) return;

    //     // ** FIX: ** Create a bundle of the two loci to focus on them together.
    //     // The camera manager will compute the bounding sphere for the bundle.
    //     const bundle: locii.Bundle<2> = { loci: [lociA, lociB] };
    //     this.viewer.ctx.managers.camera.focusLoci(Loci.union(lociA, lociB));
    // }
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
            if (this.viewer.ctx) {
                await this.viewer.ctx.state.updateBehavior(StructureFocusRepresentation, params => {
                    // Color the SURROUNDING residues using our custom blue/orange theme
                    params.surroundingsParams.colorTheme = {
                        name: 'tubulin-chain-id',
                        params: {
                            classification: tubulinClassification
                        }
                    };
                    // Color the TARGET ligand by chemical element
                    params.targetParams.colorTheme = {
                        name: 'element-symbol',
                        params: {}
                    };
                });
            }

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
        await this.clearLigandFocus(); // Also clear focus when structure changes
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

    // async clearCurrentStructure(): Promise<void> {
    //     const currentState = this.getCurrentState();
    //     if (!currentState.currentStructure) return;
    //     try {
    //         await this.viewer.clear();
    //         this.dispatch(clearStructure(currentState.currentStructure));
    //         this.dispatch(clearPolymersForStructure(currentState.currentStructure));
    //     } catch (error) {
    //         console.error('Error clearing structure:', error);
    //     }
    // }

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

    private getNonPolymerComponentRef(pdbId: string, uniqueKey: string): string | undefined {
        const state = this.getState();
        const component = state.molstarRefs.components[`${pdbId}_${uniqueKey}`];
        return component?.ref;
    }

    async focusNonPolymer(pdbId: string, uniqueKey: string) {
        try {
            const ref = this.getNonPolymerComponentRef(pdbId, uniqueKey);
            if (!ref || !this.viewer.ctx) {
                console.warn(`No ref found for non-polymer ${uniqueKey} in structure ${pdbId}`);
                return;
            }

            const cell = this.viewer.ctx.state.data.select(StateSelection.Generators.byRef(ref))[0];
            if (!cell?.obj?.data) {
                console.warn(`No cell data found for non-polymer ${uniqueKey}`);
                return;
            }

            const structure = cell.obj.data as Structure;
            const loci = Structure.toStructureElementLoci(structure);

            this.viewer.ctx.managers.camera.focusLoci(loci);

            console.log(`Successfully focused on non-polymer ${uniqueKey}`);

        } catch (error) {
            console.error(`Error focusing non-polymer ${uniqueKey}:`, error);

            try {
                await this.highlightNonPolymer(pdbId, uniqueKey, true);
                console.log(`Fallback: highlighted non-polymer ${uniqueKey} instead of focusing`);
            } catch (fallbackError) {
                console.error(`Fallback highlighting also failed:`, fallbackError);
            }
        }
    }

    async highlightNonPolymer(pdbId: string, uniqueKey: string, shouldHighlight: boolean) {
        if (!this.viewer.ctx) return;

        if (!shouldHighlight) {
            this.viewer.ctx.managers.interactivity.lociHighlights.clearHighlights();
            this.dispatch(setNonPolymerHovered({ pdbId, chemId: uniqueKey, hovered: false }));
            return;
        }

        const ref = this.getNonPolymerComponentRef(pdbId, uniqueKey);
        if (ref) {
            const cell = this.viewer.ctx.state.data.select(StateSelection.Generators.byRef(ref))[0];
            if (cell?.obj?.data) {
                const loci = Structure.toStructureElementLoci(cell.obj.data as Structure);
                this.viewer.ctx.managers.interactivity.lociHighlights.highlight({ loci }, false);
                this.dispatch(setNonPolymerHovered({ pdbId, chemId: uniqueKey, hovered: true }));
            }
        }
    }

    async setNonPolymerVisibility(pdbId: string, uniqueKey: string, isVisible: boolean) {
        const ref = this.getNonPolymerComponentRef(pdbId, uniqueKey);
        if (ref && this.viewer.ctx) {
            setSubtreeVisibility(this.viewer.ctx.state.data, ref, !isVisible);
            this.dispatch(setNonPolymerVisibility({ pdbId, chemId: uniqueKey, visible: isVisible }));
        }
    }


    private parseComputedResidues(mmcifContent: string): ComputedResidueAnnotation[] {
        const annotations: ComputedResidueAnnotation[] = [];

        try {
            const lines = mmcifContent.split('\n');
            let inComputedLoop = false;
            let headerIndices: { [key: string]: number } = {};

            for (let i = 0; i < lines.length; i++) {
                const trimmedLine = lines[i].trim();

                // Detect start of computed residue loop
                if (trimmedLine === 'loop_') {
                    if (i + 1 < lines.length &&
                        lines[i + 1].trim().startsWith('_pdbx_computed_residue.')) {
                        inComputedLoop = true;
                        continue;
                    }
                }

                // Parse headers
                if (inComputedLoop && trimmedLine.startsWith('_pdbx_computed_residue.')) {
                    const field = trimmedLine.replace('_pdbx_computed_residue.', '');
                    headerIndices[field] = Object.keys(headerIndices).length;
                    continue;
                }

                // Parse data lines
                if (inComputedLoop && !trimmedLine.startsWith('_') && !trimmedLine.startsWith('#') && trimmedLine.length > 0) {
                    if (trimmedLine.startsWith('loop_') || trimmedLine.startsWith('data_')) {
                        break; // End of this loop
                    }

                    const parts = trimmedLine.split(/\s+/);
                    if (parts.length >= Object.keys(headerIndices).length) {
                        annotations.push({
                            auth_asym_id: parts[headerIndices['auth_asym_id']] || '',
                            auth_seq_id: parseInt(parts[headerIndices['auth_seq_id']] || '0'),
                            method: parts[headerIndices['method']]?.replace(/'/g, '') || '',
                            confidence: parseFloat(parts[headerIndices['confidence']] || '0')
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Error parsing computed residues:', error);
        }

        return annotations;
    }

    async loadStructureFromBackend(filename: string, tubulinClassification: TubulinClassification): Promise<boolean> {
        try {
            await this.clearCurrentStructure();
            if (!this.viewer.ctx) throw new Error('Molstar not initialized');

            const backendUrl = `http://localhost:8000/models/${filename}`;
            console.log(`Fetching structure from backend: ${backendUrl}`);

            // Fetch the mmCIF content
            const response = await fetch(backendUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch from backend: ${response.status} ${response.statusText}`);
            }

            const mmcifContent = await response.text();

            // Parse computed residue annotations
            const computedAnnotations = this.parseComputedResidues(mmcifContent);
            if (computedAnnotations.length > 0) {
                console.log('🔬 Found computed residue annotations:');
                console.table(computedAnnotations);

                // Group by method for summary
                const byMethod = computedAnnotations.reduce((acc, ann) => {
                    if (!acc[ann.method]) acc[ann.method] = [];
                    acc[ann.method].push(ann);
                    return acc;
                }, {} as Record<string, ComputedResidueAnnotation[]>);

                console.log('📊 Summary by method:');
                Object.entries(byMethod).forEach(([method, anns]) => {
                    console.log(`  ${method}: ${anns.length} residues`);
                });
            } else {
                console.log('No computed residue annotations found in this structure.');
            }

            // Load the structure normally
            const data = await this.viewer.ctx.builders.data.rawData({ data: mmcifContent, label: filename });
            const trajectory = await this.viewer.ctx.builders.structure.parseTrajectory(data, 'mmcif');
            const model = await this.viewer.ctx.builders.structure.createModel(trajectory);
            const structure = await this.viewer.ctx.builders.structure.createStructure(model);

            // Extract PDB ID from filename for consistency
            const pdbId = filename.split('_')[0].toUpperCase();

            const { objects_polymer, objects_ligand } = await this.viewer.ctx.builders.structure.representation.applyPreset(structure, 'tubulin-split-preset-computed-res', {
                pdbId: pdbId,
                tubulinClassification,
                computedResidues: computedAnnotations
            }) as Partial<PresetObjects>;

            const polymerComponents = Object.entries(objects_polymer || {}).reduce((acc, [chainId, data]) => {
                acc[chainId] = { type: 'polymer', pdbId: pdbId, ref: data.ref, chainId: chainId };
                return acc;
            }, {} as Record<string, PolymerComponent>);

            const ligandComponents = Object.entries(objects_ligand || {}).reduce((acc, [uniqueKey, data]) => {
                const [compId, auth_asym_id, auth_seq_id_str] = uniqueKey.split('_');
                const auth_seq_id = parseInt(auth_seq_id_str, 10);
                acc[uniqueKey] = {
                    type: 'ligand',
                    pdbId: pdbId,
                    ref: data.ref,
                    uniqueKey,
                    compId,
                    auth_asym_id,
                    auth_seq_id
                };
                return acc;
            }, {} as Record<string, LigandComponent>);

            this.dispatch(setStructureRef({ pdbId: pdbId, ref: structure.ref }));
            this.dispatch(addComponents({ pdbId: pdbId, components: { ...polymerComponents, ...ligandComponents } }));

            Object.keys(polymerComponents).forEach(chainId => {
                this.dispatch(initializePolymer({ pdbId: pdbId, chainId }));
            });
            Object.keys(ligandComponents).forEach(uniqueKey => {
                this.dispatch(initializeNonPolymer({ pdbId: pdbId, chemId: uniqueKey }));
            });
            if (this.viewer.ctx) {
                await this.viewer.ctx.state.updateBehavior(StructureFocusRepresentation, params => {
                    // Color the SURROUNDING residues using our custom blue/orange theme
                    params.surroundingsParams.colorTheme = {
                        name: 'tubulin-chain-id',
                        params: {
                            classification: tubulinClassification
                        }
                    };
                    // Color the TARGET ligand by chemical element
                    params.targetParams.colorTheme = {
                        name: 'element-symbol',
                        params: {}
                    };
                });
            }
            return true;
        } catch (error) {
            console.error('Error loading structure from backend:', error);
            this.dispatch(setError(error instanceof Error ? error.message : 'Unknown error'));
            return false;
        }
    }



    getChainSequence(pdbId: string, chainId: string): string | null {
        const state = this.getState();
        const component = state.molstarRefs.components[`${pdbId}_${chainId}`];

        if (!component || component.type !== 'polymer') {
            console.warn(`No polymer component found for ${pdbId} chain ${chainId}`);
            return null;
        }

        // Try to get sequence from the component data stored during preset application
        // This assumes your preset stores sequence data - if not, we'll need to extract it from structure
        if ('sequence' in component && Array.isArray(component.sequence)) {
            // Convert ResidueData[] to simple string
            return component.sequence.map(residue => residue.code || 'X').join('');
        }

        // Fallback: extract directly from structure
        return this.extractSequenceFromStructure(pdbId, chainId);
    }

    /**
     * Fallback method to extract sequence directly from structure
     */
    private extractSequenceFromStructure(pdbId: string, chainId: string): string | null {
        if (!this.viewer.ctx) return null;

        const structureRef = this.viewer.ctx.managers.structure.hierarchy.current.structures[0]?.cell;
        if (!structureRef?.obj?.data) return null;

        const structure = structureRef.obj.data;
        const sequence: string[] = [];

        // Iterate through structure units to find the chain
        for (const unit of structure.units) {
            const unitChainId = StructureProperties.chain.auth_asym_id({
                unit,
                element: unit.elements[0]
            });

            if (unitChainId === chainId) {
                // Extract residues for this chain
                const residues = new Map<number, string>();

                for (let i = 0; i < unit.elements.length; i++) {
                    const location = StructureElement.Location.create(structure, unit, unit.elements[i]);
                    const seqId = StructureProperties.residue.auth_seq_id(location);
                    const compId = StructureProperties.atom.label_comp_id(location);

                    // Convert 3-letter code to 1-letter if possible
                    const singleLetter = AMINO_ACIDS_3_TO_1_CODE[compId] || 'X';
                    residues.set(seqId, singleLetter);
                }

                // Sort by sequence ID and build sequence string
                const sortedResidues = Array.from(residues.entries()).sort((a, b) => a[0] - b[0]);
                return sortedResidues.map(([, code]) => code).join('');
            }
        }

        return null;
    }

    /**
     * Get sequence data formatted for SeqViz
     */
    getSequenceForViewer(pdbId: string, chainId: string): SequenceData | null {
        const sequence = this.getChainSequence(pdbId, chainId);
        if (!sequence) return null;

        // Get additional info about the chain
        const state = this.getState();
        const component = state.molstarRefs.components[`${pdbId}_${chainId}`];

        return {
            chainId,
            pdbId,
            sequence,
            name: `${pdbId} Chain ${chainId}`,
            chainType: 'polymer'
        };
    }
    async highlightResidues(pdbId: string, chainId: string, startResidue: number, endResidue: number, shouldHighlight: boolean = true) {
        if (!this.viewer.ctx) return;

        if (!shouldHighlight) {
            this.viewer.ctx.managers.interactivity.lociHighlights.clearHighlights();
            return;
        }

        try {
            const structureRef = this.viewer.ctx.managers.structure.hierarchy.current.structures[0]?.cell;
            if (!structureRef?.obj?.data) return;

            const structure = structureRef.obj.data;

            // Create a selection for the residue range
            const residueSelection = MS.struct.generator.atomGroups({
                'chain-test': MS.core.rel.eq([MS.struct.atomProperty.macromolecular.auth_asym_id(), chainId]),
                'residue-test': MS.core.rel.inRange([
                    MS.struct.atomProperty.macromolecular.auth_seq_id(),
                    startResidue,
                    endResidue
                ])
            });

            const compiled = compile(residueSelection);
            const selection = compiled(new QueryContext(structure));

            if (StructureSelection.isEmpty(selection)) {
                console.warn(`No residues found for chain ${chainId} residues ${startResidue}-${endResidue}`);
                return;
            }

            const loci = StructureSelection.toLociWithSourceUnits(selection);
            this.viewer.ctx.managers.interactivity.lociHighlights.highlight({ loci }, false);

            console.log(`🔍 Highlighted chain ${chainId} residues ${startResidue}-${endResidue}`);

        } catch (error) {
            console.error('Error highlighting residues:', error);
        }
    }

    /**
     * Select and focus on specific residues in Molstar
     */
    async selectResidues(pdbId: string, chainId: string, startResidue: number, endResidue: number) {
        if (!this.viewer.ctx) return;

        try {
            const structureRef = this.viewer.ctx.managers.structure.hierarchy.current.structures[0]?.cell;
            if (!structureRef?.obj?.data) return;

            const structure = structureRef.obj.data;

            // Create selection for residue range
            const residueSelection = MS.struct.generator.atomGroups({
                'chain-test': MS.core.rel.eq([MS.struct.atomProperty.macromolecular.auth_asym_id(), chainId]),
                'residue-test': MS.core.rel.inRange([
                    MS.struct.atomProperty.macromolecular.auth_seq_id(),
                    startResidue,
                    endResidue
                ])
            });

            const compiled = compile(residueSelection);
            const selection = compiled(new QueryContext(structure));

            if (StructureSelection.isEmpty(selection)) {
                console.warn(`No residues found for chain ${chainId} residues ${startResidue}-${endResidue}`);
                return;
            }

            const loci = StructureSelection.toLociWithSourceUnits(selection);

            // Focus camera on selection
            this.viewer.ctx.managers.camera.focusLoci(loci);

            // Also highlight the selection
            this.viewer.ctx.managers.interactivity.lociHighlights.highlight({ loci }, false);

            console.log(`🎯 Selected and focused chain ${chainId} residues ${startResidue}-${endResidue}`);

            // Dispatch to state for sync
            this.dispatch(setResidueSelection({
                pdbId,
                chainId,
                startResidue,
                endResidue,
                source: 'structure'
            }));

        } catch (error) {
            console.error('Error selecting residues:', error);
        }
    }

    /**
     * Hover over a single residue
     */
    async hoverResidue(pdbId: string, chainId: string, residueNumber: number, shouldHover: boolean = true) {
        if (!this.viewer.ctx) return;

        if (!shouldHover) {
            this.viewer.ctx.managers.interactivity.lociHighlights.clearHighlights();
            this.dispatch(setResidueHover(null));
            return;
        }

        try {
            const structureRef = this.viewer.ctx.managers.structure.hierarchy.current.structures[0]?.cell;
            if (!structureRef?.obj?.data) return;

            const structure = structureRef.obj.data;

            const residueSelection = MS.struct.generator.atomGroups({
                'chain-test': MS.core.rel.eq([MS.struct.atomProperty.macromolecular.auth_asym_id(), chainId]),
                'residue-test': MS.core.rel.eq([MS.struct.atomProperty.macromolecular.auth_seq_id(), residueNumber])
            });

            const compiled = compile(residueSelection);
            const selection = compiled(new QueryContext(structure));

            if (StructureSelection.isEmpty(selection)) return;

            const loci = StructureSelection.toLociWithSourceUnits(selection);
            this.viewer.ctx.managers.interactivity.lociHighlights.highlight({ loci }, false);

            // Dispatch hover state
            this.dispatch(setResidueHover({
                pdbId,
                chainId,
                residueNumber,
                source: 'structure'
            }));

        } catch (error) {
            console.error('Error hovering residue:', error);
        }
    }

    /**
     * Create a visual representation (e.g., ball-and-stick) for selected residues
     */
    async createResidueRepresentation(pdbId: string, chainId: string, startResidue: number, endResidue: number, representationType: 'ball-and-stick' | 'spacefill' | 'licorice' = 'ball-and-stick') {
        if (!this.viewer.ctx) return;

        try {
            const structureRef = this.viewer.ctx.managers.structure.hierarchy.current.structures[0]?.cell;
            if (!structureRef?.obj?.data) return;

            const residueSelection = MS.struct.generator.atomGroups({
                'chain-test': MS.core.rel.eq([MS.struct.atomProperty.macromolecular.auth_asym_id(), chainId]),
                'residue-test': MS.core.rel.inRange([
                    MS.struct.atomProperty.macromolecular.auth_seq_id(),
                    startResidue,
                    endResidue
                ])
            });

            const stateUpdate = this.viewer.ctx.state.data.build();
            const selectionComponent = stateUpdate.to(structureRef)
                .apply(StateTransforms.Model.StructureSelectionFromExpression, {
                    expression: residueSelection,
                    label: `${chainId}:${startResidue}-${endResidue} (from sequence)`
                });

            selectionComponent.apply(StateTransforms.Representation.StructureRepresentation3D,
                createStructureRepresentationParams(this.viewer.ctx, structureRef.obj.data, {
                    type: representationType,
                    color: 'chain-id' // Color by chain
                })
            );

            await stateUpdate.commit();

            console.log(`🎨 Created ${representationType} representation for ${chainId}:${startResidue}-${endResidue}`);

        } catch (error) {
            console.error('Error creating residue representation:', error);
        }
    }


    // Add these methods to your MolstarController class to replace the highlight methods:

    /**
     * Simple residue selection using Molstar's native selection system
     */
    async selectResiduesRange(pdbId: string, chainId: string, startResidue: number, endResidue: number) {
        if (!this.viewer.ctx) return;

        try {
            const structureRef = this.viewer.ctx.managers.structure.hierarchy.current.structures[0]?.cell;
            if (!structureRef?.obj?.data) return;

            const structure = structureRef.obj.data;

            // Create a selection expression for the residue range
            const residueSelection = MS.struct.generator.atomGroups({
                'chain-test': MS.core.rel.eq([MS.struct.atomProperty.macromolecular.auth_asym_id(), chainId]),
                'residue-test': MS.core.rel.inRange([
                    MS.struct.atomProperty.macromolecular.auth_seq_id(),
                    startResidue,
                    endResidue
                ])
            });

            // Compile and execute the selection
            const compiled = compile(residueSelection);
            const selection = compiled(new QueryContext(structure));

            if (!StructureSelection.isEmpty(selection)) {
                const loci = StructureSelection.toLociWithSourceUnits(selection);

                // Clear previous selection and add new one using Molstar's native selection
                this.viewer.ctx.managers.structure.selection.clear();
                this.viewer.ctx.managers.structure.selection.fromLoci('add', loci);

                console.log(`✅ Selected residues ${chainId}:${startResidue}-${endResidue} using native Molstar selection`);
            }

        } catch (error) {
            console.error('Error selecting residues:', error);
        }
    }

    /**
     * Clear Molstar selection
     */
    async clearResidueSelection(chainId?: string) {
        if (!this.viewer.ctx) return;

        try {
            // Simply clear the native Molstar selection
            this.viewer.ctx.managers.structure.selection.clear();
            console.log(`🗑️ Cleared Molstar selection`);
        } catch (error) {
            console.error('Error clearing selection:', error);
        }
    }

    /**
     * Focus camera on selected residues
     */
    async focusOnResidues(pdbId: string, chainId: string, startResidue: number, endResidue: number) {
        if (!this.viewer.ctx) return;

        try {
            const structureRef = this.viewer.ctx.managers.structure.hierarchy.current.structures[0]?.cell;
            if (!structureRef?.obj?.data) return;

            const structure = structureRef.obj.data;

            const residueSelection = MS.struct.generator.atomGroups({
                'chain-test': MS.core.rel.eq([MS.struct.atomProperty.macromolecular.auth_asym_id(), chainId]),
                'residue-test': MS.core.rel.inRange([
                    MS.struct.atomProperty.macromolecular.auth_seq_id(),
                    startResidue,
                    endResidue
                ])
            });

            const compiled = compile(residueSelection);
            const selection = compiled(new QueryContext(structure));

            if (!StructureSelection.isEmpty(selection)) {
                const loci = StructureSelection.toLociWithSourceUnits(selection);
                this.viewer.ctx.managers.camera.focusLoci(loci);
                console.log(`🎯 Focused camera on ${chainId}:${startResidue}-${endResidue}`);
            }

        } catch (error) {
            console.error('Error focusing on residues:', error);
        }
    }
}
