import { AppDispatch, RootState } from '@/store/store';
import { MolstarViewer } from '../core/MolstarViewer';
import {
  MolstarInstanceId,
  Component,
  PolymerComponent,
  LigandComponent,
  TubulinClassification,
  isPolymerComponent,
  isLigandComponent,
  ObservedSequenceData,
  SequenceData,
} from '../core/types'
import {
  buildChainQuery,
  buildResidueQuery,
  buildLigandQuery,
  buildSurroundingsQuery,
  executeQuery,
  structureToLoci,
  extractObservedSequence,
} from '../core/queries';
import {
  setLoadedStructure,
  registerComponents,
  setComponentVisibility,
  setComponentHovered,
  setActiveColorscheme,
  clearInstance,
  getComponentKey,
} from '../state/molstarInstancesSlice'
import { Structure, StructureElement } from 'molstar/lib/mol-model/structure';
import { Loci } from 'molstar/lib/mol-model/loci';
import { Color } from 'molstar/lib/mol-util/color';
import { MonomerPresetResult } from '../colors/preset_monomer';
import { STYLIZED_POSTPROCESSING } from '../rendering/postprocessing-config';
import { ResidueColoring } from '../coloring/types';

/**
 * MolstarInstance - orchestrates viewer operations with Redux state.
 * One instance per viewer (structure, monomer, etc.)
 */
export class MolstarInstance {
  constructor(
    public readonly id: MolstarInstanceId,
    public readonly viewer: MolstarViewer,
    private dispatch: AppDispatch,
    private getState: () => RootState
  ) { }

  // ============================================================
  // State Access Helpers
  // ============================================================

  private get instanceState() {
    return this.getState().molstarInstances.instances[this.id];
  }

  private get loadedStructure(): string | null {
    return this.instanceState.loadedStructure;
  }

  private getComponent(key: string): Component | undefined {
    return this.instanceState.components[key];
  }

  private getComponentState(key: string) {
    return this.instanceState.componentStates[key];
  }

  /**
   * Internal helper to apply stylized lighting (turning lights off)
   * and post-processing (contours/occlusion) by default.
   */
  private async applyStylizedLighting() {
    const plugin = this.viewer.ctx;
    if (!plugin) return;

    // 1. Set ignoreLight on structure component manager globally.
    // This ensures all representations default to flat/uniform shading.
    plugin.managers.structure.component.setOptions({
      ...plugin.managers.structure.component.state.options,
      ignoreLight: true
    });

    // 2. Apply the post-processing configuration (Outline and Occlusion).
    if (plugin.canvas3d) {
      plugin.canvas3d.setProps({
        postprocessing: STYLIZED_POSTPROCESSING
      });
    }
  }

  // ============================================================
  // Structure Loading
  // ============================================================

  async loadStructure(pdbId: string, classification: TubulinClassification): Promise<boolean> {
    try {
      await this.clearCurrentStructure();

      const url = `https://models.rcsb.org/${pdbId.toUpperCase()}.bcif`;
      const structureRef = await this.viewer.loadFromUrl(url, true, pdbId.toUpperCase());

      if (!this.viewer.ctx) throw new Error('Viewer not initialized');

      // Automatically apply the "flat" lighting and contours

      // Apply preset
      const result = await this.viewer.ctx.builders.structure.representation.applyPreset(
        structureRef,
        'tubulin-split-preset-computed-res',
        {
          pdbId: pdbId.toUpperCase(),
          tubulinClassification: classification,
          computedResidues: []
        }
      );

      // Extract components from preset result
      const components = this.extractComponentsFromPreset(pdbId.toUpperCase(), result);

      // Register in Redux
      this.dispatch(setLoadedStructure({
        instanceId: this.id,
        pdbId: pdbId.toUpperCase(),
        structureRef: structureRef.ref,
      }));

      this.dispatch(registerComponents({
        instanceId: this.id,
        components,
      }));

      await this.applyStylizedLighting();
      return true;
    } catch (error) {
      console.error(`[${this.id}] Failed to load structure:`, error);
      return false;
    }
  }

  async loadMonomerChain(pdbId: string, chainId: string): Promise<MonomerPresetResult | null> {
    try {
      await this.clearCurrentStructure();

      const url = `https://models.rcsb.org/${pdbId.toUpperCase()}.bcif`;
      const structureRef = await this.viewer.loadFromUrl(url, true, pdbId.toUpperCase());

      if (!this.viewer.ctx) throw new Error('Viewer not initialized');

      // Automatically apply the "flat" lighting and contours

      const result = await this.viewer.ctx.builders.structure.representation.applyPreset(
        structureRef,
        'monomer-single-chain',
        { chainId }
      ) as MonomerPresetResult;

      if (!result.chainRef) {
        throw new Error(`Chain ${chainId} not found`);
      }

      this.dispatch(setLoadedStructure({
        instanceId: this.id,
        pdbId: pdbId.toUpperCase(),
        structureRef: structureRef.ref,
      }));

      this.dispatch(registerComponents({
        instanceId: this.id,
        components: [{
          type: 'polymer',
          pdbId: pdbId.toUpperCase(),
          ref: result.chainRef,
          chainId,
        }],
      }));

      await this.applyStylizedLighting();
      return result;
    } catch (error) {
      console.error(`[${this.id}] Failed to load monomer chain:`, error);
      return null;
    }
  }

