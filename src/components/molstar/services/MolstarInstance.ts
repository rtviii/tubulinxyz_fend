import { AppDispatch, RootState } from '@/store/store';
import { MolstarViewer } from '../core/MolstarViewer';
import { setStructureTransparency } from 'molstar/lib/mol-plugin-state/helpers/structure-transparency';
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
} from '../state/molstarInstancesSlice';
import { Structure, StructureElement } from 'molstar/lib/mol-model/structure';
import { Color } from 'molstar/lib/mol-util/color';
import { Mat4 } from 'molstar/lib/mol-math/linear-algebra';
import { StateTransforms } from 'molstar/lib/mol-plugin-state/transforms';
import { StateSelection } from 'molstar/lib/mol-state';
import { MolScriptBuilder as MS } from 'molstar/lib/mol-script/language/builder';
import { StateObjectRef } from 'molstar/lib/mol-state';
import { setSubtreeVisibility } from 'molstar/lib/mol-plugin/behavior/static/state';
import { STYLIZED_POSTPROCESSING } from '../rendering/postprocessing-config';
import { alignAndSuperpose } from 'molstar/lib/mol-model/structure/structure/util/superposition';
import { StructureSelectionQueries } from 'molstar/lib/mol-plugin-state/helpers/structure-selection-query';
import { StructureSelection, QueryContext } from 'molstar/lib/mol-model/structure';
import { setStructureOverpaint } from 'molstar/lib/mol-plugin-state/helpers/structure-overpaint';
import { OrderedSet } from 'molstar/lib/mol-data/int';
import { ResidueColoring } from '../coloring/types';
import { removeSequence } from '@/store/slices/sequence_registry';
import {
  getMolstarColorForFamily,
  getMolstarGhostColor,
} from '../colors/palette';
import { StructureProperties } from 'molstar/lib/mol-model/structure';

const ALIGNED_CHAIN_COLOR = Color(0xE57373);
const GHOST_ALPHA = 0.12;
const LIGAND_PROXIMITY_RADIUS = 8; // angstroms
const STRUCTURE_GHOST_TRANSPARENCY = 0.55;

export class MolstarInstance {
  constructor(
    public readonly id: MolstarInstanceId,
    public readonly viewer: MolstarViewer,
    private dispatch: AppDispatch,
    private getState: () => RootState
  ) { }

  // ============================================================
  // State Access
  // ============================================================

  private focusColorOverrideSetup = false;
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

  private getMonomerChainState(chainId: string) {
    return this.instanceState.monomerChainStates[chainId];
  }

