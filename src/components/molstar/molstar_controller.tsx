import { MolstarViewer } from './molstar_viewer';
import { AppDispatch, RootState } from '@/store/store';
import { setStructureRef, addComponents, clearStructure, clearAll, PolymerComponent, LigandComponent } from '@/store/slices/molstar_refs';
import { initializePolymer, clearPolymersForStructure, clearAllPolymers, setPolymerVisibility, setPolymerHovered } from '@/store/slices/polymer_states';
import { setError } from '@/store/slices/tubulin_structures';
import { QueryContext, Structure, StructureProperties, StructureSelection } from 'molstar/lib/mol-model/structure';
import { MolScriptBuilder as MS } from 'molstar/lib/mol-script/language/builder';
import { StateSelection } from 'molstar/lib/mol-state';
import { setSubtreeVisibility } from 'molstar/lib/mol-plugin/behavior/static/state';
import { PresetObjects, TubulinClassification } from './molstar_preset';
import { initializeNonPolymer, setNonPolymerHovered, setNonPolymerVisibility } from '@/store/slices/nonpolymer_states';
import { compile } from 'molstar/lib/mol-script/runtime/query/compiler';
import { OrderedSet } from 'molstar/lib/mol-data/int';
import { InteractionsProvider } from 'molstar/lib/mol-model-props/computed/interactions';
import { StructureElement } from 'molstar/lib/mol-model/structure';
import { interactionTypeLabel } from 'molstar/lib/mol-model-props/computed/interactions/common';
import { SyncRuntimeContext } from 'molstar/lib/mol-task/execution/synchronous';
import { AssetManager } from 'molstar/lib/mol-util/assets';
import { Loci } from 'molstar/lib/mol-model/structure/structure/element/element';
import { AMINO_ACIDS_3_TO_1_CODE } from './preset-helpers';
import { SequenceData } from '@/store/slices/sequence_viewer';
import { setResidueHover, setResidueSelection } from '@/store/slices/sequence_structure_sync';
import { StructureFocusRepresentation } from 'molstar/lib/mol-plugin/behavior/dynamic/selection/structure-focus-representation';

export interface InteractionInfo {
    type: string;
    partnerA: { label: string, loci: StructureElement.Loci };
    partnerB: { label: string, loci: StructureElement.Loci };
}

interface ComputedResidueAnnotation {
    auth_asym_id: string;
    auth_seq_id: number;
    method: string;
    confidence: number;
}

/**
 * Refactored MolstarController with modular helper methods
 */
export class MolstarController {
    viewer: MolstarViewer;
    private dispatch: AppDispatch;
    private getState: () => RootState;

    constructor(viewer: MolstarViewer, dispatch: AppDispatch, getState: () => RootState) {
        this.viewer = viewer;
        this.dispatch = dispatch;
        this.getState = getState;
    }

    // ============================================================
    // CORE QUERY HELPERS - Reusable building blocks
    // ============================================================

    /**
     * Get the current structure from Molstar
     */
    private getCurrentStructure(): Structure | undefined {
        return this.viewer.ctx?.managers.structure.hierarchy.current.structures[0]?.cell.obj?.data;
    }

    /**
     * Create a residue query for a specific chain and residue range
     */
    private createResidueQuery(chainId: string, startResidue: number, endResidue?: number) {
        const residueTest = endResidue !== undefined
            ? MS.core.rel.inRange([MS.ammp('auth_seq_id'), startResidue, endResidue])
            : MS.core.rel.eq([MS.ammp('auth_seq_id'), startResidue]);

        return MS.struct.generator.atomGroups({
            'chain-test': MS.core.rel.eq([MS.ammp('auth_asym_id'), chainId]),
            'residue-test': residueTest
        });
    }

    /**
     * Create a ligand query for specific ligand instance
     */
    private createLigandQuery(ligand: LigandComponent) {
        return MS.struct.generator.atomGroups({
            'residue-test': MS.core.logic.and([
                MS.core.rel.eq([MS.ammp('auth_comp_id'), ligand.compId]),
                MS.core.rel.eq([MS.ammp('auth_asym_id'), ligand.auth_asym_id]),
                MS.core.rel.eq([MS.ammp('auth_seq_id'), ligand.auth_seq_id])
            ]),
        });
    }

