import { AppDispatch, RootState } from '@/store/store';
import { MolstarViewer } from '../core/MolstarViewer';
import {
  MolstarInstanceId,
  ViewMode,
  Component,
  PolymerComponent,
  LigandComponent,
  AlignedStructure,
  TubulinClassification,
  isPolymerComponent,
  isLigandComponent,
  ObservedSequenceData,
  SequenceData,
} from '../core/types';
import {
  buildChainQuery,
  buildResidueQuery,
  buildLigandQuery,
  buildSurroundingsQuery,
  executeQuery,
  structureToLoci,
  extractObservedSequence,
  buildMultiResidueQuery,
} from '../core/queries';
import {
  setLoadedStructure,
  registerComponents,
  setComponentVisibility,
  setComponentHovered,
  setActiveColorscheme,
  setViewMode,
  addAlignedStructure,
  removeAlignedStructure,
  setAlignedStructureVisibility,
  clearInstance,
  getComponentKey,
} from '../state/molstarInstancesSlice';
import { Structure, StructureElement } from 'molstar/lib/mol-model/structure';
import { Loci } from 'molstar/lib/mol-model/loci';
import { Color } from 'molstar/lib/mol-util/color';
import { Mat4 } from 'molstar/lib/mol-math/linear-algebra';
import { superpose } from 'molstar/lib/mol-model/structure/structure/util/superposition';
import { StateTransforms } from 'molstar/lib/mol-plugin-state/transforms';
import { MolScriptBuilder as MS } from 'molstar/lib/mol-script/language/builder';
import { StateObjectRef } from 'molstar/lib/mol-state';
import { setSubtreeVisibility } from 'molstar/lib/mol-plugin/behavior/static/state';
import { STYLIZED_POSTPROCESSING } from '../rendering/postprocessing-config';
import { alignAndSuperpose } from 'molstar/lib/mol-model/structure/structure/util/superposition';
import { StructureSelectionQueries } from 'molstar/lib/mol-plugin-state/helpers/structure-selection-query';
import { StructureSelection, QueryContext } from 'molstar/lib/mol-model/structure';
import { setStructureOverpaint } from 'molstar/lib/mol-plugin-state/helpers/structure-overpaint';

import { ResidueColoring } from '../coloring/types';
import { removeSequence } from '@/store/slices/sequence_registry';

