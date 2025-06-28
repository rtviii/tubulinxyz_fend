import { MolstarViewer, ComponentData } from './molstar_viewer';
import { AppDispatch, RootState } from '@/store/store';
import { setStructureRef, addComponents, clearStructure, clearAll, PolymerComponent, LigandComponent } from '@/store/slices/molstar_refs';
import { initializePolymer, clearPolymersForStructure, clearAllPolymers } from '@/store/slices/polymer_states';
import { setLoading, setError } from '@/store/slices/tubulin_structures';

// Type for the current state snapshot to reduce getState() calls
interface StateSnapshot {
    currentStructure: string | null;
    components: Record<string, any>;
    structureRefs: Record<string, string>;
}

export class MolstarController {
    private viewer: MolstarViewer;
    private dispatch: AppDispatch;
    private getState: () => RootState;

    constructor(
        viewer: MolstarViewer,
        dispatch: AppDispatch,
        getState: () => RootState
    ) {
        this.viewer = viewer;
        this.dispatch = dispatch;
        this.getState = getState;
    }

    // Helper method to get current state snapshot
    private getCurrentState(): StateSnapshot {
        const state = this.getState();
        return {
            currentStructure: state.molstarRefs.currentStructure,
            components: state.molstarRefs.components,
            structureRefs: state.molstarRefs.structureRefs
        };
    }

    async loadStructure(pdbId: string, nomenclature_map: Record<string, string> = {}): Promise<boolean> {
        try {
            this.dispatch(setLoading(true));
            this.dispatch(setError(null));

            // Clear existing structure from state
            const currentState = this.getCurrentState();
            if (currentState.currentStructure) {
                await this.clearCurrentStructure();
            }

            // Load structure directly using Molstar builders
            if (!this.viewer.ctx) {
                throw new Error('Molstar not initialized');
            }

            // Use the RCSB PDB binary CIF URL
            const asset_url = `https://models.rcsb.org/${pdbId.toUpperCase()}.bcif`;
            
            const data = await this.viewer.ctx.builders.data.download(
                {
                    url: asset_url,
                    isBinary: true,
                    label: `${pdbId.toUpperCase()}`
                },
                { state: { isGhost: true } }
            );

            const trajectory = await this.viewer.ctx.builders.structure.parseTrajectory(data, 'mmcif');
            const model = await this.viewer.ctx.builders.structure.createModel(trajectory);
            const structure = await this.viewer.ctx.builders.structure.createStructure(model);

            // Apply default preset
            await this.viewer.ctx.builders.structure.representation.applyPreset(
                structure.ref,
                'default'
            );

            // Update Redux state with the new structure
            this.dispatch(setStructureRef({ 
                pdbId: pdbId.toUpperCase(), 
                ref: structure.ref 
            }));

            // For now, create basic polymer components (we'll enhance this later)
            const basicComponents: Record<string, PolymerComponent | LigandComponent> = {
                'A': {
                    type: 'polymer' as const,
                    pdbId: pdbId.toUpperCase(),
                    ref: structure.ref,
                    chainId: 'A'
                },
                'B': {
                    type: 'polymer' as const,
                    pdbId: pdbId.toUpperCase(),
                    ref: structure.ref,
                    chainId: 'B'
                }
            };

            // Add components to Redux store
            this.dispatch(addComponents({
                pdbId: pdbId.toUpperCase(),
                components: basicComponents
            }));

            // Initialize polymer states for typical tubulin chains
            ['A', 'B'].forEach(chainId => {
                this.dispatch(initializePolymer({ 
                    pdbId: pdbId.toUpperCase(), 
                    chainId 
                }));
            });

            this.dispatch(setLoading(false));
            return true;

        } catch (error) {
            console.error('Error loading structure:', error);
            this.dispatch(setError(error instanceof Error ? error.message : 'Unknown error'));
            this.dispatch(setLoading(false));
            return false;
        }
    }

    async clearCurrentStructure(): Promise<void> {
        const currentState = this.getCurrentState();
        if (!currentState.currentStructure) return;

        try {
            // Clear from viewer
            await this.viewer.clear();

            // Clear from Redux state
            this.dispatch(clearStructure(currentState.currentStructure));
            this.dispatch(clearPolymersForStructure(currentState.currentStructure));

        } catch (error) {
            console.error('Error clearing structure:', error);
            throw error;
        }
    }

    async clearAll(): Promise<void> {
        try {
            // Clear from viewer
            await this.viewer.clear();

            // Clear from Redux state
            this.dispatch(clearAll());
            this.dispatch(clearAllPolymers());

        } catch (error) {
            console.error('Error clearing all structures:', error);
            throw error;
        }
    }

    // Polymer interaction methods using typed state access
    setPolymerVisibility(pdbId: string, chainId: string, visible: boolean) {
        const currentState = this.getCurrentState();
        const component = currentState.components[chainId];
        
        if (component) {
            this.viewer.setComponentVisibility(component.ref, visible);
        }
    }

    focusPolymer(pdbId: string, chainId: string) {
        const currentState = this.getCurrentState();
        const component = currentState.components[chainId];
        
        if (component) {
            this.viewer.focusComponent(component.ref);
        }
    }

    highlightPolymer(pdbId: string, chainId: string) {
        const currentState = this.getCurrentState();
        const component = currentState.components[chainId];
        
        if (component) {
            this.viewer.highlightComponent(component.ref);
        }
    }

    dispose() {
        this.viewer.dispose();
    }
}