import { createPluginUI } from 'molstar/lib/mol-plugin-ui';
import { PluginUIContext } from 'molstar/lib/mol-plugin-ui/context';
import { renderReact18 } from 'molstar/lib/mol-plugin-ui/react18';
import { PluginUISpec } from 'molstar/lib/mol-plugin-ui/spec';
import { PluginCommands } from 'molstar/lib/mol-plugin/commands';
import { Color } from 'molstar/lib/mol-util/color';
import { ribxzSpec } from './molstar_spec';
import { TubulinSplitPreset } from './molstar_preset';
import { setSubtreeVisibility } from 'molstar/lib/mol-plugin/behavior/static/state';
import { StateSelection } from 'molstar/lib/mol-state';
import { Structure } from 'molstar/lib/mol-model/structure';
import { EnhancedTubulinSplitPreset } from './molstar_preset_computed_residues';


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
            this.ctx.builders.structure.representation.registerPreset(EnhancedTubulinSplitPreset);

            this.setupBasicStyling();
            this.resolveInit?.();
        } catch (error) {
            console.error('Failed to initialize Molstar:', error);
            this.initializedPromise = new Promise(resolve => { this.resolveInit = resolve; });
            throw error;
        }
    }

    private setupBasicStyling() {
        if (!this.ctx) return;
        const rendererParams = { backgroundColor: Color.fromRgb(255, 255, 255) };
        const renderer = this.ctx.canvas3d?.props.renderer;
        PluginCommands.Canvas3D.SetSettings(this.ctx, {
            settings: { renderer: { ...renderer, ...rendererParams } }
        });
    }

    interactions = {
        setVisibility: (ref: string, isVisible: boolean) => {
            if (!this.ctx) return;
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
            const loci = Structure.toStructureElementLoci(cell.obj.data);
            this.ctx.managers.interactivity.lociHighlights.highlight({ loci }, false);
        }
    };

    representations = {
        stylized_lighting: async () => {
            this.ctx.managers.structure.component.setOptions({
                ...this.ctx.managers.structure.component.state.options,
                ignoreLight: true
            });

            if (this.ctx.canvas3d) {
                const pp = this.ctx.canvas3d.props.postprocessing;
                this.ctx.canvas3d.setProps({
                    postprocessing: {
                        outline: {
                            name: 'on',
                            params:
                                pp.outline.name === 'on'
                                    ? pp.outline.params
                                    : {
                                        scale: 1,
                                        color: Color(0x000000),
                                        threshold: 0.33,
                                        // @ts-ignore
                                        includeTransparent: true
                                    }
                        },
                        occlusion: {
                            name: 'on',
                            params:
                                pp.occlusion.name === 'on'
                                    ? pp.occlusion.params
                                    : {
                                        // @ts-ignore
                                        multiScale: {
                                            name: 'off',
                                            params: {}
                                        },
                                        radius: 5,
                                        bias: 0.8,
                                        blurKernelSize: 15,
                                        blurDepthBias: 0.5,
                                        samples: 32,
                                        resolutionScale: 1,
                                        color: Color(0x000000)
                                    }
                        },
                        shadow: { name: 'off', params: {} }
                    }
                });
            }
        }
    }

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
