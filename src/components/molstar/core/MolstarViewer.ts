import { createPluginUI } from 'molstar/lib/mol-plugin-ui';
import { PluginUIContext } from 'molstar/lib/mol-plugin-ui/context';
import { renderReact18 } from 'molstar/lib/mol-plugin-ui/react18';
import { PluginUISpec } from 'molstar/lib/mol-plugin-ui/spec';
import { PluginCommands } from 'molstar/lib/mol-plugin/commands';
import { Color } from 'molstar/lib/mol-util/color';
import { StateSelection } from 'molstar/lib/mol-state';
import { Structure } from 'molstar/lib/mol-model/structure';
import { setSubtreeVisibility } from 'molstar/lib/mol-plugin/behavior/static/state';
import { StructureElement } from 'molstar/lib/mol-model/structure';
import { ribxzSpec } from '../spec';
import { EnhancedTubulinSplitPreset } from '../colors/molstar_preset'; // <-- Add import


/**
 * Pure Molstar wrapper - handles lifecycle and low-level canvas operations.
 * No Redux, no business logic.
 */
export class MolstarViewer {
  ctx: PluginUIContext | null = null;
  private initPromise: Promise<void> | null = null;


  async init(container: HTMLElement, spec: PluginUISpec = ribxzSpec): Promise<void> {
    if (this.ctx) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.doInit(container, spec);
    return this.initPromise;
  }

  private async doInit(container: HTMLElement, spec: PluginUISpec): Promise<void> {
    this.ctx = await createPluginUI({ target: container, spec, render: renderReact18 });
    
    // Register custom preset
    this.ctx.builders.structure.representation.registerPreset(EnhancedTubulinSplitPreset);
    
    this.applyDefaultStyling();
  }

  private applyDefaultStyling(): void {
    if (!this.ctx) return;

    const renderer = this.ctx.canvas3d?.props.renderer;
    PluginCommands.Canvas3D.SetSettings(this.ctx, {
      settings: {
        renderer: {
          ...renderer,
          backgroundColor: Color.fromRgb(255, 255, 255),
        },
      },
    });
  }

  // --- Data Loading ---

  async loadFromUrl(url: string, isBinary: boolean, label: string) {
    if (!this.ctx) throw new Error('Viewer not initialized');

    const data = await this.ctx.builders.data.download({ url, isBinary, label });
    const trajectory = await this.ctx.builders.structure.parseTrajectory(data, 'mmcif');
    const model = await this.ctx.builders.structure.createModel(trajectory);
    const structure = await this.ctx.builders.structure.createStructure(model);

    return structure;
  }

  async loadFromData(content: string, label: string) {
    if (!this.ctx) throw new Error('Viewer not initialized');

    const data = await this.ctx.builders.data.rawData({ data: content, label });
    const trajectory = await this.ctx.builders.structure.parseTrajectory(data, 'mmcif');
    const model = await this.ctx.builders.structure.createModel(trajectory);
    const structure = await this.ctx.builders.structure.createStructure(model);

    return structure;
  }

  // --- Visual Operations ---

  setSubtreeVisibility(ref: string, visible: boolean): void {
    if (!this.ctx) return;
    setSubtreeVisibility(this.ctx.state.data, ref, !visible);
  }

  highlightLoci(loci: StructureElement.Loci | null): void {
    if (!this.ctx) return;

    if (!loci || StructureElement.Loci.isEmpty(loci)) {
      this.ctx.managers.interactivity.lociHighlights.clearHighlights();
    } else {
      this.ctx.managers.interactivity.lociHighlights.highlight({ loci }, false);
    }
  }

  focusLoci(loci: StructureElement.Loci, durationMs: number = 100): void {
    if (!this.ctx || StructureElement.Loci.isEmpty(loci)) return;
    this.ctx.managers.camera.focusLoci(loci, { durationMs });
  }

  setFocusFromLoci(loci: StructureElement.Loci): void {
    if (!this.ctx) return;
    this.ctx.managers.structure.focus.setFromLoci(loci);
  }

  clearFocus(): void {
    this.ctx?.managers.structure.focus.clear();
  }

  // --- Structure Access ---

  getCurrentStructure(): Structure | undefined {
    return this.ctx?.managers.structure.hierarchy.current.structures[0]?.cell.obj?.data;
  }

  getStructureFromRef(ref: string): Structure | undefined {
    if (!this.ctx) return undefined;
    const cell = this.ctx.state.data.select(StateSelection.Generators.byRef(ref))[0];
    return cell?.obj?.data as Structure | undefined;
  }

  // --- Selection ---

  clearSelection(): void {
    this.ctx?.managers.structure.selection.clear();
  }

  addToSelection(loci: StructureElement.Loci): void {
    this.ctx?.managers.structure.selection.fromLoci('add', loci);
  }

  // --- Cleanup ---

  async clear(): Promise<void> {
    if (!this.ctx) return;
    await PluginCommands.State.RemoveObject(this.ctx, {
      state: this.ctx.state.data,
      ref: this.ctx.state.data.tree.root.ref,
      removeParentGhosts: true,
    });
  }

  dispose(): void {
    this.ctx?.dispose();
    this.ctx = null;
    this.initPromise = null;
  }
}