    /**
     * Compile query and convert to Loci
     */
    private queryToLoci(query: any, structure?: Structure): StructureElement.Loci | null {
        const str = structure || this.getCurrentStructure();
        if (!str) return null;

        const compiled = compile(query);
        const selection = compiled(new QueryContext(str));

        if (StructureSelection.isEmpty(selection)) return null;

        return StructureSelection.toLociWithSourceUnits(selection);
    }

    /**
     * Get component ref from Redux state
     */
    private getComponentRef(pdbId: string, key: string): string | undefined {
        const state = this.getState();
        const component = state.molstarRefs.components[`${pdbId}_${key}`];
        return component?.ref;
    }

    /**
     * Get structure from cell ref
     */
    private getStructureFromRef(ref: string): Structure | undefined {
        if (!this.viewer.ctx) return undefined;

        const cell = this.viewer.ctx.state.data.select(StateSelection.Generators.byRef(ref))[0];
        return cell?.obj?.data as Structure | undefined;
    }

    // ============================================================
    // HIGHLIGHTING & FOCUS - Unified methods
    // ============================================================

    /**
     * Generic highlight method
     */
    private highlightLoci(loci: StructureElement.Loci | null, shouldHighlight: boolean = true) {
        if (!this.viewer.ctx) return;

        if (!shouldHighlight || !loci || Loci.isEmpty(loci)) {
            this.viewer.ctx.managers.interactivity.lociHighlights.clearHighlights();
        } else {
            this.viewer.ctx.managers.interactivity.lociHighlights.highlight({ loci }, false);
        }
    }

    /**
     * Generic focus method
     */
    private focusLoci(loci: StructureElement.Loci | null, options = { durationMs: 100 }) {
        if (!this.viewer.ctx || !loci || Loci.isEmpty(loci)) return;
        this.viewer.ctx.managers.camera.focusLoci(loci, options);
    }

    // ============================================================
    // CHAIN OPERATIONS - Simplified
    // ============================================================

    async focusChain(pdbId: string, chainId: string) {
        const ref = this.getComponentRef(pdbId, chainId);
        if (!ref) {
            console.warn(`No ref found for chain ${chainId}`);
            return;
        }

        const structure = this.getStructureFromRef(ref);
        if (!structure) {
            console.warn(`No structure found for chain ${chainId}`);
            return;
        }

        const loci = Structure.toStructureElementLoci(structure);
        this.focusLoci(loci);
    }

    async setChainVisibility(pdbId: string, chainId: string, isVisible: boolean) {
        const ref = this.getComponentRef(pdbId, chainId);
        if (ref && this.viewer.ctx) {
            setSubtreeVisibility(this.viewer.ctx.state.data, ref, !isVisible);
            this.dispatch(setPolymerVisibility({ pdbId, chainId, visible: isVisible }));
        }
    }

    async highlightChain(pdbId: string, chainId: string, shouldHighlight: boolean) {
        if (!shouldHighlight) {
            this.highlightLoci(null, false);
            this.dispatch(setPolymerHovered({ pdbId, chainId, hovered: false }));
            return;
        }

        const ref = this.getComponentRef(pdbId, chainId);
        if (!ref) return;

        const structure = this.getStructureFromRef(ref);
        if (structure) {
            const loci = Structure.toStructureElementLoci(structure);
            this.highlightLoci(loci, true);
            this.dispatch(setPolymerHovered({ pdbId, chainId, hovered: true }));
        }
    }

    // ============================================================
    // NON-POLYMER OPERATIONS - Simplified
    // ============================================================

    async focusNonPolymer(pdbId: string, uniqueKey: string) {
        const ref = this.getComponentRef(pdbId, uniqueKey);
        if (!ref) {
            console.warn(`No ref found for non-polymer ${uniqueKey}`);
            return;
        }

        const structure = this.getStructureFromRef(ref);
        if (structure) {
            const loci = Structure.toStructureElementLoci(structure);
            this.focusLoci(loci);
        }
    }

