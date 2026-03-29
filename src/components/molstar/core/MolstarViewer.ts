import { createPluginUI } from 'molstar/lib/mol-plugin-ui';
import { PluginUIContext } from 'molstar/lib/mol-plugin-ui/context';
import { renderReact18 } from 'molstar/lib/mol-plugin-ui/react18';
import { PluginUISpec } from 'molstar/lib/mol-plugin-ui/spec';
import { PluginCommands } from 'molstar/lib/mol-plugin/commands';
import { Color } from 'molstar/lib/mol-util/color';
import { Vec3 } from 'molstar/lib/mol-math/linear-algebra/3d/vec3';
import { Vec4 } from 'molstar/lib/mol-math/linear-algebra/3d/vec4';
import { StateSelection } from 'molstar/lib/mol-state';
import { Structure } from 'molstar/lib/mol-model/structure';
import { setSubtreeVisibility } from 'molstar/lib/mol-plugin/behavior/static/state';
import { StructureElement, StructureProperties } from 'molstar/lib/mol-model/structure';
import { ribxzSpec } from '../spec';
import { EnhancedTubulinSplitPreset } from '../colors/preset_structure'; // <-- Add import
import { Subscription } from 'rxjs';

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

  handleResize() {
    this.ctx?.canvas3d?.handleResize();
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

  resetCamera(durationMs = 250): void {
    if (!this.ctx) return;
    PluginCommands.Camera.Reset(this.ctx, { durationMs });
  }

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



  //----


  subscribeToHover(
    callback: (info: { chainId: string; authSeqId: number; position3d?: [number, number, number]; pageCoords?: [number, number] } | null) => void
  ): () => void {
    if (!this.ctx) {
      console.warn('[MolstarViewer] Cannot subscribe to hover - not initialized');
      return () => { };
    }

    const subscription = this.ctx.behaviors.interaction.hover.subscribe((e) => {
      if (StructureElement.Loci.is(e.current.loci) && !StructureElement.Loci.isEmpty(e.current.loci)) {
        let emitted = false;
        StructureElement.Loci.forEachLocation(e.current.loci, (location) => {
          if (emitted) return;
          const chainId = StructureProperties.chain.auth_asym_id(location);
          const authSeqId = StructureProperties.residue.auth_seq_id(location);

          // Use event's picking position (world space, accounts for all transforms).
          // Fall back to atom properties (model space) only if picking position unavailable.
          let position3d: [number, number, number] | undefined;
          if ((e as any).position) {
            const p = (e as any).position;
            position3d = [p[0], p[1], p[2]];
          } else {
            position3d = [
              StructureProperties.atom.x(location),
              StructureProperties.atom.y(location),
              StructureProperties.atom.z(location),
            ];
          }

          const pageCoords: [number, number] | undefined = (e as any).page
            ? [(e as any).page[0], (e as any).page[1]]
            : undefined;

          callback({ chainId, authSeqId, position3d, pageCoords });
          emitted = true;
        });
      } else {
        callback(null);
      }
    });

    return () => subscription.unsubscribe();
  }

  subscribeToClick(
    callback: (info: { chainId: string; authSeqId: number } | null) => void
  ): () => void {
    if (!this.ctx) {
      return () => { };
    }

    const subscription = this.ctx.behaviors.interaction.click.subscribe((e) => {
      if (StructureElement.Loci.is(e.current.loci) && !StructureElement.Loci.isEmpty(e.current.loci)) {
        let emitted = false;
        StructureElement.Loci.forEachLocation(e.current.loci, (location) => {
          if (emitted) return;
          const chainId = StructureProperties.chain.auth_asym_id(location);
          const authSeqId = StructureProperties.residue.auth_seq_id(location);
          callback({ chainId, authSeqId });
          emitted = true;
        });
      } else {
        callback(null);
      }
    });

    return () => subscription.unsubscribe();
  }
  // --- Selection ---

  clearSelection(): void {
    this.ctx?.managers.interactivity.lociSelects.deselectAll();
    this.ctx?.managers.structure.selection.clear();
  }

  addToSelection(loci: StructureElement.Loci): void {
    this.ctx?.managers.structure.selection.fromLoci('add', loci);
  }

  setSelection(loci: StructureElement.Loci): void {
    this.ctx?.managers.structure.selection.fromLoci('set', loci);
  }

  // --- 3D to 2D projection ---

  /**
   * Project a 3D world position to page-relative pixel coordinates.
   * cameraProject outputs device pixels in WebGL window coords (Y=0 at bottom).
   * We convert to CSS pixels (Y=0 at top) and add the canvas page offset.
   */
  projectToScreen(position3d: [number, number, number]): { x: number; y: number } | null {
    const canvas3d = this.ctx?.canvas3d;
    if (!canvas3d) return null;

    const camera = canvas3d.camera;
    const viewport = camera.viewport;
    const point = Vec3.create(position3d[0], position3d[1], position3d[2]);
    const projected = Vec4.create(0, 0, 0, 0);
    camera.project(projected, point);

    const canvasEl = canvas3d.webgl.gl.canvas;
    const rect = canvasEl instanceof HTMLElement ? canvasEl.getBoundingClientRect() : null;
    if (!rect) return null;

    // cameraProject outputs device pixels with Y=0 at bottom (WebGL convention).
    // Convert to CSS pixels with Y=0 at top (DOM convention).
    const scale = viewport.width / rect.width;
    const cssX = projected[0] / scale;
    const cssY = (viewport.height - projected[1]) / scale;

    return {
      x: cssX + rect.left + window.scrollX,
      y: cssY + rect.top + window.scrollY,
    };
  }

  /**
   * Subscribe to post-render events (fires every frame, including smooth
   * animations). More reliable than camera.stateChanged for tracking DOM
   * elements anchored to 3D positions.
   */
  subscribeToDidDraw(callback: () => void): () => void {
    const canvas3d = this.ctx?.canvas3d;
    if (!canvas3d) return () => {};
    const subscription = canvas3d.didDraw.subscribe(callback);
    return () => subscription.unsubscribe();
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