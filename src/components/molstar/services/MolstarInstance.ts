import { AppDispatch, RootState } from '@/store/store';
import { MolstarViewer } from '../core/MolstarViewer';
import { setStructureTransparency } from 'molstar/lib/mol-plugin-state/helpers/structure-transparency';
import {  getMolstarLigandColor } from '../colors/palette';
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
  setGhostMode,
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

import { LabelManager } from '../labels/LabelManager';
import { formatFamilyShort } from '@/lib/formatters';

const ALIGNED_CHAIN_COLOR = Color(0xE57373);
const GHOST_ALPHA = 0.12;
const LIGAND_PROXIMITY_RADIUS = 8; // angstroms
const STRUCTURE_GHOST_TRANSPARENCY = 0.55;

export class MolstarInstance {
  // Track active window mask so we can re-apply after colorscheme changes
  private activeWindowMask: {
    chainId: string;
    visibleAuthSeqIds: number[];
    pinnedAuthSeqIds: number[];
  } | null = null;


  private labelManager: LabelManager | null = null;
  private activeAlignedWindowMasks: Map<string, {
    targetChainId: string;
    alignedStructureId: string;
    sourceChainId: string;
    visibleAuthSeqIds: number[];
    pinnedAuthSeqIds: number[];
  }> = new Map();