  private extractComponentsFromPreset(pdbId: string, presetResult: any): Component[] {
    const components: Component[] = [];

    const { objects_polymer, objects_ligand } = presetResult || {};

    // Polymers
    if (objects_polymer) {
      for (const [chainId, data] of Object.entries(objects_polymer)) {
        components.push({
          type: 'polymer',
          pdbId,
          ref: (data as any).ref,
          chainId,
        });
      }
    }

    // Ligands
    if (objects_ligand) {
      for (const [uniqueKey, data] of Object.entries(objects_ligand)) {
        const [compId, authAsymId, authSeqIdStr] = uniqueKey.split('_');
        components.push({
          type: 'ligand',
          pdbId,
          ref: (data as any).ref,
          uniqueKey,
          compId,
          authAsymId,
          authSeqId: parseInt(authSeqIdStr, 10),
        });
      }
    }

    return components;
  }

  // ============================================================
  // Visibility Operations
  // ============================================================

  setChainVisibility(chainId: string, visible: boolean): void {
    const component = this.getComponent(chainId);
    if (!component || !isPolymerComponent(component)) return;

    this.viewer.setSubtreeVisibility(component.ref, visible);
    this.dispatch(setComponentVisibility({
      instanceId: this.id,
      componentKey: chainId,
      visible,
    }));
  }

  setLigandVisibility(uniqueKey: string, visible: boolean): void {
    const component = this.getComponent(uniqueKey);
    if (!component || !isLigandComponent(component)) return;

    this.viewer.setSubtreeVisibility(component.ref, visible);
    this.dispatch(setComponentVisibility({
      instanceId: this.id,
      componentKey: uniqueKey,
      visible,
    }));
  }

  setAllChainsVisibility(visible: boolean): void {
    for (const [key, component] of Object.entries(this.instanceState.components)) {
      if (isPolymerComponent(component)) {
        this.setChainVisibility(key, visible);
      }
    }
  }

  isolateChain(chainId: string, keepLigands: boolean = true): void {
    for (const [key, component] of Object.entries(this.instanceState.components)) {
      if (isPolymerComponent(component)) {
        this.setChainVisibility(key, key === chainId);
      } else if (isLigandComponent(component)) {
        this.setLigandVisibility(key, keepLigands);
      }
    }
  }

  // ============================================================
  // Highlight Operations
  // ============================================================

  highlightChain(chainId: string, highlight: boolean): void {
    const component = this.getComponent(chainId);
    if (!component || !isPolymerComponent(component)) {
      if (!highlight) this.viewer.highlightLoci(null);
      return;
    }

    if (!highlight) {
      this.viewer.highlightLoci(null);
      this.dispatch(setComponentHovered({ instanceId: this.id, componentKey: chainId, hovered: false }));
      return;
    }

    const structure = this.viewer.getStructureFromRef(component.ref);
    if (!structure) return;

    const loci = structureToLoci(structure);
    this.viewer.highlightLoci(loci);
    this.dispatch(setComponentHovered({ instanceId: this.id, componentKey: chainId, hovered: true }));
  }

  highlightLigand(uniqueKey: string, highlight: boolean): void {
    const component = this.getComponent(uniqueKey);
    if (!component || !isLigandComponent(component)) {
      if (!highlight) this.viewer.highlightLoci(null);
      return;
    }

    if (!highlight) {
      this.viewer.highlightLoci(null);
      this.dispatch(setComponentHovered({ instanceId: this.id, componentKey: uniqueKey, hovered: false }));
      return;
    }

    const structure = this.viewer.getStructureFromRef(component.ref);
    if (!structure) return;

    const loci = structureToLoci(structure);
    this.viewer.highlightLoci(loci);
    this.dispatch(setComponentHovered({ instanceId: this.id, componentKey: uniqueKey, hovered: true }));
  }

  highlightResidue(chainId: string, authSeqId: number, highlight: boolean): void {
    if (!highlight) {
      this.viewer.highlightLoci(null);
      return;
    }

    const structure = this.viewer.getCurrentStructure();
    if (!structure) return;

    const query = buildResidueQuery(chainId, authSeqId);
    const loci = executeQuery(query, structure);
    this.viewer.highlightLoci(loci);
  }

  highlightResidueRange(chainId: string, startAuthSeqId: number, endAuthSeqId: number, highlight: boolean): void {
    if (!highlight) {
      this.viewer.highlightLoci(null);
      return;
    }

    const structure = this.viewer.getCurrentStructure();
    if (!structure) return;

    const query = buildResidueQuery(chainId, startAuthSeqId, endAuthSeqId);
    const loci = executeQuery(query, structure);
    this.viewer.highlightLoci(loci);
  }

  clearHighlight(): void {
    this.viewer.highlightLoci(null);
  }