    async highlightNonPolymer(pdbId: string, uniqueKey: string, shouldHighlight: boolean) {
        if (!shouldHighlight) {
            this.highlightLoci(null, false);
            this.dispatch(setNonPolymerHovered({ pdbId, chemId: uniqueKey, hovered: false }));
            return;
        }

        const ref = this.getComponentRef(pdbId, uniqueKey);
        if (!ref) return;

        const structure = this.getStructureFromRef(ref);
        if (structure) {
            const loci = Structure.toStructureElementLoci(structure);
            this.highlightLoci(loci, true);
            this.dispatch(setNonPolymerHovered({ pdbId, chemId: uniqueKey, hovered: true }));
        }
    }

    async setNonPolymerVisibility(pdbId: string, uniqueKey: string, isVisible: boolean) {
        const ref = this.getComponentRef(pdbId, uniqueKey);
        if (ref && this.viewer.ctx) {
            setSubtreeVisibility(this.viewer.ctx.state.data, ref, !isVisible);
            this.dispatch(setNonPolymerVisibility({ pdbId, chemId: uniqueKey, visible: isVisible }));
        }
    }

    // ============================================================
    // RESIDUE OPERATIONS - Modular
    // ============================================================

    async selectResidues(pdbId: string, chainId: string, startResidue: number, endResidue: number) {
        const query = this.createResidueQuery(chainId, startResidue, endResidue);
        const loci = this.queryToLoci(query);

        if (!loci) {
            console.warn(`No residues found for ${chainId}:${startResidue}-${endResidue}`);
            return;
        }

        this.focusLoci(loci);
        this.highlightLoci(loci, true);

        this.dispatch(setResidueSelection({
            pdbId,
            chainId,
            startResidue,
            endResidue,
            source: 'structure'
        }));
    }

    async hoverResidue(pdbId: string, chainId: string, residueNumber: number, shouldHover: boolean = true) {
        if (!shouldHover) {
            this.highlightLoci(null, false);
            this.dispatch(setResidueHover(null));
            return;
        }

        const query = this.createResidueQuery(chainId, residueNumber);
        const loci = this.queryToLoci(query);

        if (loci) {
            this.highlightLoci(loci, true);
            this.dispatch(setResidueHover({
                pdbId,
                chainId,
                residueNumber,
                source: 'structure'
            }));
        }
    }

    async selectResiduesRange(pdbId: string, chainId: string, startResidue: number, endResidue: number) {
        if (!this.viewer.ctx) return;

        const query = this.createResidueQuery(chainId, startResidue, endResidue);
        const loci = this.queryToLoci(query);

        if (loci) {
            this.viewer.ctx.managers.structure.selection.clear();
            this.viewer.ctx.managers.structure.selection.fromLoci('add', loci);
        }
    }

    async clearResidueSelection() {
        this.viewer.ctx?.managers.structure.selection.clear();
    }

    async focusOnResidues(pdbId: string, chainId: string, startResidue: number, endResidue: number) {
        const query = this.createResidueQuery(chainId, startResidue, endResidue);
        const loci = this.queryToLoci(query);

        if (loci) {
            this.focusLoci(loci);
        }
    }

    // ============================================================
    // LIGAND & INTERACTION OPERATIONS
    // ============================================================

    async highlightInteraction(interaction: InteractionInfo | undefined, shouldHighlight: boolean = true) {
        if (!shouldHighlight || !interaction) {
            this.highlightLoci(null, false);
            return;
        }

        const combinedLoci = Loci.union(interaction.partnerA.loci, interaction.partnerB.loci);
        this.highlightLoci(combinedLoci as StructureElement.Loci, true);
    }

    async focusLigandAndGetInteractions(ligand: LigandComponent): Promise<InteractionInfo[] | undefined> {
        if (!this.viewer.ctx) return;

        const structure = this.getCurrentStructure();
        if (!structure) return;

        // Get ligand loci
        const ligandQuery = this.createLigandQuery(ligand);
        const loci = this.queryToLoci(ligandQuery, structure);

        if (!loci || Loci.isEmpty(loci)) {
            console.warn(`Could not find loci for ligand ${ligand.uniqueKey}`);
            return [];
        }

        // Focus on ligand
        this.viewer.ctx.managers.structure.focus.setFromLoci(loci);
        this.focusLoci(loci);

        // Calculate surroundings and interactions
        const surroundingsQuery = MS.struct.modifier.includeSurroundings({
            0: ligandQuery,
            radius: 5,
            'as-whole-residues': true
        });

        const surroundingsSelection = compile(surroundingsQuery)(new QueryContext(structure));
        const surroundingsStructure = StructureSelection.unionStructure(surroundingsSelection);

        if (surroundingsStructure.elementCount === 0) return [];

        const customPropertyContext = {
            runtime: SyncRuntimeContext,
            assetManager: new AssetManager()
        };
        await InteractionsProvider.attach(customPropertyContext, surroundingsStructure, undefined, true);

        return this.getInteractionData(surroundingsStructure);
    }

