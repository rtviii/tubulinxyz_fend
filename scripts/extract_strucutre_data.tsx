// scripts_and_artifacts/extract_structure_data.tsx

import { HeadlessPluginContext } from 'molstar/lib/mol-plugin/headless-plugin-context';
import { DefaultPluginSpec } from 'molstar/lib/mol-plugin/spec';
import { MolScriptBuilder as MS } from 'molstar/lib/mol-script/language/builder';
import { StructureElement, StructureProperties, StructureSelection, QueryContext, Structure, Unit } from 'molstar/lib/mol-model/structure';
import { compile } from 'molstar/lib/mol-script/runtime/query/compiler';
import { InteractionsProvider } from 'molstar/lib/mol-model-props/computed/interactions';
import { interactionTypeLabel } from 'molstar/lib/mol-model-props/computed/interactions/common';
import { Features } from 'molstar/lib/mol-model-props/computed/interactions/features';
import { SyncRuntimeContext } from 'molstar/lib/mol-task/execution/synchronous';
import { AssetManager } from 'molstar/lib/mol-util/assets';
import { OrderedSet } from 'molstar/lib/mol-data/int';

import gl from 'gl';
import pngjs from 'pngjs';
import jpegjs from 'jpeg-js';

import * as fs from 'fs/promises';
import * as path from 'path';

// ============================================================
// Output Types
// ============================================================

interface ObservedResidue {
    auth_seq_id: number;
    label_seq_id: number;
    comp_id: string;
    one_letter: string;
}

interface ObservedSequenceData {
    auth_asym_id: string;
    entity_id: string;
    residues: ObservedResidue[];
}

// Ligand types (same as extract_ixs.tsx)
type ParticipantTuple = [string, number, string, string, boolean];

interface Interaction {
    type: string;
    participants: [ParticipantTuple, ParticipantTuple];
}

interface LigandNeighborhood {
    ligand: [string, number, string];  // [auth_asym_id, auth_seq_id, comp_id]
    interactions: Interaction[];
    neighborhood: [string, number, string][];  // [auth_asym_id, auth_seq_id, comp_id][]
}

interface ExtractionResult {
    rcsb_id: string;
    sequences: ObservedSequenceData[];
    ligand_neighborhoods: LigandNeighborhood[];
}

// ============================================================
// Residue Conversion
// ============================================================

const STANDARD_AA: Record<string, string> = {
    'ALA': 'A', 'ARG': 'R', 'ASN': 'N', 'ASP': 'D', 'CYS': 'C',
    'GLU': 'E', 'GLN': 'Q', 'GLY': 'G', 'HIS': 'H', 'ILE': 'I',
    'LEU': 'L', 'LYS': 'K', 'MET': 'M', 'PHE': 'F', 'PRO': 'P',
    'SER': 'S', 'THR': 'T', 'TRP': 'W', 'TYR': 'Y', 'VAL': 'V',
};

const MODIFIED_AA: Record<string, string> = {
    'MSE': 'M', 'CSX': 'C', 'CSO': 'C', 'SEP': 'S', 'TPO': 'T',
    'PTR': 'Y', 'KCX': 'K', 'LLP': 'K', 'PCA': 'E', 'HIC': 'H',
    'MLY': 'K', 'M3L': 'K', 'ALY': 'K', 'CGU': 'E', 'CME': 'C',
};

function toOneLetter(compId: string): string | null {
    const upper = compId.toUpperCase();
    return STANDARD_AA[upper] ?? MODIFIED_AA[upper] ?? null;
}

// ============================================================
// Sequence Extraction
// ============================================================

