import { MolstarViewer } from './molstar_viewer'; import { AppDispatch, RootState } from '@/store/store';
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
// Add these new imports if they are missing at the top of molstar_controller.ts

interface StateSnapshot {
    currentStructure: string | null;
    components: Record<string, any>;
    structureRefs: Record<string, string>;
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

            // The preset now returns both polymers and ligands
            const { objects_polymer, objects_ligand } = await this.viewer.ctx.builders.structure.representation.applyPreset(structure, 'tubulin-split-preset', {
                pdbId: pdbId.toUpperCase(),
                tubulinClassification
            }) as Partial<PresetObjects>; // We can cast it to be certain


            // Process Polymers
            const polymerComponents = Object.entries(objects_polymer || {}).reduce((acc, [chainId, data]) => {
                acc[chainId] = { type: 'polymer', pdbId: pdbId.toUpperCase(), ref: data.ref, chainId: chainId };
                return acc;
            }, {} as Record<string, PolymerComponent>);

            const ligandComponents = Object.entries(objects_ligand || {}).reduce((acc, [uniqueKey, data]) => {
                // Deconstruct the uniqueKey to get the details
                const [compId, auth_asym_id, auth_seq_id_str] = uniqueKey.split('_');
                const auth_seq_id = parseInt(auth_seq_id_str, 10);

                // The key in the 'components' map remains unique: PDBID_GTP_A_501
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

            // Combine and dispatch to Redux
            this.dispatch(setStructureRef({ pdbId: pdbId.toUpperCase(), ref: structure.ref }));
            this.dispatch(addComponents({ pdbId: pdbId.toUpperCase(), components: { ...polymerComponents, ...ligandComponents } }));

            // Initialize state for both polymers and non-polymers
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
    // In MolstarController class

    // ... inside your MolstarController class

    async createGtpInterfaceBonds() {
        if (!this.viewer.ctx) {
            console.error('Molstar context not available');
            return;
        }
        const plugin = this.viewer.ctx;

        // 1. Get the parent structure object
        const structureRef = plugin.managers.structure.hierarchy.current.structures[0];
        if (!structureRef?.cell.obj?.data) {
            console.error('No structure loaded');
            this.dispatch(setError('No structure loaded. Please load a PDB structure first.'));
            return;
        }
        const structure = structureRef.cell.obj.data;

        // --- Debugging Step: Log all non-polymer component names ---
        const allLigands = new Set<string>();
        Structure.eachAtomicHierarchyElement(structure, {
            residue: loc => {
                if (StructureProperties.entity.type(loc) === 'non-polymer') {
                    allLigands.add(StructureProperties.atom.auth_comp_id(loc));
                }
            }
        });
        console.log('Found non-polymer molecules in structure:', Array.from(allLigands));
        // --- End Debugging Step ---

        // 2. Define the MolScript expression for the interface atoms.
        const ligandQuery = MS.struct.filter.first({ // Corrected: Use filter.first
            0: MS.struct.generator.atomGroups({
                // Check for GTP and its common analogs
                'residue-test': MS.core.logic.or([
                    MS.core.rel.eq([MS.ammp('auth_comp_id'), 'GTP']),
                    MS.core.rel.eq([MS.ammp('auth_comp_id'), 'GDP']),
                    MS.core.rel.eq([MS.ammp('auth_comp_id'), 'GNP']),
                ]),
                'group-by': MS.ammp('residueKey')
            })
        });

        const surroundings = MS.struct.modifier.includeSurroundings({
            0: ligandQuery,
            radius: 5,
            'as-whole-residues': false
        });

        const ligandPartners = MS.struct.filter.isConnectedTo({
            0: ligandQuery,
            target: surroundings
        });

        const surroundingPartners = MS.struct.filter.isConnectedTo({
            0: surroundings,
            target: ligandQuery
        });

        const interfaceAtomsUnionExpr = MS.struct.modifier.union({
            0: MS.struct.combinator.merge([ligandPartners, surroundingPartners])
        });

        // 3. Use the State Builder to create the component and its representation.
        const update = plugin.state.data.build();

        const component = update.to(structureRef.cell)
            .apply(StateTransforms.Model.StructureSelectionFromExpression, {
                expression: interfaceAtomsUnionExpr,
                label: 'Ligand Interface Bonds'
            });

        component.apply(StateTransforms.Representation.StructureRepresentation3D,
            createStructureRepresentationParams(plugin, structure, {
                type: 'ball-and-stick',
                color: 'element-symbol'
            })
        );

        // 4. Commit the changes to the state tree.
        await update.commit();

        // 5. Check if the new component is empty and handle the error.
        const newCell = plugin.state.data.select(component.ref)[0];
        const newStructure = newCell?.obj?.data as Structure | undefined;
        if (!newStructure || newStructure.elementCount === 0) {
            // The selection was empty. Clean up the newly created (but empty) component.
            await plugin.state.data.build().delete(component.ref).commit();
            this.dispatch(setError('Could not create interface. No connections found between ligand (GTP/GDP/GNP) and surroundings. Check console for available ligands.'));
        }
    }

    async setNonPolymerVisibility(pdbId: string, uniqueKey: string, isVisible: boolean) {
        const ref = this.getLigandComponentRef(pdbId, uniqueKey);
        if (ref && this.viewer.ctx) {
            setSubtreeVisibility(this.viewer.ctx.state.data, ref, !isVisible);
            this.dispatch(setNonPolymerVisibility({ pdbId, chemId: uniqueKey, visible: isVisible }));
        }
    }

    async highlightNonPolymer(pdbId: string, chemId: string, shouldHighlight: boolean) {
        if (!this.viewer.ctx) return;

        if (!shouldHighlight) {
            this.viewer.ctx.managers.interactivity.lociHighlights.clearHighlights();
            this.dispatch(setNonPolymerHovered({ pdbId, chemId, hovered: false }));
            return;
        }

        const ref = this.getLigandComponentRef(pdbId, chemId);
        if (ref) {
            const cell = this.viewer.ctx.state.data.select(StateSelection.Generators.byRef(ref))[0];
            if (cell?.obj?.data) {
                const loci = Structure.toStructureElementLoci(cell.obj.data as Structure);
                this.viewer.ctx.managers.interactivity.lociHighlights.highlight({ loci }, false);
                this.dispatch(setNonPolymerHovered({ pdbId, chemId, hovered: true }));
            }
        }
    }

    async focusNonPolymer(pdbId: string, chemId: string) {
        try {
            const ref = this.getLigandComponentRef(pdbId, chemId);
            if (!ref || !this.viewer.ctx) {
                console.warn(`No ref found for ligand ${chemId} in structure ${pdbId}`);
                return;
            }

            const cell = this.viewer.ctx.state.data.select(StateSelection.Generators.byRef(ref))[0];
            if (!cell?.obj?.data) {
                console.warn(`No cell data found for ligand ${chemId}`);
                return;
            }

            // Same fix: use Structure.toStructureElementLoci instead of StructureSelection.toLociWithSourceUnits
            const structure = cell.obj.data as Structure;
            const loci = Structure.toStructureElementLoci(structure);

            this.viewer.ctx.managers.camera.focusLoci(loci);

            console.log(`Successfully focused on ligand ${chemId}`);

        } catch (error) {
            console.error(`Error focusing ligand ${chemId}:`, error);
        }
    }

    private getLigandComponentRef(pdbId: string, uniqueKey: string): string | undefined {
        const state = this.getState();
        const component = state.molstarRefs.components[`${pdbId}_${uniqueKey}`];
        return component?.ref;
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

            // The key fix: cell.obj.data is a Structure, not a StructureSelection
            // Use Structure.toStructureElementLoci to get the loci
            const structure = cell.obj.data as Structure;
            const loci = Structure.toStructureElementLoci(structure);

            // Focus on the loci
            this.viewer.ctx.managers.camera.focusLoci(loci);

            console.log(`Successfully focused on chain ${chainId}`);

        } catch (error) {
            console.error(`Error focusing chain ${chainId}:`, error);

            // Fallback to highlighting if focus fails
            try {
                await this.highlightChain(pdbId, chainId, true);
                console.log(`Fallback: highlighted chain ${chainId} instead of focusing`);
            } catch (fallbackError) {
                console.error(`Fallback highlighting also failed:`, fallbackError);
            }
        }
    }

    // --- CORRECTED INTERACTION METHODS ---

    async setChainVisibility(pdbId: string, chainId: string, isVisible: boolean) {
        const ref = this.getComponentRef(pdbId, chainId);
        if (ref && this.viewer.ctx) {
            // Correct method based on riboxyz
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
                // Correct method based on riboxyz to get Loci from a component
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