    async clearLigandFocus() {
        this.viewer.ctx?.managers.structure.focus.clear();
    }

    async focusOnInteraction(lociA: Loci, lociB: Loci) {
        const combined = Loci.union(lociA, lociB);
        this.focusLoci(combined as StructureElement.Loci);
    }

    /**
     * Extract interaction data from structure
     */
    private getInteractionData(structure: Structure): InteractionInfo[] {
        const interactions = InteractionsProvider.get(structure).value;
        if (!interactions) return [];

        const results: InteractionInfo[] = [];
        const { units } = structure;
        const { unitsFeatures, unitsContacts, contacts: interUnitContacts } = interactions;

        const getPartnerInfo = (unit: any, feature: number) => {
            const featuresOfUnit = unitsFeatures.get(unit.id);
            if (!featuresOfUnit) return { label: 'Unknown', loci: StructureElement.Loci.Empty };

            const firstAtomIndex = featuresOfUnit.members[featuresOfUnit.offsets[feature]];
            const loc = StructureElement.Location.create(structure, unit, firstAtomIndex);

            const compId = StructureProperties.atom.label_comp_id(loc);
            const seqId = StructureProperties.residue.auth_seq_id(loc);
            const atomId = StructureProperties.atom.label_atom_id(loc);
            const chainId = StructureProperties.chain.auth_asym_id(loc);

            const label = `[${compId}]${chainId}.${seqId}:${atomId}`;
            const loci = StructureElement.Loci(structure, [{
                unit,
                indices: OrderedSet.ofSingleton(firstAtomIndex)
            }]);

            return { label, loci };
        };

        // Intra-unit contacts
        for (const unit of units) {
            const intraContacts = unitsContacts.get(unit.id);
            if (!intraContacts) continue;

            const { edgeCount, a, b, edgeProps } = intraContacts;
            for (let i = 0; i < edgeCount; i++) {
                if (a[i] < b[i]) {
                    results.push({
                        type: interactionTypeLabel(edgeProps.type[i]),
                        partnerA: getPartnerInfo(unit, a[i]),
                        partnerB: getPartnerInfo(unit, b[i]),
                    });
                }
            }
        }

        // Inter-unit contacts
        for (const bond of interUnitContacts.edges) {
            const unitA = structure.unitMap.get(bond.unitA);
            const unitB = structure.unitMap.get(bond.unitB);
            if (!unitA || !unitB) continue;
            if (unitA.id > unitB.id || (unitA.id === unitB.id && bond.indexA > bond.indexB)) continue;

            results.push({
                type: interactionTypeLabel(bond.props.type),
                partnerA: getPartnerInfo(unitA, bond.indexA),
                partnerB: getPartnerInfo(unitB, bond.indexB),
            });
        }

        return results;
    }

    // Add these methods to the MolstarController class

    // ============================================================
    // STRUCTURE LOADING - Modular approach
    // ============================================================

    /**
     * Register components in Redux after loading
     */
    private registerComponents(
        pdbId: string,
        objects_polymer: Record<string, any>,
        objects_ligand: Record<string, any>,
        structureRef: string
    ) {
        const polymerComponents = Object.entries(objects_polymer || {}).reduce((acc, [chainId, data]) => {
            acc[chainId] = {
                type: 'polymer' as const,
                pdbId,
                ref: data.ref,
                chainId
            };
            return acc;
        }, {} as Record<string, PolymerComponent>);

        const ligandComponents = Object.entries(objects_ligand || {}).reduce((acc, [uniqueKey, data]) => {
            const [compId, auth_asym_id, auth_seq_id_str] = uniqueKey.split('_');
            acc[uniqueKey] = {
                type: 'ligand' as const,
                pdbId,
                ref: data.ref,
                uniqueKey,
                compId,
                auth_asym_id,
                auth_seq_id: parseInt(auth_seq_id_str, 10)
            };
            return acc;
        }, {} as Record<string, LigandComponent>);

        // Dispatch to Redux
        this.dispatch(setStructureRef({ pdbId, ref: structureRef }));
        this.dispatch(addComponents({
            pdbId,
            components: { ...polymerComponents, ...ligandComponents }
        }));

        // Initialize component states
        Object.keys(polymerComponents).forEach(chainId => {
            this.dispatch(initializePolymer({ pdbId, chainId }));
        });
        Object.keys(ligandComponents).forEach(uniqueKey => {
            this.dispatch(initializeNonPolymer({ pdbId, chemId: uniqueKey }));
        });

        return { polymerComponents, ligandComponents };
    }