  // ============================================================
  // Focus Operations
  // ============================================================

  focusChain(chainId: string): void {
    const component = this.getComponent(chainId);
    if (!component || !isPolymerComponent(component)) return;

    const structure = this.viewer.getStructureFromRef(component.ref);
    if (!structure) return;

    const loci = structureToLoci(structure);
    this.viewer.focusLoci(loci);
  }

  focusLigand(uniqueKey: string): void {
    const component = this.getComponent(uniqueKey);
    if (!component || !isLigandComponent(component)) return;

    const structure = this.viewer.getStructureFromRef(component.ref);
    if (!structure) return;

    const loci = structureToLoci(structure);
    this.viewer.focusLoci(loci);
    this.viewer.setFocusFromLoci(loci);
  }

  focusResidue(chainId: string, authSeqId: number): void {
    const structure = this.viewer.getCurrentStructure();
    if (!structure) return;

    const query = buildResidueQuery(chainId, authSeqId);
    const loci = executeQuery(query, structure);
    if (loci) this.viewer.focusLoci(loci);
  }

  focusResidueRange(chainId: string, startAuthSeqId: number, endAuthSeqId: number): void {
    const structure = this.viewer.getCurrentStructure();
    if (!structure) return;

    const query = buildResidueQuery(chainId, startAuthSeqId, endAuthSeqId);
    const loci = executeQuery(query, structure);
    if (loci) this.viewer.focusLoci(loci);
  }

  clearFocus(): void {
    this.viewer.clearFocus();
  }

  // ============================================================
  // Sequence Operations
  // ============================================================

  getObservedSequence(chainId: string): ObservedSequenceData | null {
    const structure = this.viewer.getCurrentStructure();
    if (!structure) return null;
    return extractObservedSequence(structure, chainId);
  }

  getSequenceData(chainId: string): SequenceData | null {
    const pdbId = this.loadedStructure;
    if (!pdbId) return null;

    const observed = this.getObservedSequence(chainId);
    if (!observed) return null;

    return {
      chainId,
      pdbId,
      sequence: observed.sequence,
      name: `${pdbId} Chain ${chainId}`,
      chainType: 'polymer',
    };
  }

  getAllChainIds(): string[] {
    return Object.entries(this.instanceState.components)
      .filter(([, c]) => isPolymerComponent(c))
      .map(([key]) => key)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }

  // ============================================================
  // Colorscheme Operations
  // ============================================================

  /**
   * Applies an overpaint colorscheme to the structure.
   * Groups residue selections by color to optimize Molstar overpaint layers.
   */
  async applyColorscheme(colorschemeId: string, colorings: ResidueColoring[]): Promise<void> {
    const plugin = this.viewer.ctx;
    if (!plugin || colorings.length === 0) return;

    const structure = this.viewer.getCurrentStructure();
    if (!structure) return;

    // Batch colorings by their color hex to reduce representation update overhead
    const colorGroups: Record<number, ResidueColoring[]> = {};
    for (const coloring of colorings) {
      if (!colorGroups[coloring.color]) colorGroups[coloring.color] = [];
      colorGroups[coloring.color].push(coloring);
    }

    const layers: { bundle: StructureElement.Bundle, color: Color }[] = [];

    for (const [colorValue, residues] of Object.entries(colorGroups)) {
      const color = Color(Number(colorValue));
      const lociList: StructureElement.Loci[] = [];

      for (const res of residues) {
        const query = buildResidueQuery(res.chainId, res.authSeqId);
        const loci = executeQuery(query, structure);
        if (loci && StructureElement.Loci.is(loci)) {
          lociList.push(loci);
        }
      }

      if (lociList.length > 0) {
        // Concatenate individual residue loci into a single mask for the color bundle
        const concatenatedLoci = Loci.concat(lociList) as StructureElement.Loci;
        layers.push({
          bundle: StructureElement.Bundle.fromLoci(concatenatedLoci),
          color
        });
      }
    }

    if (layers.length > 0) {
      // Apply the calculated overpaint layers to all active representations
      await plugin.managers.structure.component.eachRepresentation(repr => {
        plugin.managers.structure.component.overpaint.set(layers, repr);
      });
    }

    this.dispatch(setActiveColorscheme({ instanceId: this.id, colorschemeId }));
  }

  /**
   * Clears all overpaint layers and restores the default representation colors.
   */
  async restoreDefaultColors(): Promise<void> {
    const plugin = this.viewer.ctx;
    if (!plugin) return;

    await plugin.managers.structure.component.eachRepresentation(repr => {
      plugin.managers.structure.component.overpaint.clear(repr);
    });

    this.dispatch(setActiveColorscheme({ instanceId: this.id, colorschemeId: null }));
  }

  // ============================================================
  // Cleanup
  // ============================================================

  async clearCurrentStructure(): Promise<void> {
    this.viewer.clearFocus();
    await this.viewer.clear();
    this.dispatch(clearInstance(this.id));
  }

  dispose(): void {
    this.viewer.dispose();
  }
}