function extractObservedSequences(structure: Structure): ObservedSequenceData[] {
    const chainDataMap = new Map<string, ObservedSequenceData>();
    
    for (const unit of structure.units) {
        // Only process protein polymers
        if (!Unit.isAtomic(unit)) continue;
        
        const loc = StructureElement.Location.create(structure, unit, unit.elements[0]);
        const seenResidues = new Set<string>();
        
        for (let i = 0; i < unit.elements.length; i++) {
            loc.element = unit.elements[i];
            
            const authAsymId = StructureProperties.chain.auth_asym_id(loc);
            const entityId = StructureProperties.entity.id(loc);
            const authSeqId = StructureProperties.residue.auth_seq_id(loc);
            const labelSeqId = StructureProperties.residue.label_seq_id(loc);
            const compId = StructureProperties.atom.auth_comp_id(loc);
            
            // Skip non-protein or already-seen residues
            const resKey = `${authAsymId}:${authSeqId}`;
            if (seenResidues.has(resKey)) continue;
            
            const oneLetter = toOneLetter(compId);
            if (!oneLetter) continue;  // Not a standard/modified amino acid
            
            seenResidues.add(resKey);
            
            // Initialize chain data if needed
            if (!chainDataMap.has(authAsymId)) {
                chainDataMap.set(authAsymId, {
                    auth_asym_id: authAsymId,
                    entity_id: String(entityId),
                    residues: []
                });
            }
            
            chainDataMap.get(authAsymId)!.residues.push({
                auth_seq_id: authSeqId,
                label_seq_id: labelSeqId,
                comp_id: compId,
                one_letter: oneLetter
            });
        }
    }
    
    // Sort residues by auth_seq_id within each chain
    for (const chainData of chainDataMap.values()) {
        chainData.residues.sort((a, b) => a.auth_seq_id - b.auth_seq_id);
    }
    
    return Array.from(chainDataMap.values());
}

// ============================================================
// Ligand Extraction (adapted from extract_ixs.tsx)
// ============================================================

const SKIP_LIGANDS = new Set([
    'HOH', 'DOD', 'WAT', 'NA', 'CL', 'K', 'MG', 'CA', 'ZN', 'FE', "MG",
    'MN', 'CO', 'NI', 'CU', 'SO4', 'PO4', 'NO3', 'CO3', 'GOL', 
    
]);

interface LigandInstance {
    compId: string;
    authAsymId: string;
    authSeqId: number;
}

function findLigandInstances(structure: Structure): LigandInstance[] {
    const ligands: LigandInstance[] = [];
    const seen = new Set<string>();
    
    for (const unit of structure.units) {
        if (!Unit.isAtomic(unit)) continue;
        
        const loc = StructureElement.Location.create(structure, unit, unit.elements[0]);
        
        for (let i = 0; i < unit.elements.length; i++) {
            loc.element = unit.elements[i];
            
            const compId = StructureProperties.atom.auth_comp_id(loc);
            
            // Skip if it's a protein residue or skipped ligand
            if (toOneLetter(compId) !== null) continue;
            if (SKIP_LIGANDS.has(compId.toUpperCase())) continue;
            
            const authAsymId = StructureProperties.chain.auth_asym_id(loc);
            const authSeqId = StructureProperties.residue.auth_seq_id(loc);
            
            const key = `${compId}_${authAsymId}_${authSeqId}`;
            if (seen.has(key)) continue;
            seen.add(key);
            
            ligands.push({ compId, authAsymId, authSeqId });
        }
    }
    
    return ligands;
}

function getAtomInfoFromFeature(
    structure: Structure,
    unit: Unit,
    featureIndex: number,
    features: Features
): { auth_asym_id: string; auth_seq_id: number; auth_comp_id: string; atom_id: string } {
    const atomIndex = features.members[features.offsets[featureIndex]];
    const elementIndex = unit.elements[atomIndex];
    const loc = StructureElement.Location.create(structure, unit, elementIndex);

    return {
        auth_asym_id: StructureProperties.chain.auth_asym_id(loc),
        auth_seq_id: StructureProperties.residue.auth_seq_id(loc),
        auth_comp_id: StructureProperties.atom.auth_comp_id(loc),
        atom_id: StructureProperties.atom.label_atom_id(loc)
    };
}

