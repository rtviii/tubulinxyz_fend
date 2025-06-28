import { createPluginUI } from 'molstar/lib/mol-plugin-ui';
import { PluginUIContext } from 'molstar/lib/mol-plugin-ui/context';
import { renderReact18 } from 'molstar/lib/mol-plugin-ui/react18';
import { PluginUISpec } from 'molstar/lib/mol-plugin-ui/spec';
import { PluginCommands } from 'molstar/lib/mol-plugin/commands';
import { Color } from 'molstar/lib/mol-util/color';
import {ribxzSpec} from './molstar_spec';
import { StructureElement, Structure, StructureProperties } from 'molstar/lib/mol-model/structure';
import { Loci } from 'molstar/lib/mol-model/loci';

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
            while (parent.firstChild) {
                parent.removeChild(parent.firstChild);
            }

            this.ctx = await createPluginUI({
                target: parent,
                spec,
                render: renderReact18
            });

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

    async clear() {
        if (!this.ctx) return;
        await PluginCommands.State.RemoveObject(this.ctx, { state: this.ctx.state.data, ref: this.ctx.state.data.tree.root.ref });
    }

    dispose() {
        this.ctx?.dispose();
        this.ctx = null;
        this.initializedPromise = new Promise(resolve => { this.resolveInit = resolve; });
    }

    // --- FULLY IMPLEMENTED METHODS ---

    async loadStructureFromUrl(url: string, format: 'pdb' | 'mmcif' = 'mmcif', isBinary = true) {
        if (!this.ctx) throw new Error('Molstar not initialized');

        await this.clear();

        const data = await this.ctx.builders.data.download({ url, isBinary });
        const trajectory = await this.ctx.builders.structure.parseTrajectory(data, format);
        const model = await this.ctx.builders.structure.createModel(trajectory);
        const structure = await this.ctx.builders.structure.createStructure(model);
        await this.ctx.builders.structure.representation.applyPreset(structure, 'default');

        return { structure };
    }


}
