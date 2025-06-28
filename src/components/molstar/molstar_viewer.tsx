import { createPluginUI } from 'molstar/lib/mol-plugin-ui';
import { PluginUIContext } from 'molstar/lib/mol-plugin-ui/context';
import { renderReact18 } from 'molstar/lib/mol-plugin-ui/react18';
import { PluginUISpec } from 'molstar/lib/mol-plugin-ui/spec';
import { PluginCommands } from 'molstar/lib/mol-plugin/commands';
import { Color } from 'molstar/lib/mol-util/color';
import { ribxzSpec } from './molstar_spec';
import { TubulinSplitPreset } from './molstar_preset';

// --- Important Imports from riboxyz ---
import { setSubtreeVisibility } from 'molstar/lib/mol-plugin/behavior/static/state';
import { StateSelection } from 'molstar/lib/mol-state';
import { Structure } from 'molstar/lib/mol-model/structure';


export class MolstarViewer {
    ctx: PluginUIContext | null = null;
    private resolveInit: (() => void) | null = null;
    private initializedPromise: Promise<void>;

    constructor() {
        this.initializedPromise = new Promise(resolve => {
            this.resolveInit = resolve;
        });
    }

    async init(parent: HTMLElement, spec: PluginUISpec = ribxzSpec) {
        if (this.ctx) {
            await this.initializedPromise;
            return;
        }

        try {
            this.ctx = await createPluginUI({ target: parent, spec, render: renderReact18 });
            this.ctx.builders.structure.representation.registerPreset(TubulinSplitPreset);
            this.setupBasicStyling();
            this.resolveInit?.();
        } catch (error) {
            console.error('Failed to initialize Molstar:', error);
            this.initializedPromise = new Promise(resolve => { this.resolveInit = resolve; });
            throw error;
        }
    }

    private setupBasicStyling() {
        // ... (this method is fine, no changes)
        if (!this.ctx) return;
        const rendererParams = { backgroundColor: Color.fromRgb(255, 255, 255) };
        const renderer = this.ctx.canvas3d?.props.renderer;
        PluginCommands.Canvas3D.SetSettings(this.ctx, {
            settings: { renderer: { ...renderer, ...rendererParams } }
        });
    }

    // --- NEW: Interaction methods based on riboxyz ---
    interactions = {
        setVisibility: (ref: string, isVisible: boolean) => {
            if (!this.ctx) return;
            // This is the correct method from your riboxyz code
            setSubtreeVisibility(this.ctx.state.data, ref, !isVisible);
        },

        highlight: (ref: string, shouldHighlight: boolean) => {
            if (!this.ctx) return;
            if (!shouldHighlight) {
                this.ctx.managers.interactivity.lociHighlights.clearHighlights();
                return;
            }

            const cell = this.ctx.state.data.select(StateSelection.Generators.byRef(ref))[0];
            if (!cell?.obj) return;

            // This is the correct way to get Loci for a component
            const loci = Structure.toStructureElementLoci(cell.obj.data);
            this.ctx.managers.interactivity.lociHighlights.highlight({ loci }, false);
        }
    };

    async clear() {
        if (!this.ctx) return;
        await PluginCommands.State.RemoveObject(this.ctx, { state: this.ctx.state.data, ref: this.ctx.state.data.tree.root.ref, removeParentGhosts: true });
    }

    dispose() {
        this.ctx?.dispose();
        this.ctx = null;
        this.initializedPromise = new Promise(resolve => { this.resolveInit = resolve; });
    }
}