const ALIGNED_CHAIN_COLOR = Color(0xE57373); // reddish for aligned structures

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

  private get viewMode(): ViewMode {
    return this.instanceState.viewMode;
  }

  private get activeMonomerChainId(): string | null {
    return this.instanceState.activeMonomerChainId;
  }

  private getComponent(key: string): Component | undefined {
    return this.instanceState.components[key];
  }

  private getComponentState(key: string) {
    return this.instanceState.componentStates[key];
  }

  private getMonomerChainState(chainId: string) {
    return this.instanceState.monomerChainStates[chainId];
  }

  /**
   * Internal helper to apply stylized lighting and post-processing.
   */
  private async applyStylizedLighting() {
    const plugin = this.viewer.ctx;
    if (!plugin) return;

    plugin.managers.structure.component.setOptions({
      ...plugin.managers.structure.component.state.options,
      ignoreLight: true,
    });

    if (plugin.canvas3d) {
      plugin.canvas3d.setProps({
        postprocessing: STYLIZED_POSTPROCESSING,
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

      const result = await this.viewer.ctx.builders.structure.representation.applyPreset(
        structureRef,
        'tubulin-split-preset-computed-res',
        {
          pdbId: pdbId.toUpperCase(),
          tubulinClassification: classification,
          computedResidues: [],
        }
      );

      const components = this.extractComponentsFromPreset(pdbId.toUpperCase(), result);

      this.dispatch(
        setLoadedStructure({
          instanceId: this.id,
          pdbId: pdbId.toUpperCase(),
          structureRef: structureRef.ref,
        })
      );

      this.dispatch(
        registerComponents({
          instanceId: this.id,
          components,
        })
      );

      await this.applyStylizedLighting();
      return true;
    } catch (error) {
      console.error(`[${this.id}] Failed to load structure:`, error);
      return false;
    }
  }

  private extractComponentsFromPreset(pdbId: string, presetResult: any): Component[] {
    const components: Component[] = [];
    const { objects_polymer, objects_ligand } = presetResult || {};

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
  // View Mode Switching
  // ============================================================

  /**
   * Enter monomer view for a specific chain.
   * Hides all other polymers, keeps ligands visible.
   */
  enterMonomerView(chainId: string): void {
    const components = this.instanceState.components;

    // Hide all polymers except the target chain
    for (const [key, component] of Object.entries(components)) {
      if (isPolymerComponent(component)) {
        const shouldShow = key === chainId;
        this.viewer.setSubtreeVisibility(component.ref, shouldShow);
        this.dispatch(
          setComponentVisibility({
            instanceId: this.id,
            componentKey: key,
            visible: shouldShow,
          })
        );
      }
      // Ligands stay visible
    }

    // Show aligned structures for this chain
    const chainState = this.getMonomerChainState(chainId);
    if (chainState) {
      for (const aligned of Object.values(chainState.alignedStructures)) {
        if (aligned.visible) {
          this.viewer.setSubtreeVisibility(aligned.chainComponentRef, true);
        }
      }
    }

    // Hide aligned structures for other chains
    for (const [otherChainId, otherChainState] of Object.entries(this.instanceState.monomerChainStates)) {
      if (otherChainId !== chainId) {
        for (const aligned of Object.values(otherChainState.alignedStructures)) {
          this.viewer.setSubtreeVisibility(aligned.chainComponentRef, false);
        }
      }
    }

    this.dispatch(
      setViewMode({
        instanceId: this.id,
        viewMode: 'monomer',
        activeChainId: chainId,
      })
    );

    // Focus on the chain
    this.focusChain(chainId);
  }

  /**
   * Exit monomer view, return to structure view.
   * Shows all polymers and ligands.
   */
  exitMonomerView(): void {
    const components = this.instanceState.components;

    // Show all components
    for (const [key, component] of Object.entries(components)) {
      this.viewer.setSubtreeVisibility(component.ref, true);
      this.dispatch(
        setComponentVisibility({
          instanceId: this.id,
          componentKey: key,
          visible: true,
        })
      );
    }

    // Hide all aligned structures (they only show in monomer view)
    for (const chainState of Object.values(this.instanceState.monomerChainStates)) {
      for (const aligned of Object.values(chainState.alignedStructures)) {
        this.viewer.setSubtreeVisibility(aligned.chainComponentRef, false);
      }
    }

    this.dispatch(
      setViewMode({
        instanceId: this.id,
        viewMode: 'structure',
        activeChainId: null,
      })
    );

    // Reset camera to show full structure
    this.viewer.clearFocus();
  }

  /**
   * Switch to a different chain within monomer view.
   */
  switchMonomerChain(newChainId: string): void {
    const currentChainId = this.activeMonomerChainId;
    if (currentChainId === newChainId) return;

    const components = this.instanceState.components;

    // Hide current chain, show new chain
    for (const [key, component] of Object.entries(components)) {
      if (isPolymerComponent(component)) {
        const shouldShow = key === newChainId;
        this.viewer.setSubtreeVisibility(component.ref, shouldShow);
        this.dispatch(
          setComponentVisibility({
            instanceId: this.id,
            componentKey: key,
            visible: shouldShow,
          })
        );
      }
    }

    // Hide aligned structures for old chain
    if (currentChainId) {
      const oldChainState = this.getMonomerChainState(currentChainId);
      if (oldChainState) {
        for (const aligned of Object.values(oldChainState.alignedStructures)) {
          this.viewer.setSubtreeVisibility(aligned.chainComponentRef, false);
        }
      }
    }

    // Show aligned structures for new chain
    const newChainState = this.getMonomerChainState(newChainId);
    if (newChainState) {
      for (const aligned of Object.values(newChainState.alignedStructures)) {
        if (aligned.visible) {
          this.viewer.setSubtreeVisibility(aligned.chainComponentRef, true);
        }
      }
    }

    this.dispatch(
      setViewMode({
        instanceId: this.id,
        viewMode: 'monomer',
        activeChainId: newChainId,
      })
    );

    this.focusChain(newChainId);
  }

  // ============================================================
  // Aligned Structure Operations
  // ============================================================

  /**
   * Load an external structure, extract a chain, align it to the target chain.
   */
  async loadAlignedStructure(
    targetChainId: string,
    sourcePdbId: string,
    sourceChainId: string
  ): Promise<string | null> {
    const plugin = this.viewer.ctx;
    if (!plugin) return null;

    const alignedId = `${sourcePdbId}_${sourceChainId}_on_${targetChainId}`;

    try {
      // 1. Load the external structure (no representations yet)
      const url = `https://models.rcsb.org/${sourcePdbId.toUpperCase()}.bcif`;
      const data = await plugin.builders.data.download({ url, isBinary: true, label: sourcePdbId });
      const trajectory = await plugin.builders.structure.parseTrajectory(data, 'mmcif');
      const model = await plugin.builders.structure.createModel(trajectory);
      const fullStructure = await plugin.builders.structure.createStructure(model);

      // 2. Create chain-only component from the external structure
      const structureCell = StateObjectRef.resolveAndCheck(plugin.state.data, fullStructure);
      if (!structureCell) throw new Error('Could not resolve structure cell');

      const chainComponent = await plugin.builders.structure.tryCreateComponentFromExpression(
        structureCell,
        MS.struct.generator.atomGroups({
          'chain-test': MS.core.rel.eq([MS.struct.atomProperty.macromolecular.auth_asym_id(), sourceChainId]),
        }),
        `aligned_${alignedId}`,
        { label: `${sourcePdbId} Chain ${sourceChainId}` }
      );

      if (!chainComponent) {
        throw new Error(`Chain ${sourceChainId} not found in ${sourcePdbId}`);
      }

      // 3. Get reference chain structure (our target)
      const targetComponent = this.getComponent(targetChainId);
      if (!targetComponent || !isPolymerComponent(targetComponent)) {
        throw new Error(`Target chain ${targetChainId} not found`);
      }

      const targetStructure = this.viewer.getStructureFromRef(targetComponent.ref);
      const mobileStructure = chainComponent.data;

      if (!targetStructure || !mobileStructure) {
        throw new Error('Could not get structure data for alignment');
      }

      // 4. Compute alignment transform
      const { query: traceQuery } = StructureSelectionQueries.trace;

      const targetTraceLoci = StructureSelection.toLociWithSourceUnits(
        traceQuery(new QueryContext(targetStructure))
      );
      const mobileTraceLoci = StructureSelection.toLociWithSourceUnits(
        traceQuery(new QueryContext(mobileStructure))
      );

      // 5. Compute alignment with sequence alignment (not naive superpose)
      const results = alignAndSuperpose([targetTraceLoci, mobileTraceLoci]);

      let rmsd: number | null = null;
      if (results.length > 0 && !Number.isNaN(results[0].rmsd)) {
        rmsd = results[0].rmsd;
        const transform = results[0].bTransform;

        // Apply transform to the chain component
        await plugin
          .build()
          .to(chainComponent)
          .apply(StateTransforms.Model.TransformStructureConformation, {
            transform: { name: 'matrix' as const, params: { data: transform, transpose: false } },
          })
          .commit();

        console.log(`[${this.id}] Aligned ${sourcePdbId}:${sourceChainId} to ${targetChainId}, RMSD: ${rmsd.toFixed(2)}, alignment score: ${results[0].alignmentScore}`);
      } else {
        console.warn(`[${this.id}] Could not compute alignment`);
      }
      // 6. Add representation to the aligned chain
      await plugin.builders.structure.representation.addRepresentation(chainComponent, {
        type: 'cartoon',
        color: 'uniform',
        colorParams: { value: ALIGNED_CHAIN_COLOR },
      });

      // 7. Set visibility based on current view mode
      const shouldShow = this.viewMode === 'monomer' && this.activeMonomerChainId === targetChainId;
      this.viewer.setSubtreeVisibility(chainComponent.ref, shouldShow);

      // 8. Register in Redux
      const alignedStructure: AlignedStructure = {
        id: alignedId,
        sourcePdbId: sourcePdbId.toUpperCase(),
        sourceChainId,
        targetChainId,
        parentRef: fullStructure.ref,
        chainComponentRef: chainComponent.ref,
        visible: true,
        rmsd,
      };

      this.dispatch(
        addAlignedStructure({
          instanceId: this.id,
          targetChainId,
          alignedStructure,
        })
      );

      return alignedId;
    } catch (error) {
      console.error(`[${this.id}] Failed to load aligned structure:`, error);
      return null;
    }
  }

  /**
   * Remove an aligned structure.
   */
  async removeAlignedStructureById(targetChainId: string, alignedStructureId: string): Promise<void> {
    const plugin = this.viewer.ctx;
    if (!plugin) return;

    const chainState = this.getMonomerChainState(targetChainId);
    const aligned = chainState?.alignedStructures[alignedStructureId];
    if (!aligned) return;

    // 1. Remove from Molstar state tree
    await plugin.build().delete(aligned.parentRef).commit();

    // 2. Sync with Sequence Registry
    // We construct the ID based on the source structure and chain
    const sequenceId = `${aligned.sourcePdbId}_${aligned.sourceChainId}`;
    this.dispatch(removeSequence(sequenceId));

    // 3. Remove from instancesSlice
    this.dispatch(
      removeAlignedStructure({
        instanceId: this.id,
        targetChainId,
        alignedStructureId,
      })
    );
  }

  /**
   * Toggle visibility of an aligned structure.
   */
  setAlignedStructureVisible(targetChainId: string, alignedStructureId: string, visible: boolean): void {
    const chainState = this.getMonomerChainState(targetChainId);
    const aligned = chainState?.alignedStructures[alignedStructureId];
    if (!aligned) return;

    // Only actually show if we're in monomer view for this chain
    const shouldReallyShow = visible && this.viewMode === 'monomer' && this.activeMonomerChainId === targetChainId;
    this.viewer.setSubtreeVisibility(aligned.chainComponentRef, shouldReallyShow);

    this.dispatch(
      setAlignedStructureVisibility({
        instanceId: this.id,
        targetChainId,
        alignedStructureId,
        visible,
      })
    );
  }

  // ============================================================
  // Visibility Operations
  // ============================================================

  setChainVisibility(chainId: string, visible: boolean): void {
    const component = this.getComponent(chainId);
    if (!component || !isPolymerComponent(component)) return;

    this.viewer.setSubtreeVisibility(component.ref, visible);
    this.dispatch(
      setComponentVisibility({
        instanceId: this.id,
        componentKey: chainId,
        visible,
      })
    );
  }

  setLigandVisibility(uniqueKey: string, visible: boolean): void {
    const component = this.getComponent(uniqueKey);
    if (!component || !isLigandComponent(component)) return;

    this.viewer.setSubtreeVisibility(component.ref, visible);
    this.dispatch(
      setComponentVisibility({
        instanceId: this.id,
        componentKey: uniqueKey,
        visible,
      })
    );
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

  // In src/components/molstar/services/MolstarInstance.ts
  // Replace the Colorscheme Operations section:

  // ============================================================
  // Colorscheme Operations
  // ============================================================

  // In the Colorscheme Operations section of MolstarInstance.ts
  // Replace the entire applyColorscheme method:

  // In MolstarInstance.ts, replace the applyColorscheme method:

  // Replace the Colorscheme Operations section:

  // ============================================================
  // Colorscheme Operations
  // ============================================================

  // src/components/molstar/services/MolstarInstance.ts

  async applyColorscheme(colorschemeId: string, colorings: ResidueColoring[]): Promise<void> {
    const plugin = this.viewer.ctx;
    if (!plugin) return;

    // 1. ALWAYS clear existing overpaint first to ensure we aren't "stacking" colors
    // This is the step that was likely missing, causing old highlights to persist
    await this.restoreDefaultColors();

    if (colorings.length === 0) {
      this.dispatch(setActiveColorscheme({ instanceId: this.id, colorschemeId: null }));
      return;
    }

    // 2. Group colorings by color AND chain for batch processing
    const colorChainGroups = new Map<string, { color: Color; chainId: string; authSeqIds: number[] }>();

    for (const coloring of colorings) {
      const key = `${coloring.color}-${coloring.chainId}`;
      if (!colorChainGroups.has(key)) {
        colorChainGroups.set(key, {
          color: coloring.color,
          chainId: coloring.chainId,
          authSeqIds: [],
        });
      }
      colorChainGroups.get(key)!.authSeqIds.push(coloring.authSeqId);
    }

    const hierarchy = plugin.managers.structure.hierarchy.current;
    if (hierarchy.structures.length === 0) return;
    const structureRef = hierarchy.structures[0];

    // 3. Apply the current set of active color groups
    for (const { color, chainId, authSeqIds } of colorChainGroups.values()) {
      const lociGetter = async (structure: Structure) => {
        const query = buildMultiResidueQuery(chainId, authSeqIds);
        const loci = executeQuery(query, structure);
        return loci ?? StructureElement.Loci.none(structure);
      };

      try {
        await setStructureOverpaint(
          plugin,
          structureRef.components,
          color,
          lociGetter
        );
      } catch (err) {
        console.error(`[${this.id}] Failed to apply overpaint:`, err);
      }
    }

    this.dispatch(setActiveColorscheme({ instanceId: this.id, colorschemeId }));
  }

  async restoreDefaultColors(): Promise<void> {
    const plugin = this.viewer.ctx;
    if (!plugin) return;

    const hierarchy = plugin.managers.structure.hierarchy.current;
    if (hierarchy.structures.length === 0) return;

    const structureRef = hierarchy.structures[0];

    // Clear overpaint by passing -1 as color
    const lociGetter = async (structure: Structure) => {
      return Structure.toStructureElementLoci(structure);
    };

    try {
      await setStructureOverpaint(
        plugin,
        structureRef.components,
        -1 as any,
        lociGetter
      );
    } catch (err) {
      console.error(`[${this.id}] Failed to clear overpaint:`, err);
    }

    this.dispatch(setActiveColorscheme({ instanceId: this.id, colorschemeId: null }));
  }


  /**
   * Color specific residues by auth_seq_id with a single color.
   * Simpler API for binding site highlighting.
   */
  async colorResidues(chainId: string, authSeqIds: number[], color: Color): Promise<void> {
    const colorings: ResidueColoring[] = authSeqIds.map(authSeqId => ({
      chainId,
      authSeqId,
      color,
    }));
    await this.applyColorscheme('custom', colorings);
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