    /**
     * Configure focus representation theme
     */
    private async configureFocusRepresentation(classification: TubulinClassification) {
        if (!this.viewer.ctx) return;

        await this.viewer.ctx.state.updateBehavior(StructureFocusRepresentation, params => {
            params.surroundingsParams.colorTheme = {
                name: 'tubulin-chain-id',
                params: { classification }
            };
            params.targetParams.colorTheme = {
                name: 'element-symbol',
                params: {}
            };
        });
    }

    /**
     * Load structure from RCSB
     */
    async loadStructure(pdbId: string, tubulinClassification: TubulinClassification): Promise<boolean> {
        try {
            await this.clearCurrentStructure();
            if (!this.viewer.ctx) throw new Error('Molstar not initialized');

            const asset_url = `https://models.rcsb.org/${pdbId.toUpperCase()}.bcif`;

            // Download and parse structure
            const data = await this.viewer.ctx.builders.data.download({
                url: asset_url,
                isBinary: true,
                label: pdbId.toUpperCase()
            });
            const trajectory = await this.viewer.ctx.builders.structure.parseTrajectory(data, 'mmcif');
            const model = await this.viewer.ctx.builders.structure.createModel(trajectory);
            const structure = await this.viewer.ctx.builders.structure.createStructure(model);

            // Apply preset
            const { objects_polymer, objects_ligand } = await this.viewer.ctx.builders.structure.representation.applyPreset(
                structure,
                'tubulin-split-preset',
                { pdbId: pdbId.toUpperCase(), tubulinClassification }
            ) as Partial<PresetObjects>;

            // Register components
            this.registerComponents(pdbId.toUpperCase(), objects_polymer || {}, objects_ligand || {}, structure.ref);

            // Configure visual representation
            await this.configureFocusRepresentation(tubulinClassification);

            return true;
        } catch (error) {
            console.error('Error loading structure:', error);
            this.dispatch(setError(error instanceof Error ? error.message : 'Unknown error'));
            return false;
        }
    }