  private getChainFamily(chainId: string): string | undefined {
    return this.instanceState.tubulinClassification?.[chainId];
  }

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
        renderer: { pickingAlphaThreshold: 0.1 },
      });
    }
  }

  async applyWindowMask(chainId: string, visibleAuthSeqIds: number[]): Promise<void> {
    console.log('[applyWindowMask] called', { chainId, visibleCount: visibleAuthSeqIds.length });

    const plugin = this.viewer.ctx;
    if (!plugin) return;

    const component = this.getComponent(chainId);
    if (!component || !isPolymerComponent(component)) return;

    const hierarchy = plugin.managers.structure.hierarchy.current;
    if (hierarchy.structures.length === 0) return;

    const chainComponents = hierarchy.structures[0].components.filter(
      c => c.cell.transform.ref === component.ref
    );
    if (chainComponents.length === 0) return;

    const structure = this.viewer.getCurrentStructure();
    if (!structure) return;

    const observed = extractObservedSequence(structure, chainId);
    if (!observed) return;

    const visibleSet = new Set(visibleAuthSeqIds);
    const outOfRange = observed.authSeqIds.filter(id => !visibleSet.has(id));

    if (outOfRange.length > 0) {
      await setStructureTransparency(
        plugin, chainComponents, 1,
        async (s) => executeQuery(buildMultiResidueQuery(chainId, outOfRange), s)
          ?? StructureElement.Loci.none(s)
      );
    }

    if (visibleAuthSeqIds.length > 0) {
      await setStructureTransparency(
        plugin, chainComponents, 0.75,
        async (s) => executeQuery(buildMultiResidueQuery(chainId, visibleAuthSeqIds), s)
          ?? StructureElement.Loci.none(s)
      );

      const focusLoci = executeQuery(buildMultiResidueQuery(chainId, visibleAuthSeqIds), structure);
      if (focusLoci) this.viewer.focusLoci(focusLoci);
    }
  }

  async clearWindowMask(chainId: string): Promise<void> {
    // Restores uniform ghost transparency across the whole chain.
    // Note: if an annotation colorscheme is active, its transparency punch-through
    // will be lost and applyColorscheme should be re-called after this.
    await this.applyGhostToChain(chainId);
  }
  // ============================================================
  // Repr Helpers -- find and update representation state nodes
  // ============================================================

  /**
   * Find all StructureRepresentation3D cells that are direct or indirect
   * children of a given component ref in the state tree.
   */
  private findReprCells(componentRef: string) {
    const plugin = this.viewer.ctx;
    if (!plugin) return [];
    return plugin.state.data.select(
      StateSelection.Generators
        .byRef(componentRef)
        .subtree()
        .withTransformer(StateTransforms.Representation.StructureRepresentation3D)
    );
  }




  async setStructureGhostColors(enabled: boolean): Promise<void> {
    const plugin = this.viewer.ctx;
    if (!plugin) return;

    const hierarchy = plugin.managers.structure.hierarchy.current;
    if (hierarchy.structures.length === 0) return;

    const components = this.instanceState.components;
    const builder = plugin.build();

    for (const [, component] of Object.entries(components)) {
      if (!isPolymerComponent(component)) continue;

      const family = this.getChainFamily(component.chainId);
      const isAlphaBeta = family === 'tubulin_alpha' || family === 'tubulin_beta';

      const color = (enabled && isAlphaBeta)
        ? getMolstarGhostColor(family)
        : getMolstarColorForFamily(family);

      const reprCells = this.findReprCells(component.ref);
      for (const cell of reprCells) {
        builder.to(cell.transform.ref).update(
          StateTransforms.Representation.StructureRepresentation3D,
          old => ({ ...old, colorTheme: { name: 'uniform', params: { value: color } } })
        );
      }
    }

    await builder.commit();

    // Now handle transparency per-component to avoid cross-contamination
    for (const [, component] of Object.entries(components)) {
      if (!isPolymerComponent(component)) continue;

      const family = this.getChainFamily(component.chainId);
      const isAlphaBeta = family === 'tubulin_alpha' || family === 'tubulin_beta';
      const transparency = (enabled && isAlphaBeta) ? STRUCTURE_GHOST_TRANSPARENCY : 0;

      const chainComponents = hierarchy.structures[0].components.filter(
        c => c.cell.transform.ref === component.ref
      );
      if (chainComponents.length === 0) continue;

      try {
        await setStructureTransparency(
          plugin,
          chainComponents,
          transparency,
          async (structure) => {
            const loci = executeQuery(buildChainQuery(component.chainId), structure);
            return loci ?? StructureElement.Loci.none(structure);
          }
        );
      } catch (err) {
        console.error(`[${this.id}] Failed to set transparency for ${component.chainId}:`, err);
      }
    }
  }
  /**
   * Apply ghost appearance (very low alpha, muted color) to the active chain's
   * representation when entering monomer view.
   */
  private async applyGhostToChain(chainId: string): Promise<void> {
    const plugin = this.viewer.ctx;
    if (!plugin) return;

    const component = this.getComponent(chainId);
    if (!component || !isPolymerComponent(component)) return;

    const family = this.getChainFamily(chainId);
    const ghostColor = getMolstarGhostColor(family);
    const reprCells = this.findReprCells(component.ref);
    if (reprCells.length === 0) return;

    const builder = plugin.build();
    for (const cell of reprCells) {
      builder.to(cell.transform.ref).update(
        StateTransforms.Representation.StructureRepresentation3D,
        old => ({ ...old, colorTheme: { name: 'uniform', params: { value: ghostColor } } })
      );
    }
    await builder.commit();

    const hierarchy = plugin.managers.structure.hierarchy.current;
    if (hierarchy.structures.length === 0) return;

    // Scope to only this chain's component -- prevents ligand textures being touched
    const chainComponents = hierarchy.structures[0].components.filter(
      c => c.cell.transform.ref === component.ref
    );
    if (chainComponents.length === 0) return;

    await setStructureTransparency(
      plugin,
      chainComponents,
      0.75,  // ta=0.25, safely above uPickingAlphaThreshold
      async (structure) => {
        const loci = executeQuery(buildChainQuery(chainId), structure);
        return loci ?? StructureElement.Loci.none(structure);
      }
    );
  }

  private async restoreChainAppearance(chainId: string): Promise<void> {
    const plugin = this.viewer.ctx;
    if (!plugin) return;

    const component = this.getComponent(chainId);
    if (!component || !isPolymerComponent(component)) return;

    const family = this.getChainFamily(chainId);
    const originalColor = getMolstarColorForFamily(family);
    const reprCells = this.findReprCells(component.ref);
    if (reprCells.length === 0) return;

    const builder = plugin.build();
    for (const cell of reprCells) {
      builder.to(cell.transform.ref).update(
        StateTransforms.Representation.StructureRepresentation3D,
        old => ({ ...old, colorTheme: { name: 'uniform', params: { value: originalColor } } })
      );
    }
    await builder.commit();

    const hierarchy = plugin.managers.structure.hierarchy.current;
    if (hierarchy.structures.length === 0) return;

    const chainComponents = hierarchy.structures[0].components.filter(
      c => c.cell.transform.ref === component.ref
    );
    if (chainComponents.length === 0) return;

    await setStructureTransparency(
      plugin,
      chainComponents,
      0,
      async (structure) => {
        const loci = executeQuery(buildChainQuery(chainId), structure);
        return loci ?? StructureElement.Loci.none(structure);
      }
    );
  }




  /**
   * Hide ligands that have no atoms within LIGAND_PROXIMITY_RADIUS of the
   * active chain. Shows all ligands that are nearby.
   *
   * Uses molstar's surroundings query to compute the neighborhood, then
   * checks each ligand's loci for intersection via OrderedSet index lookup.
   */
  private filterLigandsForChain(chainId: string): void {
    const structure = this.viewer.getCurrentStructure();
    if (!structure) return;

    const surroundingsExpr = buildSurroundingsQuery(
      buildChainQuery(chainId),
      LIGAND_PROXIMITY_RADIUS
    );
    const surroundingsLoci = executeQuery(surroundingsExpr, structure);

    // Build a fast-lookup map: unitId -> Set of UnitIndex values in neighborhood
    const nearbyByUnit = new Map<number, Set<number>>();
    if (surroundingsLoci) {
      for (const { unit, indices } of surroundingsLoci.elements) {
        const set = new Set<number>();
        OrderedSet.forEach(indices, idx => set.add(idx));
        nearbyByUnit.set(unit.id, set);
      }
    }

    for (const [key, component] of Object.entries(this.instanceState.components)) {
      if (!isLigandComponent(component)) continue;

      let isNear = false;

      if (nearbyByUnit.size > 0) {
        const ligandLoci = executeQuery(buildLigandQuery(component), structure);
        if (ligandLoci) {
          outer: for (const { unit, indices } of ligandLoci.elements) {
            const unitSet = nearbyByUnit.get(unit.id);
            if (!unitSet) continue;
            OrderedSet.forEach(indices, idx => {
              if (unitSet.has(idx)) isNear = true;
            });
            if (isNear) break outer;
          }
        }
      }

      this.viewer.setSubtreeVisibility(component.ref, isNear);
      this.dispatch(
        setComponentVisibility({
          instanceId: this.id,
          componentKey: key,
          visible: isNear,
        })
      );
    }
  }




  private setupFocusColorOverride(): void {
    if (this.focusColorOverrideSetup) return;
    const plugin = this.viewer.ctx;
    if (!plugin) return;
    this.focusColorOverrideSetup = true;

    plugin.managers.structure.focus.behaviors.current.subscribe(async (entry) => {
      if (!entry) return;
      // StructureFocusRepresentationBehavior doesn't await its own async work,
      // so we yield to let it finish building the SurrSel/SurrRepr nodes.
      await new Promise<void>(r => setTimeout(r, 50));
      await this.colorFocusSurroundings();
    });
  }

  private async colorFocusSurroundings(): Promise<void> {
    const plugin = this.viewer.ctx;
    if (!plugin) return;

    const hierarchy = plugin.managers.structure.hierarchy.current;
    if (hierarchy.structures.length === 0) return;

    // The focus behavior tags its surroundings selection component with this string.
    const surrComponents = hierarchy.structures[0].components.filter(c =>
      (c.cell.transform.tags ?? []).includes('structure-focus-surr-sel')
    );
    if (surrComponents.length === 0) return;

    const surrStructure = surrComponents[0].cell.obj?.data as Structure | undefined;
    if (!surrStructure) return;

    // Collect which chains ended up in the surroundings.
    const chainsInSurroundings = new Set<string>();
    for (const unit of surrStructure.units) {
      const loc = StructureElement.Location.create(surrStructure, unit, unit.elements[0]);
      chainsInSurroundings.add(StructureProperties.chain.auth_asym_id(loc));
    }

    // Overpaint each chain with its family color.
    for (const chainId of chainsInSurroundings) {
      const family = this.getChainFamily(chainId);
      const color = getMolstarColorForFamily(family);

      await setStructureOverpaint(
        plugin,
        surrComponents,
        color,
        async (structure) => {
          const loci = executeQuery(buildChainQuery(chainId), structure);
          return loci ?? StructureElement.Loci.none(structure);
        }
      );
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
        }
      );

      const components = this.extractComponentsFromPreset(pdbId.toUpperCase(), result);

      this.dispatch(
        setLoadedStructure({
          instanceId: this.id,
          pdbId: pdbId.toUpperCase(),
          structureRef: structureRef.ref,
          tubulinClassification: classification,  // stored for later use by ghost methods
        })
      );

      this.dispatch(registerComponents({ instanceId: this.id, components }));

      await this.applyStylizedLighting();
      this.setupFocusColorOverride();
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
        components.push({ type: 'polymer', pdbId, ref: (data as any).ref, chainId });
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

  async enterMonomerView(chainId: string): Promise<void> {
    const components = this.instanceState.components;

    // Hide all polymer chains except the target
    for (const [key, component] of Object.entries(components)) {
      if (isPolymerComponent(component)) {
        const shouldShow = key === chainId;
        this.viewer.setSubtreeVisibility(component.ref, shouldShow);
        this.dispatch(
          setComponentVisibility({ instanceId: this.id, componentKey: key, visible: shouldShow })
        );
      }
    }

    // Show/hide aligned structures per chain
    for (const [otherChainId, chainState] of Object.entries(this.instanceState.monomerChainStates)) {
      for (const aligned of Object.values(chainState.alignedStructures)) {
        const show = otherChainId === chainId && aligned.visible;
        this.viewer.setSubtreeVisibility(aligned.chainComponentRef, show);
      }
    }

    // Ghost the active chain's cartoon
    await this.applyGhostToChain(chainId);

    // Hide ligands that are geometrically far from this chain
    this.filterLigandsForChain(chainId);

    this.dispatch(setViewMode({ instanceId: this.id, viewMode: 'monomer', activeChainId: chainId }));

    this.focusChain(chainId);
  }

  async exitMonomerView(): Promise<void> {
    const previousChainId = this.activeMonomerChainId;

    // Restore ghost chain's original appearance before showing everything
    if (previousChainId) {
      await this.restoreChainAppearance(previousChainId);
    }

    // Show all components
    for (const [key, component] of Object.entries(this.instanceState.components)) {
      this.viewer.setSubtreeVisibility(component.ref, true);
      this.dispatch(
        setComponentVisibility({ instanceId: this.id, componentKey: key, visible: true })
      );
    }

    // Hide all aligned structures (they only belong in monomer view)
    for (const chainState of Object.values(this.instanceState.monomerChainStates)) {
      for (const aligned of Object.values(chainState.alignedStructures)) {
        this.viewer.setSubtreeVisibility(aligned.chainComponentRef, false);
      }
    }

    this.dispatch(setViewMode({ instanceId: this.id, viewMode: 'structure', activeChainId: null }));

    this.viewer.clearFocus();
  }

  async switchMonomerChain(newChainId: string): Promise<void> {
    const currentChainId = this.activeMonomerChainId;
    if (currentChainId === newChainId) return;

    // Restore the outgoing chain's appearance
    if (currentChainId) {
      await this.restoreChainAppearance(currentChainId);
    }

    const components = this.instanceState.components;

    for (const [key, component] of Object.entries(components)) {
      if (isPolymerComponent(component)) {
        const shouldShow = key === newChainId;
        this.viewer.setSubtreeVisibility(component.ref, shouldShow);
        this.dispatch(
          setComponentVisibility({ instanceId: this.id, componentKey: key, visible: shouldShow })
        );
      }
    }

    // Aligned structures
    if (currentChainId) {
      const oldState = this.getMonomerChainState(currentChainId);
      if (oldState) {
        for (const aligned of Object.values(oldState.alignedStructures)) {
          this.viewer.setSubtreeVisibility(aligned.chainComponentRef, false);
        }
      }
    }
    const newState = this.getMonomerChainState(newChainId);
    if (newState) {
      for (const aligned of Object.values(newState.alignedStructures)) {
        if (aligned.visible) this.viewer.setSubtreeVisibility(aligned.chainComponentRef, true);
      }
    }

    // Ghost the incoming chain
    await this.applyGhostToChain(newChainId);
    this.filterLigandsForChain(newChainId);

    this.dispatch(setViewMode({ instanceId: this.id, viewMode: 'monomer', activeChainId: newChainId }));
    this.focusChain(newChainId);
  }

  // ============================================================
  // The rest of the methods are unchanged from the original.
  // (aligned structure ops, visibility, highlight, focus,
  //  colorscheme, sequence, cleanup)
  // ============================================================

  async loadAlignedStructure(
    targetChainId: string,
    sourcePdbId: string,
    sourceChainId: string
  ): Promise<string | null> {
    const plugin = this.viewer.ctx;
    if (!plugin) return null;

    const alignedId = `${sourcePdbId}_${sourceChainId}_on_${targetChainId}`;

    try {
      const url = `https://models.rcsb.org/${sourcePdbId.toUpperCase()}.bcif`;
      const data = await plugin.builders.data.download({ url, isBinary: true, label: sourcePdbId });
      const trajectory = await plugin.builders.structure.parseTrajectory(data, 'mmcif');
      const model = await plugin.builders.structure.createModel(trajectory);
      const fullStructure = await plugin.builders.structure.createStructure(model);

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

      if (!chainComponent) throw new Error(`Chain ${sourceChainId} not found in ${sourcePdbId}`);

      const targetComponent = this.getComponent(targetChainId);
      if (!targetComponent || !isPolymerComponent(targetComponent)) {
        throw new Error(`Target chain ${targetChainId} not found`);
      }

      const targetStructure = this.viewer.getStructureFromRef(targetComponent.ref);
      const mobileStructure = chainComponent.data;
      if (!targetStructure || !mobileStructure) throw new Error('Could not get structure data');

      const { query: traceQuery } = StructureSelectionQueries.trace;
      const targetTraceLoci = StructureSelection.toLociWithSourceUnits(
        traceQuery(new QueryContext(targetStructure))
      );
      const mobileTraceLoci = StructureSelection.toLociWithSourceUnits(
        traceQuery(new QueryContext(mobileStructure))
      );

      const results = alignAndSuperpose([targetTraceLoci, mobileTraceLoci]);
      let rmsd: number | null = null;

      if (results.length > 0 && !Number.isNaN(results[0].rmsd)) {
        rmsd = results[0].rmsd;
        await plugin
          .build()
          .to(chainComponent)
          .apply(StateTransforms.Model.TransformStructureConformation, {
            transform: { name: 'matrix' as const, params: { data: results[0].bTransform, transpose: false } },
          })
          .commit();
      }

      await plugin.builders.structure.representation.addRepresentation(chainComponent, {
        type: 'cartoon',
        color: 'uniform',
        colorParams: { value: ALIGNED_CHAIN_COLOR },
      });

      const shouldShow =
        this.viewMode === 'monomer' && this.activeMonomerChainId === targetChainId;
      this.viewer.setSubtreeVisibility(chainComponent.ref, shouldShow);

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

      this.dispatch(addAlignedStructure({ instanceId: this.id, targetChainId, alignedStructure }));
      return alignedId;
    } catch (error) {
      console.error(`[${this.id}] Failed to load aligned structure:`, error);
      return null;
    }
  }

  async removeAlignedStructureById(targetChainId: string, alignedStructureId: string): Promise<void> {
    const plugin = this.viewer.ctx;
    if (!plugin) return;

    const chainState = this.getMonomerChainState(targetChainId);
    const aligned = chainState?.alignedStructures[alignedStructureId];
    if (!aligned) return;

    await plugin.build().delete(aligned.parentRef).commit();
    this.dispatch(removeSequence(`${aligned.sourcePdbId}_${aligned.sourceChainId}`));
    this.dispatch(removeAlignedStructure({ instanceId: this.id, targetChainId, alignedStructureId }));
  }

  setAlignedStructureVisible(targetChainId: string, alignedStructureId: string, visible: boolean): void {
    const aligned = this.getMonomerChainState(targetChainId)?.alignedStructures[alignedStructureId];
    if (!aligned) return;

    const shouldReallyShow =
      visible && this.viewMode === 'monomer' && this.activeMonomerChainId === targetChainId;
    this.viewer.setSubtreeVisibility(aligned.chainComponentRef, shouldReallyShow);

    this.dispatch(
      setAlignedStructureVisibility({ instanceId: this.id, targetChainId, alignedStructureId, visible })
    );
  }

  setChainVisibility(chainId: string, visible: boolean): void {
    const component = this.getComponent(chainId);
    if (!component || !isPolymerComponent(component)) return;
    this.viewer.setSubtreeVisibility(component.ref, visible);
    this.dispatch(setComponentVisibility({ instanceId: this.id, componentKey: chainId, visible }));
  }

  setLigandVisibility(uniqueKey: string, visible: boolean): void {
    const component = this.getComponent(uniqueKey);
    if (!component || !isLigandComponent(component)) return;
    this.viewer.setSubtreeVisibility(component.ref, visible);
    this.dispatch(setComponentVisibility({ instanceId: this.id, componentKey: uniqueKey, visible }));
  }

  setAllChainsVisibility(visible: boolean): void {
    for (const [key, component] of Object.entries(this.instanceState.components)) {
      if (isPolymerComponent(component)) this.setChainVisibility(key, visible);
    }
  }

  isolateChain(chainId: string, keepLigands = true): void {
    for (const [key, component] of Object.entries(this.instanceState.components)) {
      if (isPolymerComponent(component)) this.setChainVisibility(key, key === chainId);
      else if (isLigandComponent(component)) this.setLigandVisibility(key, keepLigands);
    }
  }

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
    this.viewer.highlightLoci(structureToLoci(structure));
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
    this.viewer.highlightLoci(structureToLoci(structure));
    this.dispatch(setComponentHovered({ instanceId: this.id, componentKey: uniqueKey, hovered: true }));
  }

  highlightResidue(chainId: string, authSeqId: number, highlight: boolean): void {
    if (!highlight) { this.viewer.highlightLoci(null); return; }
    const structure = this.viewer.getCurrentStructure();
    if (!structure) return;
    const loci = executeQuery(buildResidueQuery(chainId, authSeqId), structure);
    this.viewer.highlightLoci(loci);
  }

  highlightResidueRange(chainId: string, start: number, end: number, highlight: boolean): void {
    if (!highlight) { this.viewer.highlightLoci(null); return; }
    const structure = this.viewer.getCurrentStructure();
    if (!structure) return;
    const loci = executeQuery(buildResidueQuery(chainId, start, end), structure);
    this.viewer.highlightLoci(loci);
  }

  clearHighlight(): void {
    this.viewer.highlightLoci(null);
  }

  focusChain(chainId: string): void {
    const component = this.getComponent(chainId);
    if (!component || !isPolymerComponent(component)) return;
    const structure = this.viewer.getStructureFromRef(component.ref);
    if (!structure) return;
    this.viewer.focusLoci(structureToLoci(structure));
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
    const loci = executeQuery(buildResidueQuery(chainId, authSeqId), structure);
    if (loci) this.viewer.focusLoci(loci);
  }

  triggerNeighborhoodFocus(chainId: string, authSeqId: number): void {
    const structure = this.viewer.getCurrentStructure();
    if (!structure) return;
    const loci = executeQuery(buildResidueQuery(chainId, authSeqId), structure);
    if (!loci) return;
    this.viewer.setFocusFromLoci(loci);
    this.viewer.focusLoci(loci);
  }

  focusResidueRange(chainId: string, start: number, end: number): void {
    const structure = this.viewer.getCurrentStructure();
    if (!structure) return;
    const loci = executeQuery(buildResidueQuery(chainId, start, end), structure);
    if (loci) this.viewer.focusLoci(loci);
  }

  clearFocus(): void {
    this.viewer.clearFocus();
  }

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
    return { chainId, pdbId, sequence: observed.sequence, name: `${pdbId} Chain ${chainId}`, chainType: 'polymer' };
  }

  getAllChainIds(): string[] {
    return Object.entries(this.instanceState.components)
      .filter(([, c]) => isPolymerComponent(c))
      .map(([key]) => key)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }

  async applyColorscheme(colorschemeId: string, colorings: ResidueColoring[]): Promise<void> {
    const plugin = this.viewer.ctx;
    if (!plugin) return;

    await this.restoreDefaultColors();

    if (colorings.length === 0) {
      this.dispatch(setActiveColorscheme({ instanceId: this.id, colorschemeId: null }));
      return;
    }

    const colorChainGroups = new Map<string, { color: Color; chainId: string; authSeqIds: number[] }>();
    for (const coloring of colorings) {
      const key = `${coloring.color}-${coloring.chainId}`;
      if (!colorChainGroups.has(key)) {
        colorChainGroups.set(key, { color: coloring.color, chainId: coloring.chainId, authSeqIds: [] });
      }
      colorChainGroups.get(key)!.authSeqIds.push(coloring.authSeqId);
    }

    const hierarchy = plugin.managers.structure.hierarchy.current;
    if (hierarchy.structures.length === 0) return;
    const structureRef = hierarchy.structures[0];

    for (const { color, chainId, authSeqIds } of colorChainGroups.values()) {
      const lociGetter = async (structure: Structure) => {
        const loci = executeQuery(buildMultiResidueQuery(chainId, authSeqIds), structure);
        return loci ?? StructureElement.Loci.none(structure);
      };

      // Apply color overpaint
      try {
        await setStructureOverpaint(plugin, structureRef.components, color, lociGetter);
      } catch (err) {
        console.error(`[${this.id}] Failed to apply overpaint:`, err);
      }

      // Punch through the ghost transparency for these residues so they appear fully opaque
      try {
        await setStructureTransparency(plugin, structureRef.components, 0, lociGetter);
      } catch (err) {
        console.error(`[${this.id}] Failed to clear transparency for annotated residues:`, err);
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

    // Clear all overpaint
    try {
      await setStructureOverpaint(
        plugin,
        structureRef.components,
        -1 as any,
        async (structure) => Structure.toStructureElementLoci(structure)
      );
    } catch (err) {
      console.error(`[${this.id}] Failed to clear overpaint:`, err);
    }

    // If we're in monomer view, re-apply ghost transparency to the active chain
    // so that residues that had transparency=0 punched through return to ghost state
    const activeChainId = this.activeMonomerChainId;
    if (this.viewMode === 'monomer' && activeChainId) {
      const activeComponent = this.getComponent(activeChainId);
      if (activeComponent && isPolymerComponent(activeComponent)) {
        const chainComponents = hierarchy.structures[0].components.filter(
          c => c.cell.transform.ref === activeComponent.ref
        );
        if (chainComponents.length > 0) {
          try {
            await setStructureTransparency(
              plugin,
              chainComponents,
              0.75,
              async (structure) => {
                const loci = executeQuery(buildChainQuery(activeChainId), structure);
                return loci ?? StructureElement.Loci.none(structure);
              }
            );
          } catch (err) {
            console.error(`[${this.id}] Failed to restore ghost transparency:`, err);
          }
        }
      }
    }

    this.dispatch(setActiveColorscheme({ instanceId: this.id, colorschemeId: null }));
  }

  async colorResidues(chainId: string, authSeqIds: number[], color: Color): Promise<void> {
    await this.applyColorscheme('custom', authSeqIds.map(authSeqId => ({ chainId, authSeqId, color })));
  }

  async clearCurrentStructure(): Promise<void> {
    this.viewer.clearFocus();
    await this.viewer.clear();
    this.dispatch(clearInstance(this.id));
  }

  dispose(): void {
    this.viewer.dispose();
  }
}