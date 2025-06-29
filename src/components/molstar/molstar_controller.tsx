import { MolstarViewer } from './molstar_viewer';
import { AppDispatch, RootState } from '@/store/store';
import { setStructureRef, addComponents, clearStructure, clearAll, PolymerComponent, LigandComponent } from '@/store/slices/molstar_refs';
import { initializePolymer, clearPolymersForStructure, clearAllPolymers, setPolymerVisibility, setPolymerHovered } from '@/store/slices/polymer_states';
import { setLoading, setError } from '@/store/slices/tubulin_structures';

// Mol* imports
import { Structure, StructureProperties, Unit } from 'molstar/lib/mol-model/structure';
import { MolScriptBuilder as MS } from 'molstar/lib/mol-script/language/builder';
import { StateObjectSelector, StateSelection } from 'molstar/lib/mol-state';
import { createStructureRepresentationParams } from 'molstar/lib/mol-plugin-state/helpers/structure-representation-params';
import { StateTransforms } from 'molstar/lib/mol-plugin-state/transforms';
import { PluginCommands } from 'molstar/lib/mol-plugin/commands';
import { setSubtreeVisibility } from 'molstar/lib/mol-plugin/behavior/static/state';
import { TubulinClass, TubulinClassification } from './molstar_preset';

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
        // ... same as before
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
            });

            // Process Polymers
            const polymerComponents = Object.entries(objects_polymer || {}).reduce((acc, [chainId, data]) => {
                acc[chainId] = { type: 'polymer', pdbId: pdbId.toUpperCase(), ref: data.ref, chainId: chainId };
                return acc;
            }, {} as Record<string, PolymerComponent>);

            // Process Ligands
            const ligandComponents = Object.entries(objects_ligand || {}).reduce((acc, [chemId, data]) => {
                acc[chemId] = { type: 'ligand', pdbId: pdbId.toUpperCase(), ref: data.ref, chemicalId: chemId };
                return acc;
            }, {} as Record<string, LigandComponent>);

            // Combine and dispatch to Redux
            this.dispatch(setStructureRef({ pdbId: pdbId.toUpperCase(), ref: structure.ref }));
            this.dispatch(addComponents({ pdbId: pdbId.toUpperCase(), components: { ...polymerComponents, ...ligandComponents } }));

            Object.keys(polymerComponents).forEach(chainId => {
                this.dispatch(initializePolymer({ pdbId: pdbId.toUpperCase(), chainId }));
            });

            return true;
        } catch (error) {
            console.error('Error loading structure:', error);
            this.dispatch(setError(error instanceof Error ? error.message : 'Unknown error'));
            return false;
        }
    }


    private getComponentRef(pdbId: string, chainId: string): string | undefined {
        const state = this.getState();
        const component = state.molstarRefs.components[`${pdbId}_${chainId}`];
        return component?.ref;
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