    /**
     * Parse computed residue annotations from mmCIF
     */
    private parseComputedResidues(mmcifContent: string): ComputedResidueAnnotation[] {
        const annotations: ComputedResidueAnnotation[] = [];

        try {
            const lines = mmcifContent.split('\n');
            let inComputedLoop = false;
            let headerIndices: Record<string, number> = {};

            for (let i = 0; i < lines.length; i++) {
                const trimmedLine = lines[i].trim();

                // Detect start of computed residue loop
                if (trimmedLine === 'loop_' &&
                    i + 1 < lines.length &&
                    lines[i + 1].trim().startsWith('_pdbx_computed_residue.')) {
                    inComputedLoop = true;
                    continue;
                }

                // Parse headers
                if (inComputedLoop && trimmedLine.startsWith('_pdbx_computed_residue.')) {
                    const field = trimmedLine.replace('_pdbx_computed_residue.', '');
                    headerIndices[field] = Object.keys(headerIndices).length;
                    continue;
                }

                // Parse data lines
                if (inComputedLoop &&
                    !trimmedLine.startsWith('_') &&
                    !trimmedLine.startsWith('#') &&
                    trimmedLine.length > 0) {

                    if (trimmedLine.startsWith('loop_') || trimmedLine.startsWith('data_')) break;

                    const parts = trimmedLine.split(/\s+/);
                    if (parts.length >= Object.keys(headerIndices).length) {
                        annotations.push({
                            auth_asym_id: parts[headerIndices['auth_asym_id']] || '',
                            auth_seq_id: parseInt(parts[headerIndices['auth_seq_id']] || '0'),
                            method: parts[headerIndices['method']]?.replace(/'/g, '') || '',
                            confidence: parseFloat(parts[headerIndices['confidence']] || '0')
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Error parsing computed residues:', error);
        }

        return annotations;
    }

    /**
     * Load structure from backend with metadata
     */
    async loadStructureFromBackend(filename: string, tubulinClassification: TubulinClassification): Promise<boolean> {
        try {
            await this.clearCurrentStructure();
            if (!this.viewer.ctx) throw new Error('Molstar not initialized');

            const backendUrl = `http://localhost:8000/models/${filename}`;

            // Fetch mmCIF content
            const response = await fetch(backendUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
            }

            const mmcifContent = await response.text();

            // Parse computed residue annotations
            const computedAnnotations = this.parseComputedResidues(mmcifContent);
            if (computedAnnotations.length > 0) {
                console.log('🔬 Found computed residue annotations:', computedAnnotations.length);
            }

            // Load structure
            const data = await this.viewer.ctx.builders.data.rawData({
                data: mmcifContent,
                label: filename
            });
            const trajectory = await this.viewer.ctx.builders.structure.parseTrajectory(data, 'mmcif');
            const model = await this.viewer.ctx.builders.structure.createModel(trajectory);
            const structure = await this.viewer.ctx.builders.structure.createStructure(model);

            const pdbId = filename.split('_')[0].toUpperCase();

            // Apply preset with computed residues
            const { objects_polymer, objects_ligand } = await this.viewer.ctx.builders.structure.representation.applyPreset(
                structure,
                'tubulin-split-preset-computed-res',
                { pdbId, tubulinClassification, computedResidues: computedAnnotations }
            ) as Partial<PresetObjects>;

            // Register components
            this.registerComponents(pdbId, objects_polymer || {}, objects_ligand || {}, structure.ref);

            // Configure visual representation
            await this.configureFocusRepresentation(tubulinClassification);

            return true;
        } catch (error) {
            console.error('Error loading structure from backend:', error);
            this.dispatch(setError(error instanceof Error ? error.message : 'Unknown error'));
            return false;
        }
    }

    // ============================================================
    // SEQUENCE OPERATIONS - Simplified
    // ============================================================

    /**
     * Get all chains for a structure
     */
    getAllChains(pdbId: string): string[] {
        const state = this.getState();
        const pdbIdUpper = pdbId.toUpperCase();
        const components = state.molstarRefs.components;

        if (!components) return [];

        const chainIds = Object.entries(components)
            .filter(([, component]) =>
                component.type === 'polymer' && component.pdbId === pdbIdUpper
            )
            .map(([, component]) => (component as PolymerComponent).chainId)
            .filter(Boolean);

        return [...new Set(chainIds)].sort();
    }

    /**
     * Extract sequence from structure
     */
    private extractSequenceFromStructure(pdbId: string, chainId: string): string | null {
        if (!this.viewer.ctx) return null;

        const structure = this.getCurrentStructure();
        if (!structure) return null;

        const residues = new Map<number, string>();

        for (const unit of structure.units) {
            const unitChainId = StructureProperties.chain.auth_asym_id({
                unit,
                element: unit.elements[0]
            });

            if (unitChainId === chainId) {
                for (let i = 0; i < unit.elements.length; i++) {
                    const location = StructureElement.Location.create(structure, unit, unit.elements[i]);
                    const seqId = StructureProperties.residue.auth_seq_id(location);
                    const compId = StructureProperties.atom.label_comp_id(location);
                    const singleLetter = AMINO_ACIDS_3_TO_1_CODE[compId] || 'X';
                    residues.set(seqId, singleLetter);
                }

                const sortedResidues = Array.from(residues.entries()).sort((a, b) => a[0] - b[0]);
                return sortedResidues.map(([, code]) => code).join('');
            }
        }

        return null;
    }

    /**
     * Get chain sequence
     */
    getChainSequence(pdbId: string, chainId: string): string | null {
        const state = this.getState();
        const component = state.molstarRefs.components[`${pdbId}_${chainId}`];

        if (!component || component.type !== 'polymer') {
            console.warn(`No polymer component found for ${pdbId} chain ${chainId}`);
            return null;
        }

        // Check if sequence is stored in component
        if ('sequence' in component && Array.isArray(component.sequence)) {
            return component.sequence.map((residue: any) => residue.code || 'X').join('');
        }

        // Fallback: extract from structure
        return this.extractSequenceFromStructure(pdbId, chainId);
    }

    /**
     * Get sequence data formatted for viewer
     */
    getSequenceForViewer(pdbId: string, chainId: string): SequenceData | null {
        const sequence = this.getChainSequence(pdbId, chainId);
        if (!sequence) return null;

        return {
            chainId,
            pdbId,
            sequence,
            name: `${pdbId} Chain ${chainId}`,
            chainType: 'polymer'
        };
    }

    // ============================================================
    // CLEANUP
    // ============================================================

    async clearCurrentStructure(): Promise<void> {
        await this.clearLigandFocus();
        const currentStructure = this.getState().molstarRefs.currentStructure;

        if (!currentStructure) return;

        try {
            await this.viewer.clear();
            this.dispatch(clearStructure(currentStructure));
            this.dispatch(clearPolymersForStructure(currentStructure));
        } catch (error) {
            console.error('Error clearing structure:', error);
        }
    }

    async clearAll(): Promise<void> {
        try {
            await this.viewer.clear();
            this.dispatch(clearAll());
            this.dispatch(clearAllPolymers());
        } catch (error) {
            console.error('Error clearing all structures:', error);
            throw error;
        }
    }

    dispose() {
        this.viewer.dispose();
    }
    async isolateChain(pdbId: string, chainId: string): Promise<void> {
        if (!this.viewer.ctx) return;

        const state = this.getState();
        const pdbIdUpper = pdbId.toUpperCase();
        const components = state.molstarRefs.components;

        // Get all polymer components for this structure
        const polymerComponents = Object.entries(components)
            .filter(([, component]) =>
                component.type === 'polymer' &&
                component.pdbId === pdbIdUpper
            )
            .map(([key, component]) => ({
                key,
                component: component as PolymerComponent
            }));

        // Get all non-polymer components for this structure
        const nonPolymerComponents = Object.entries(components)
            .filter(([, component]) =>
                component.type === 'ligand' &&
                component.pdbId === pdbIdUpper
            )
            .map(([key, component]) => ({
                key,
                component: component as LigandComponent
            }));

        console.log(`Isolating chain ${chainId} in ${pdbIdUpper}:`);
        console.log(`- Found ${polymerComponents.length} polymer chains`);
        console.log(`- Found ${nonPolymerComponents.length} non-polymer components`);

        // Hide all polymer chains except the selected one
        for (const { component } of polymerComponents) {
            if (component.chainId !== chainId) {
                await this.setChainVisibility(pdbIdUpper, component.chainId, false);
                console.log(`- Hid polymer chain: ${component.chainId}`);
            }
        }

        // Hide ALL non-polymer components
        for (const { component } of nonPolymerComponents) {
            await this.setNonPolymerVisibility(pdbIdUpper, component.uniqueKey, false);
            console.log(`- Hid non-polymer: ${component.uniqueKey}`);
        }

        // Show the selected chain
        await this.setChainVisibility(pdbIdUpper, chainId, true);
        console.log(`- Showing polymer chain: ${chainId}`);

        console.log(`Successfully isolated chain ${chainId} in structure ${pdbIdUpper}`);
    }
    // In molstar_controller.tsx - add this method as well

    /**
     * Show all polymer chains in a structure
     */
    async showAllChains(pdbId: string): Promise<void> {
        if (!this.viewer.ctx) return;

        const state = this.getState();
        const pdbIdUpper = pdbId.toUpperCase();
        const components = state.molstarRefs.components;

        // Get all polymer components for this structure
        const polymerComponents = Object.entries(components)
            .filter(([, component]) =>
                component.type === 'polymer' &&
                component.pdbId === pdbIdUpper
            )
            .map(([key, component]) => ({
                key,
                component: component as PolymerComponent
            }));

        // Show all chains
        for (const { key, component } of polymerComponents) {
            await this.setChainVisibility(pdbIdUpper, component.chainId, true);
        }

        console.log(`Showing all chains in structure ${pdbIdUpper}`);
    }
}