async function extractLigandNeighborhood(
    plugin: HeadlessPluginContext,
    structure: Structure,
    ligand: LigandInstance
): Promise<LigandNeighborhood | null> {
    try {
        // Build query for this specific ligand
        const ligandQuery = MS.struct.generator.atomGroups({
            'residue-test': MS.core.logic.and([
                MS.core.rel.eq([MS.ammp('auth_seq_id'), ligand.authSeqId]),
                MS.core.rel.eq([MS.ammp('auth_comp_id'), ligand.compId])
            ]),
            'chain-test': MS.core.rel.eq([MS.ammp('auth_asym_id'), ligand.authAsymId])
        });

        // Get surroundings
        const surroundingsExpr = MS.struct.modifier.includeSurroundings({
            0: ligandQuery,
            radius: 5,
            'as-whole-residues': true
        });

        const surroundingsQuery = compile(surroundingsExpr);
        const surroundingsSelection = surroundingsQuery(new QueryContext(structure));
        const neighborhoodStructure = StructureSelection.unionStructure(surroundingsSelection);

        if (neighborhoodStructure.elementCount === 0) {
            return null;
        }

        // Find ligand atoms in neighborhood
        let ligandUnitId: number | null = null;
        let ligandIndices: OrderedSet | null = null;

        for (const unit of neighborhoodStructure.units) {
            const atomIndices: number[] = [];
            const loc = StructureElement.Location.create(neighborhoodStructure, unit, unit.elements[0]);

            for (let i = 0; i < unit.elements.length; i++) {
                loc.element = unit.elements[i];
                if (StructureProperties.chain.auth_asym_id(loc) === ligand.authAsymId &&
                    StructureProperties.residue.auth_seq_id(loc) === ligand.authSeqId &&
                    StructureProperties.atom.auth_comp_id(loc) === ligand.compId) {
                    atomIndices.push(i);
                }
            }

            if (atomIndices.length > 0) {
                ligandUnitId = unit.id;
                ligandIndices = OrderedSet.ofSortedArray(atomIndices.sort((a, b) => a - b));
                break;
            }
        }

        if (ligandUnitId === null || ligandIndices === null) {
            return null;
        }

        // Compute interactions
        const ctx = { runtime: SyncRuntimeContext, assetManager: new AssetManager() };
        const interactionParams = {
            providers: {
                'ionic': { name: 'on', params: { distanceMax: 5.0 } },
                'cation-pi': { name: 'on', params: { distanceMax: 6.0 } },
                'pi-stacking': { name: 'on', params: { distanceMax: 5.5, offsetMax: 2.0, angleDevMax: 30 } },
                'hydrogen-bonds': { name: 'on', params: { distanceMax: 3.5, angleMax: 45, water: false, sulfurDistanceMax: 4.1 } },
                'halogen-bonds': { name: 'on', params: { distanceMax: 4.0, angleMax: 30 } },
                'hydrophobic': { name: 'on', params: { distanceMax: 4.0 } },
                'metal-coordination': { name: 'on', params: { distanceMax: 2.5 } },
                'weak-hydrogen-bonds': { name: 'on', params: { distanceMax: 3.5, angleMax: 45 } },
            }
        };

        await InteractionsProvider.attach(ctx, neighborhoodStructure, interactionParams, true);
        const interactions = InteractionsProvider.get(neighborhoodStructure).value;

        const resultInteractions: Interaction[] = [];
        const seen = new Set<string>();

        if (interactions) {
            const { contacts, unitsFeatures } = interactions;

            const isAtomInLigand = (unitId: number, featureIndex: number, features: Features): boolean => {
                if (unitId !== ligandUnitId) return false;
                const atomIndex = features.members[features.offsets[featureIndex]];
                return OrderedSet.has(ligandIndices!, atomIndex);
            };

            for (const bond of contacts.edges) {
                const unitA = neighborhoodStructure.unitMap.get(bond.unitA);
                const unitB = neighborhoodStructure.unitMap.get(bond.unitB);
                if (!unitA || !unitB) continue;

                const featuresA = unitsFeatures.get(bond.unitA);
                const featuresB = unitsFeatures.get(bond.unitB);
                if (!featuresA || !featuresB) continue;

                const isALigand = isAtomInLigand(bond.unitA, bond.indexA, featuresA);
                const isBLigand = isAtomInLigand(bond.unitB, bond.indexB, featuresB);

                if ((isALigand && !isBLigand) || (!isALigand && isBLigand)) {
                    const atomA = getAtomInfoFromFeature(neighborhoodStructure, unitA, bond.indexA, featuresA);
                    const atomB = getAtomInfoFromFeature(neighborhoodStructure, unitB, bond.indexB, featuresB);

                    const keyParts = [
                        `${atomA.auth_asym_id}:${atomA.auth_seq_id}:${atomA.atom_id}`,
                        `${atomB.auth_asym_id}:${atomB.auth_seq_id}:${atomB.atom_id}`
                    ].sort();
                    const key = `${bond.props.type}:${keyParts[0]}:${keyParts[1]}`;

                    if (!seen.has(key)) {
                        seen.add(key);
                        resultInteractions.push({
                            type: interactionTypeLabel(bond.props.type),
                            participants: [
                                [atomA.auth_asym_id, atomA.auth_seq_id, atomA.auth_comp_id, atomA.atom_id, isALigand],
                                [atomB.auth_asym_id, atomB.auth_seq_id, atomB.auth_comp_id, atomB.atom_id, isBLigand]
                            ]
                        });
                    }
                }
            }
        }

        // Extract neighborhood residues (excluding ligand)
        const neighborhoodResidues: [string, number, string][] = [];
        const seenRes = new Set<string>();

        for (const unit of neighborhoodStructure.units) {
            const loc = StructureElement.Location.create(neighborhoodStructure, unit, unit.elements[0]);

            for (let i = 0; i < unit.elements.length; i++) {
                loc.element = unit.elements[i];

                const authAsymId = StructureProperties.chain.auth_asym_id(loc);
                const authSeqId = StructureProperties.residue.auth_seq_id(loc);
                const compId = StructureProperties.atom.auth_comp_id(loc);

                // Skip ligand itself
                if (authAsymId === ligand.authAsymId &&
                    authSeqId === ligand.authSeqId &&
                    compId === ligand.compId) continue;

                const key = `${authAsymId}:${authSeqId}:${compId}`;
                if (!seenRes.has(key)) {
                    seenRes.add(key);
                    neighborhoodResidues.push([authAsymId, authSeqId, compId]);
                }
            }
        }

        return {
            ligand: [ligand.authAsymId, ligand.authSeqId, ligand.compId],
            interactions: resultInteractions,
            neighborhood: neighborhoodResidues
        };

    } catch (e) {
        console.error(`Error extracting ligand ${ligand.compId}_${ligand.authAsymId}: ${e}`);
        return null;
    }
}