  // In-flight `loadAlignedStructure` calls keyed by alignedId. Concurrent callers
  // for the same id join the same promise instead of racing. The Redux-based
  // `selectIsChainAligned` guards at call sites don't help here: the second call
  // can fire before the first call's `addAlignedStructure` dispatch lands,
  // producing two parallel Molstar subtrees and an orphan cartoon that
  // `setAlignedStructureVisible` can't reach (it only holds the ref of the most
  // recent Redux-registered subtree).
  private inFlightAlignedLoads: Map<string, Promise<string | null>> = new Map();

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
  private ensureLabelManager(): LabelManager | null {
    if (this.labelManager) return this.labelManager;
    const plugin = this.viewer.ctx;
    if (!plugin) return null;
    this.labelManager = new LabelManager(plugin);
    return this.labelManager;
  }


removeExplorerLabel(key: string): void {
  this.labelManager?.removePersistent(key);
}

removeAllExplorerLabels(): void {
  this.labelManager?.removeAllPersistent();
}
/**
 * Show a 3D label on the component identified by key (chainId for polymers,
 * uniqueKey for ligands). Call with null to hide.
 */
// In MolstarInstance.ts — replace the label-related methods:

async showComponentLabel(componentKey: string | null): Promise<void> {
  const mgr = this.ensureLabelManager();
  if (!mgr) return;

  if (!componentKey) {
    mgr.hideHover();
    return;
  }

  const component = this.getComponent(componentKey);
  if (!component) { mgr.hideHover(); return; }

  const structure = this.viewer.getStructureFromRef(component.ref);
  if (!structure) { mgr.hideHover(); return; }

  const loci = structureToLoci(structure);
  const text = this.componentLabelText(componentKey, component);
  const color = this.componentColor(component);
  await mgr.showHover(loci, text, color);
}

async addComponentExplorerLabel(componentKey: string, labelKey: string, text: string): Promise<void> {
  const mgr = this.ensureLabelManager();
  if (!mgr) return;

  const component = this.getComponent(componentKey);
  if (!component) return;

  const structure = this.viewer.getStructureFromRef(component.ref);
  if (!structure) return;

  const loci = structureToLoci(structure);
  const color = this.componentColor(component);
  await mgr.addPersistent(labelKey, loci, text, color);
}

async addExplorerLabel(
  key: string,
  loci: import('molstar/lib/mol-model/structure').StructureElement.Loci,
  text: string,
  accentColor?: Color,
  paramOverrides?: Record<string, any>
): Promise<void> {
  const mgr = this.ensureLabelManager();
  if (!mgr) return;
  await mgr.addPersistent(key, loci, text, accentColor, paramOverrides);
}

private componentColor(component: Component): Color {
  const ghost = this.instanceState.ghostMode;
  if (isPolymerComponent(component)) {
    const family = this.getChainFamily(component.chainId);
    return ghost ? getMolstarGhostColor(family) : getMolstarColorForFamily(family);
  }
  if (isLigandComponent(component)) {
    return getMolstarLigandColor(component.compId);
  }
  return Color(0x888888);
}

hideComponentLabel(): void {
  this.labelManager?.hideHover();
}

private componentLabelText(key: string, component: Component): string {
  if (isPolymerComponent(component)) {
    const family = this.getChainFamily(component.chainId);
    const familyName = family ? formatFamilyShort(family) : '';
    return familyName
      ? `Chain ${component.chainId} \u00B7 ${familyName}`
      : `Chain ${component.chainId}`;
  }
  if (isLigandComponent(component)) {
    return `${component.compId} (${component.authAsymId}:${component.authSeqId})`;
  }
  return key;
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

  /**
     * Find the hierarchy structure entry that owns a given component ref.
     * Aligned chains live in separate hierarchy structures from the primary.
     */
  private findHierarchyComponentsForRef(componentRef: string) {
    const plugin = this.viewer.ctx;
    if (!plugin) return [];
    const hierarchy = plugin.managers.structure.hierarchy.current;
    for (const struct of hierarchy.structures) {
      for (const comp of struct.components) {
        if (comp.cell.transform.ref === componentRef) {
          return [comp];
        }
      }
    }
    return [];
  }
  highlightAlignedChain(
    targetChainId: string,
    alignedStructureId: string,
    highlight: boolean
  ): void {
    const chainState = this.getMonomerChainState(targetChainId);
    const aligned = chainState?.alignedStructures[alignedStructureId];
    if (!aligned) return;

    const structure = this.viewer.getStructureFromRef(aligned.chainComponentRef);
    if (!structure) {
      if (!highlight) this.viewer.highlightLoci(null);
      return;
    }

    if (highlight) {
      this.viewer.highlightLoci(structureToLoci(structure));
    } else {
      this.viewer.highlightLoci(null);
    }
  }

  highlightAlignedResidue(
    targetChainId: string,
    alignedStructureId: string,
    sourceChainId: string,
    authSeqId: number,
    highlight: boolean
  ): void {
    if (!highlight) { this.viewer.highlightLoci(null); return; }
    const chainState = this.getMonomerChainState(targetChainId);
    const aligned = chainState?.alignedStructures[alignedStructureId];
    if (!aligned) return;

    const structure = this.viewer.getStructureFromRef(aligned.chainComponentRef);
    if (!structure) return;
    const loci = executeQuery(buildResidueQuery(sourceChainId, authSeqId), structure);
    this.viewer.highlightLoci(loci);
  }

  /**
   * Iterate all visible aligned structures for the active chain
   * and return their Redux entries.
   */
  private getActiveAlignedStructures(): AlignedStructure[] {
    const activeChainId = this.activeMonomerChainId;
    if (!activeChainId) return [];
    const chainState = this.getMonomerChainState(activeChainId);
    if (!chainState) return [];
    return Object.values(chainState.alignedStructures).filter(a => a.visible);
  }
  async clearAlignedOverpaint(
    targetChainId: string,
    alignedStructureId: string
  ): Promise<void> {
    const plugin = this.viewer.ctx;
    if (!plugin) return;

    const chainState = this.getMonomerChainState(targetChainId);
    const aligned = chainState?.alignedStructures[alignedStructureId];
    if (!aligned) return;

    const components = this.findHierarchyComponentsForRef(aligned.chainComponentRef);
    if (components.length === 0) return;

    // Clear overpaint
    try {
      await setStructureOverpaint(
        plugin, components, -1 as any,
        async (structure) => Structure.toStructureElementLoci(structure)
      );
    } catch (_) { /* ignore */ }

    // Restore ghost transparency
    try {
      await setStructureTransparency(
        plugin, components, 0.75,
        async (structure) => Structure.toStructureElementLoci(structure)
      );
    } catch (_) { /* ignore */ }
  }

  async applyColorschemeToAligned(
    targetChainId: string,
    alignedStructureId: string,
    colorings: ResidueColoring[]
  ): Promise<void> {
    const plugin = this.viewer.ctx;
    if (!plugin) return;

    const chainState = this.getMonomerChainState(targetChainId);
    const aligned = chainState?.alignedStructures[alignedStructureId];
    if (!aligned) return;

    const components = this.findHierarchyComponentsForRef(aligned.chainComponentRef);
    if (components.length === 0) return;

    // When a window mask is active for this aligned chain, transparency is owned
    // entirely by the mask (applyWindowMaskToAligned). Touching transparency here
    // would wipe the mask and force it to be reapplied, causing the "in-range only"
    // mode to thrash Molstar on every toggle. We only update overpaint in that
    // case; the mask is re-asserted separately when the range changes.
    const hasActiveMask = this.activeAlignedWindowMasks.has(alignedStructureId);

    // Always clear existing overpaint first. Without this, sequential toggles can
    // leave stale paint from a prior set of residues that aren't in the current
    // colorings, and the MSA/3D go out of sync. This makes the call idempotent:
    // empty colorings == fully cleared (ghost) aligned chain.
    try {
      await setStructureOverpaint(
        plugin, components, -1 as any,
        async (structure) => Structure.toStructureElementLoci(structure)
      );
      if (!hasActiveMask) {
        await setStructureTransparency(
          plugin, components, 0.75,
          async (structure) => Structure.toStructureElementLoci(structure)
        );
      }
    } catch (err) {
      console.error(`[${this.id}] Failed to clear aligned ${alignedStructureId} overpaint:`, err);
    }

    if (colorings.length === 0) return;

    // Group by color for batch application
    const colorGroups = new Map<number, number[]>();
    for (const c of colorings) {
      const key = c.color as number;
      if (!colorGroups.has(key)) colorGroups.set(key, []);
      colorGroups.get(key)!.push(c.authSeqId);
    }

    for (const [color, authSeqIds] of colorGroups.entries()) {
      const lociGetter = async (structure: Structure) => {
        const loci = executeQuery(
          buildMultiResidueQuery(aligned.sourceChainId, authSeqIds),
          structure
        );
        return loci ?? StructureElement.Loci.none(structure);
      };

      try {
        await setStructureOverpaint(plugin, components, Color(color), lociGetter);
        if (!hasActiveMask) {
          await setStructureTransparency(plugin, components, 0, lociGetter);
        }
      } catch (err) {
        console.error(`[${this.id}] Failed to apply colorscheme to aligned ${alignedStructureId}:`, err);
      }
    }
  }
  async styleAlignedChainAsGhost(
    targetChainId: string,
    alignedStructureId: string,
    family: string
  ): Promise<void> {
    const plugin = this.viewer.ctx;
    if (!plugin) return;

    const chainState = this.getMonomerChainState(targetChainId);
    const aligned = chainState?.alignedStructures[alignedStructureId];
    if (!aligned) return;

    const ghostColor = getMolstarGhostColor(family);
    const reprCells = this.findReprCells(aligned.chainComponentRef);
    if (reprCells.length === 0) return;

    const builder = plugin.build();
    for (const cell of reprCells) {
      builder.to(cell.transform.ref).update(
        StateTransforms.Representation.StructureRepresentation3D,
        old => ({ ...old, colorTheme: { name: 'uniform', params: { value: ghostColor } } })
      );
    }
    await builder.commit();
  }

  async setStructureGhostColors(enabled: boolean): Promise<void> {
    this.dispatch(setGhostMode({ instanceId: this.id, ghostMode: enabled }));

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
    const ghost = this.instanceState.ghostMode;
    const isAlphaBeta = family === 'tubulin_alpha' || family === 'tubulin_beta';
    const originalColor = (ghost && isAlphaBeta)
      ? getMolstarGhostColor(family)
      : getMolstarColorForFamily(family);
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

    const transparency = (ghost && isAlphaBeta) ? STRUCTURE_GHOST_TRANSPARENCY : 0;
    await setStructureTransparency(
      plugin,
      chainComponents,
      transparency,
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

const color = getMolstarGhostColor(family);

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

  async loadStructure(pdbId: string, classification: TubulinClassification, chainFilter?: string[]): Promise<boolean> {
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
          chainFilter: chainFilter ?? null,
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
    // Clear any lingering focus/selection from structure mode
    this.viewer.clearFocus();
    this.viewer.clearSelection();

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
        this.viewer.setSubtreeVisibility(aligned.parentRef, show);
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
        this.viewer.setSubtreeVisibility(aligned.parentRef, false);
      }
    }

    this.dispatch(setViewMode({ instanceId: this.id, viewMode: 'structure', activeChainId: null }));

    // Reapply ghost colors to all chains if ghost mode is on
    if (this.instanceState.ghostMode) {
      await this.setStructureGhostColors(true);
    }

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
          this.viewer.setSubtreeVisibility(aligned.parentRef, false);
        }
      }
    }
    const newState = this.getMonomerChainState(newChainId);
    if (newState) {
      for (const aligned of Object.values(newState.alignedStructures)) {
        if (aligned.visible) this.viewer.setSubtreeVisibility(aligned.parentRef, true);
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
    sourceChainId: string,
    family?: string,
  ): Promise<string | null> {
    const plugin = this.viewer.ctx;
    if (!plugin) return null;

    const alignedId = `${sourcePdbId}_${sourceChainId}_on_${targetChainId}`;

    // Join any in-flight load for this id. Covers the race window where a
    // caller fires while a prior call for the same id is mid-flight (before
    // Redux has received addAlignedStructure). Without this, parallel pipelines
    // both slip past the Redux-based selectIsChainAligned guard at call sites,
    // and the first pipeline's Molstar subtree becomes an orphan — an extra
    // cartoon that can never be hidden because Redux only holds the refs of
    // the second (winning) subtree.
    const inFlight = this.inFlightAlignedLoads.get(alignedId);
    if (inFlight) return inFlight;
    const loadPromise = this.doLoadAlignedStructure(targetChainId, sourcePdbId, sourceChainId, family, alignedId);
    this.inFlightAlignedLoads.set(alignedId, loadPromise);
    try {
      return await loadPromise;
    } finally {
      this.inFlightAlignedLoads.delete(alignedId);
    }
  }

  private async doLoadAlignedStructure(
    targetChainId: string,
    sourcePdbId: string,
    sourceChainId: string,
    family: string | undefined,
    alignedId: string,
  ): Promise<string | null> {
    const plugin = this.viewer.ctx;
    if (!plugin) return null;

    // If an entry for this id already exists in Redux (e.g. a sequential second
    // add after the first completed), tear it down before rebuilding. Concurrent
    // second calls are handled by the in-flight dedup in loadAlignedStructure.
    if (this.getMonomerChainState(targetChainId)?.alignedStructures[alignedId]) {
      await this.removeAlignedStructureById(targetChainId, alignedId);
    }

    let fullStructure: Awaited<ReturnType<typeof plugin.builders.structure.createStructure>> | null = null;
    try {
      const url = `https://models.rcsb.org/${sourcePdbId.toUpperCase()}.bcif`;
      const data = await plugin.builders.data.download({ url, isBinary: true, label: sourcePdbId });
      const trajectory = await plugin.builders.structure.parseTrajectory(data, 'mmcif');
      const model = await plugin.builders.structure.createModel(trajectory);
      fullStructure = await plugin.builders.structure.createStructure(model);
      console.debug(`[${this.id}][align ${alignedId}] fullStructure.ref=${fullStructure.ref}`);

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

      const _cc = chainComponent as any;
      console.debug(
        `[${this.id}][align ${alignedId}] chainComponent.ref=${_cc?.ref}`,
        `elementCount=${_cc?.data?.elementCount}`,
        `sourceChainId=${sourceChainId}`
      );

      if (!chainComponent) throw new Error(`Chain ${sourceChainId} not found in ${sourcePdbId}`);
      const elementCount = (chainComponent as any).data?.elementCount ?? 0;
      if (elementCount === 0) {
        await plugin.build().delete(fullStructure.ref).commit();
        throw new Error(
          `Chain ${sourceChainId} produced empty selection in ${sourcePdbId} (auth_asym_id match failed)`
        );
      }

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

      // Ghost style: family-colored, semi-transparent.
      // typeParams.ignoreLight matches the primary representation (see preset_structure.tsx)
      // so the aligned chain renders with the same flat/matte look — without it the aligned
      // cartoon picks up Molstar's default lit material and shows specular highlights the
      // primary doesn't have.
      const ghostColor = getMolstarGhostColor(family);
      await plugin.builders.structure.representation.addRepresentation(chainComponent, {
        type: 'cartoon',
        typeParams: { ignoreLight: true },
        color: 'uniform',
        colorParams: { value: ghostColor },
      });

      // Apply ghost transparency to match the primary chain's style
      const alignedComponents = this.findHierarchyComponentsForRef(chainComponent.ref);
      if (alignedComponents.length > 0) {
        await setStructureTransparency(
          plugin, alignedComponents, 0.75,
          async (structure) => Structure.toStructureElementLoci(structure)
        );
      }

      const shouldShow =
        this.viewMode === 'monomer' && this.activeMonomerChainId === targetChainId;
      this.viewer.setSubtreeVisibility(chainComponent.ref, shouldShow);

      const alignedStructure: AlignedStructure = {
        id: alignedId,
        sourcePdbId: sourcePdbId.toUpperCase(),
        sourceChainId,
        targetChainId,
        parentRef: fullStructure!.ref,
        chainComponentRef: chainComponent.ref,
        visible: true,
        rmsd,
        family,
      };

      this.dispatch(addAlignedStructure({ instanceId: this.id, targetChainId, alignedStructure }));
      return alignedId;
    } catch (error) {
      console.error(`[${this.id}] Failed to load aligned structure:`, error);
      try {
        if (fullStructure?.ref) {
          await plugin.build().delete(fullStructure.ref).commit();
        }
      } catch (cleanupErr) {
        console.error(`[${this.id}] Cleanup of orphan parent failed:`, cleanupErr);
      }
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

  /** Select a single residue. Caller must call viewer.clearSelection() first. */
  selectResidue(chainId: string, authSeqId: number): void {
    const structure = this.viewer.getCurrentStructure();
    if (!structure) return;
    const loci = executeQuery(buildResidueQuery(chainId, authSeqId), structure);
    this.viewer.addToSelection(loci);
  }

  /** Select a single residue on an aligned chain. Caller must call viewer.clearSelection() first. */
  selectAlignedResidue(
    targetChainId: string,
    alignedStructureId: string,
    sourceChainId: string,
    authSeqId: number
  ): void {
    const chainState = this.getMonomerChainState(targetChainId);
    const aligned = chainState?.alignedStructures[alignedStructureId];
    if (!aligned) return;
    const structure = this.viewer.getStructureFromRef(aligned.chainComponentRef);
    if (!structure) return;
    const loci = executeQuery(buildResidueQuery(sourceChainId, authSeqId), structure);
    this.viewer.addToSelection(loci);
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
    // Clear any stale structure focus (e.g. from a previous focusLigand call)
    // so it doesn't interfere with the new camera position
    this.viewer.clearFocus();
    const loci = executeQuery(buildResidueQuery(chainId, authSeqId), structure);
    if (loci) this.viewer.focusLoci(loci);
  }

  /** Get the 3D center position of a residue (average of all atom positions). */
  getResidueCenterPosition(chainId: string, authSeqId: number): [number, number, number] | null {
    const structure = this.viewer.getCurrentStructure();
    if (!structure) return null;
    const loci = executeQuery(buildResidueQuery(chainId, authSeqId), structure);
    if (!loci) return null;

    let sumX = 0, sumY = 0, sumZ = 0, count = 0;
    StructureElement.Loci.forEachLocation(loci, (location) => {
      sumX += StructureProperties.atom.x(location);
      sumY += StructureProperties.atom.y(location);
      sumZ += StructureProperties.atom.z(location);
      count++;
    });
    if (count === 0) return null;
    return [sumX / count, sumY / count, sumZ / count];
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


  async reapplyWindowMasks(): Promise<void> {
    await this.reapplyPrimaryWindowMask();
    await this.reapplyAlignedWindowMasks();
  }

  async reapplyPrimaryWindowMask(): Promise<void> {
    if (this.activeWindowMask) {
      const { chainId, visibleAuthSeqIds, pinnedAuthSeqIds } = this.activeWindowMask;
      // Temporarily clear stored state to avoid infinite recursion,
      // then restore it after re-application
      this.activeWindowMask = null;
      await this.applyWindowMask(chainId, visibleAuthSeqIds, pinnedAuthSeqIds);
    }
  }

  async reapplyAlignedWindowMasks(): Promise<void> {
    for (const mask of this.activeAlignedWindowMasks.values()) {
      const { targetChainId, alignedStructureId, sourceChainId, visibleAuthSeqIds, pinnedAuthSeqIds } = mask;
      this.activeAlignedWindowMasks.delete(alignedStructureId);
      await this.applyWindowMaskToAligned(targetChainId, alignedStructureId, sourceChainId, visibleAuthSeqIds, pinnedAuthSeqIds);
    }
  }
  async applyColorscheme(
    colorschemeId: string,
    colorings: ResidueColoring[],
    opts: { skipReapplyMasks?: boolean } = {},
  ): Promise<void> {
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

      try {
        await setStructureOverpaint(plugin, structureRef.components, color, lociGetter);
      } catch (err) {
        console.error(`[${this.id}] Failed to apply overpaint:`, err);
      }

      try {
        await setStructureTransparency(plugin, structureRef.components, 0, lociGetter);
      } catch (err) {
        console.error(`[${this.id}] Failed to clear transparency for annotated residues:`, err);
      }
    }

    this.dispatch(setActiveColorscheme({ instanceId: this.id, colorschemeId }));

    // Re-apply window mask if active -- colorscheme reset clobbered the per-residue transparency.
    // runColorSync passes skipReapplyMasks=true and reapplies once at the end of its pipeline
    // (otherwise every variant/ligand toggle in in-range-only mode would reapply aligned masks
    // mid-sync, only to have applyColorschemeToAligned run right after — redundant work that
    // hangs the browser on any moderately sized structure).
    if (!opts.skipReapplyMasks) {
      await this.reapplyWindowMasks();
    }
  }

  /**
   * Re-color every ligand ball-and-stick representation according to an override map,
   * falling back to the default palette color per ligand compId when no override is present.
   * Always applies — this keeps the visual in sync whether an override was just set OR cleared.
   */
  async applyLigandRepresentationColors(
    ligandOverrides: Record<string, string>,
  ): Promise<void> {
    const plugin = this.viewer.ctx;
    if (!plugin) return;

    const hierarchy = plugin.managers.structure.hierarchy.current;
    if (hierarchy.structures.length === 0) return;
    const structureRef = hierarchy.structures[0];

    for (const component of Object.values(this.instanceState.components)) {
      if (!isLigandComponent(component)) continue;

      const overrideHex = ligandOverrides[component.compId];
      const effectiveColor = overrideHex
        ? Color(parseInt(overrideHex.replace('#', ''), 16))
        : getMolstarLigandColor(component.compId);

      const lociGetter = async (structure: Structure) => {
        const loci = executeQuery(buildLigandQuery(component), structure);
        return loci ?? StructureElement.Loci.none(structure);
      };

      try {
        await setStructureOverpaint(plugin, structureRef.components, effectiveColor, lociGetter);
      } catch (err) {
        console.error(`[${this.id}] Failed to apply ligand overpaint for ${component.compId}:`, err);
      }
    }
  }

  async restoreDefaultColors(): Promise<void> {
    const plugin = this.viewer.ctx;
    if (!plugin) return;

    const hierarchy = plugin.managers.structure.hierarchy.current;
    if (hierarchy.structures.length === 0) return;
    const structureRef = hierarchy.structures[0];

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

    // Only restore ghost transparency if no window mask is active.
    // If a mask IS active, reapplyWindowMasks() will handle transparency.
    const activeChainId = this.activeMonomerChainId;
    if (this.viewMode === 'monomer' && activeChainId && !this.activeWindowMask) {
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
  this.labelManager?.dispose();
  this.labelManager = null;
  this.viewer.clearFocus();
  await this.viewer.clear();
  this.dispatch(clearInstance(this.id));
}


  // ============================================================
  // Outline mode toggle (for window mask)
  // ============================================================

  private setIncludeTransparent(include: boolean): void {
    const plugin = this.viewer.ctx;
    if (!plugin?.canvas3d) return;

    const current = plugin.canvas3d.props.postprocessing;
    if (current.outline.name !== 'on') return;

    plugin.canvas3d.setProps({
      postprocessing: {
        ...current,
        outline: {
          name: 'on' as const,
          params: {
            ...current.outline.params,
            includeTransparent: include,
          }
        }
      }
    });
  }

  // ============================================================
  // Window mask -- primary chain
  // ============================================================

  async applyWindowMask(chainId: string, visibleAuthSeqIds: number[], pinnedAuthSeqIds: number[] = []): Promise<void> {
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

    // Store mask state for re-application after colorscheme changes
    this.activeWindowMask = { chainId, visibleAuthSeqIds, pinnedAuthSeqIds };

    this.setIncludeTransparent(false);

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
        plugin, chainComponents, 0,
        async (s) => executeQuery(buildMultiResidueQuery(chainId, visibleAuthSeqIds), s)
          ?? StructureElement.Loci.none(s)
      );
    }

    if (pinnedAuthSeqIds.length > 0) {
      await setStructureTransparency(
        plugin, chainComponents, 0,
        async (s) => executeQuery(buildMultiResidueQuery(chainId, pinnedAuthSeqIds), s)
          ?? StructureElement.Loci.none(s)
      );
    }

    const focusLoci = executeQuery(buildMultiResidueQuery(chainId, visibleAuthSeqIds), structure);
    if (focusLoci) this.viewer.focusLoci(focusLoci);
  }

  async clearWindowMask(chainId: string): Promise<void> {
    this.activeWindowMask = null;
    await this.applyGhostToChain(chainId);
    this.setIncludeTransparent(true);
  }

  // ============================================================
  // Window mask -- aligned chains
  // ============================================================

  async applyWindowMaskToAligned(
    targetChainId: string,
    alignedStructureId: string,
    sourceChainId: string,
    visibleAuthSeqIds: number[],
    pinnedAuthSeqIds: number[] = []
  ): Promise<void> {
    const plugin = this.viewer.ctx;
    if (!plugin) return;

    const chainState = this.getMonomerChainState(targetChainId);
    const aligned = chainState?.alignedStructures[alignedStructureId];
    if (!aligned) return;

    const components = this.findHierarchyComponentsForRef(aligned.chainComponentRef);
    if (components.length === 0) return;

    const cell = plugin.state.data.select(
      StateSelection.Generators.byRef(aligned.chainComponentRef)
    )[0];
    const alignedStructure = cell?.obj?.data as Structure | undefined;
    if (!alignedStructure) return;

    const observed = extractObservedSequence(alignedStructure, sourceChainId);
    if (!observed) return;

    // Store for re-application
    this.activeAlignedWindowMasks.set(alignedStructureId, {
      targetChainId, alignedStructureId, sourceChainId, visibleAuthSeqIds, pinnedAuthSeqIds,
    });

    const visibleSet = new Set(visibleAuthSeqIds);
    const outOfRange = observed.authSeqIds.filter(id => !visibleSet.has(id));

    if (outOfRange.length > 0) {
      await setStructureTransparency(
        plugin, components, 1,
        async (s) => executeQuery(buildMultiResidueQuery(sourceChainId, outOfRange), s)
          ?? StructureElement.Loci.none(s)
      );
    }

    if (visibleAuthSeqIds.length > 0) {
      // 0.75 matches the aligned-chain ghost baseline (see loadAlignedStructure).
      // Using the primary's 0.35 here would visually un-ghost the aligned chain
      // in in-range mode — the user sees "solid beige" instead of a translucent
      // ghost overlay.
      await setStructureTransparency(
        plugin, components, 0.75,
        async (s) => executeQuery(buildMultiResidueQuery(sourceChainId, visibleAuthSeqIds), s)
          ?? StructureElement.Loci.none(s)
      );
    }

    if (pinnedAuthSeqIds.length > 0) {
      await setStructureTransparency(
        plugin, components, 0,
        async (s) => executeQuery(buildMultiResidueQuery(sourceChainId, pinnedAuthSeqIds), s)
          ?? StructureElement.Loci.none(s)
      );
    }
  }

  async clearWindowMaskForAligned(
    targetChainId: string,
    alignedStructureId: string
  ): Promise<void> {
    this.activeAlignedWindowMasks.delete(alignedStructureId);

    const plugin = this.viewer.ctx;
    if (!plugin) return;

    const chainState = this.getMonomerChainState(targetChainId);
    const aligned = chainState?.alignedStructures[alignedStructureId];
    if (!aligned) return;

    const components = this.findHierarchyComponentsForRef(aligned.chainComponentRef);
    if (components.length === 0) return;

    await setStructureTransparency(
      plugin, components, 0.75,
      async (structure) => Structure.toStructureElementLoci(structure)
    );
  }


  // ============================================================
  // Aligned chain visibility -- use parentRef to fully hide
  // ============================================================

  setAlignedStructureVisible(targetChainId: string, alignedStructureId: string, visible: boolean): void {
    const aligned = this.getMonomerChainState(targetChainId)?.alignedStructures[alignedStructureId];
    if (!aligned) return;

    const shouldReallyShow =
      visible && this.viewMode === 'monomer' && this.activeMonomerChainId === targetChainId;

    // Toggle both the parent structure subtree and the chain-component subtree.
    // Redundant in normal conditions (the parentRef subtree contains the
    // chain-component subtree), but cheap; leaving both guarded against past
    // fragility where a rebuild could clear isHidden on one while the other stayed set.
    this.viewer.setSubtreeVisibility(aligned.parentRef, shouldReallyShow);
    this.viewer.setSubtreeVisibility(aligned.chainComponentRef, shouldReallyShow);

    this.dispatch(
      setAlignedStructureVisibility({ instanceId: this.id, targetChainId, alignedStructureId, visible })
    );
  }


  /**
   * Create a temporary ball-and-stick representation for a single residue,
   * colored by its chain's family color. Returns a cleanup function that
   * removes the component+representation when called.
   * Works for both the primary structure and aligned structures.
   */
  async addTemporaryResidueRepr(
    chainId: string,
    authSeqId: number,
    pdbId?: string
  ): Promise<(() => Promise<void>) | null> {
    const plugin = this.viewer.ctx;
    if (!plugin) return null;

    // Determine if this is the primary structure or an aligned one
    const isPrimary = !pdbId || pdbId === this.loadedStructure;
    let structureRef: string | undefined;
    // Use broad family keys (tubulin_alpha, tubulin_beta) for color lookup,
    // NOT gene-level families (TUBA1A, TUBB) which don't map to TUBULIN_COLORS.
    let colorFamily: string | undefined;
    let needsChainFilter = true;

    if (isPrimary) {
      structureRef = this.viewer.getCurrentStructureRef();
      colorFamily = this.getChainFamily(chainId);
    } else {
      // Find the aligned structure by pdbId + chainId.
      // chainComponentRef has untransformed coords; we need the
      // TransformStructureConformation child which holds the superposed coords.
      const chainStates = this.instanceState.monomerChainStates;
      for (const cs of Object.values(chainStates)) {
        for (const aligned of Object.values(cs.alignedStructures)) {
          if (aligned.sourcePdbId === pdbId && aligned.sourceChainId === chainId) {
            const transformNode = plugin.state.data.selectQ(q =>
              q.byRef(aligned.chainComponentRef)
               .subtree()
               .withTransformer(StateTransforms.Model.TransformStructureConformation)
            )[0];
            structureRef = transformNode?.transform.ref ?? aligned.chainComponentRef;
            needsChainFilter = false;
            colorFamily = aligned.family;
            break;
          }
        }
        if (structureRef) break;
      }
    }

    if (!structureRef) return null;

    const color = getMolstarColorForFamily(colorFamily);

    // For aligned structures, chainComponentRef is already chain-filtered
    const expression = needsChainFilter
      ? MS.struct.generator.atomGroups({
          'chain-test': MS.core.rel.eq([MS.struct.atomProperty.macromolecular.auth_asym_id(), chainId]),
          'residue-test': MS.core.rel.eq([MS.struct.atomProperty.macromolecular.auth_seq_id(), authSeqId]),
        })
      : MS.struct.generator.atomGroups({
          'residue-test': MS.core.rel.eq([MS.struct.atomProperty.macromolecular.auth_seq_id(), authSeqId]),
        });

    const component = await plugin.builders.structure.tryCreateComponentFromExpression(
      structureRef,
      expression,
      `_tmp_residue_${pdbId ?? 'primary'}_${chainId}_${authSeqId}`,
      { label: `Residue ${chainId}:${authSeqId}` }
    );

    if (!component) return null;

    await plugin.builders.structure.representation.addRepresentation(component, {
      type: 'ball-and-stick',
      color: 'uniform',
      colorParams: { value: color },
      typeParams: { sizeFactor: 0.3 },
    } as any);

    const ref = component.ref;
    return async () => {
      try {
        await plugin.build().delete(ref).commit();
      } catch { /* component may already be gone */ }
    };
  }

dispose(): void {
  this.labelManager?.dispose();
  this.labelManager = null;
  this.viewer.dispose();
}
}