// ============================================================
// Main
// ============================================================

async function runExtraction(cifPath: string, rcsbId: string, outputPath: string) {
    const externalModules = { gl, pngjs, 'jpeg-js': jpegjs };
    const spec = DefaultPluginSpec();

    const plugin = new HeadlessPluginContext(externalModules, spec, { width: 800, height: 600 });
    await plugin.init();

    try {
        console.error(`Loading: ${cifPath}`);
        const fileContent = await fs.readFile(cifPath, 'utf8');

        const data = await plugin.builders.data.rawData({ data: fileContent, label: 'CIF Data' });
        const trajectory = await plugin.builders.structure.parseTrajectory(data, 'mmcif');
        const model = await plugin.builders.structure.createModel(trajectory);
        const structureNode = await plugin.builders.structure.createStructure(model);

        const structure = structureNode.data;
        if (!structure) throw new Error("Could not retrieve structure data");

        // 1. Extract observed sequences
        console.error(`Extracting sequences...`);
        const sequences = extractObservedSequences(structure);
        console.error(`  Found ${sequences.length} polymer chains`);

        // 2. Find and process ligands
        console.error(`Extracting ligand neighborhoods...`);
        const ligandInstances = findLigandInstances(structure);
        console.error(`  Found ${ligandInstances.length} ligand instances`);

        const ligandNeighborhoods: LigandNeighborhood[] = [];
        for (const lig of ligandInstances) {
            const neighborhood = await extractLigandNeighborhood(plugin, structure, lig);
            if (neighborhood) {
                ligandNeighborhoods.push(neighborhood);
                console.error(`    ${lig.compId}_${lig.authAsymId}: ${neighborhood.interactions.length} interactions`);
            }
        }

        // 3. Assemble result
        const result: ExtractionResult = {
            rcsb_id: rcsbId.toUpperCase(),
            sequences,
            ligand_neighborhoods: ligandNeighborhoods
        };

        // 4. Write output
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, JSON.stringify(result, null, 2));
        console.error(`Success! Written to ${outputPath}`);

    } catch (e) {
        console.error("Error:", e);
        process.exit(1);
    } finally {
        plugin.dispose();
    }
}

// Entry point
const args = process.argv.slice(2);
if (args.length < 3) {
    console.error("Usage: npx tsx extract_structure_data.tsx <cif_path> <rcsb_id> <output_json>");
    process.exit(1);
}

runExtraction(args[0], args[1], args[2]);