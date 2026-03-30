/**
 * Landing page demo library.
 */

import type { MolstarInstance } from '@/components/molstar/services/MolstarInstance';
import type { DemoExplanation, DemoTab } from './DemoExplanationCard';
import { API_BASE_URL } from '@/config';
import { Color } from 'molstar/lib/mol-util/color';
import { StructureElement, StructureProperties, Structure } from 'molstar/lib/mol-model/structure';
import { MolScriptBuilder as MS } from 'molstar/lib/mol-script/language/builder';
import { computeInteractions } from 'molstar/lib/mol-model-props/computed/interactions/interactions';
import { interactionTypeLabel } from 'molstar/lib/mol-model-props/computed/interactions/common';
import { Task } from 'molstar/lib/mol-task';
import {
  buildChainQuery,
  buildSurroundingsQuery,
  buildMultiResidueQuery,
  executeQuery,
} from '@/components/molstar/core/queries';
import { STYLIZED_POSTPROCESSING } from '@/components/molstar/rendering/postprocessing-config';
import { getMolstarGhostColor, getGhostHexForFamily } from '@/components/molstar/colors/palette';

export type DemoCategory = 'ligands' | 'contacts' | 'modifications' | 'mutations';
export type DemoCleanup = () => void;

export interface DemoResult {
  cleanup: DemoCleanup;
  explanation: DemoExplanation | null;
}

export interface LandingDemoContext {
  heterodimer: MolstarInstance | null;
  lattice: MolstarInstance | null;
}

export interface LandingDemo {
  id: string;
  label: string;
  description: string;
  category: DemoCategory;
  target?: string | null;
  run: (ctx: LandingDemoContext) => Promise<DemoResult>;
}

// ── Constants ──

const DEMO_COLOR_ACCENT = Color(0xD94A8C);
const DEMO_COLOR_PTM = Color(0x22C55E);
const DEMO_COLOR_MUT = Color(0xEF4444);
const DEMO_COLOR_TAIL_A = Color(0x5B8DEF);
const DEMO_COLOR_TAIL_B = Color(0xE8944A);

const NUCLEOTIDE_COMP_IDS = new Set([
  'GTP', 'GDP', 'GNP', 'GSP', 'GMPPCP', 'GMPPNP', 'GPPNHP', 'GTPS',
  'ATP', 'ADP', 'ANP', 'ACP',
]);

function noop() {}

// ── Helpers ──

async function restoreInstance(instance: MolstarInstance | null) {
  if (!instance) return;
  try {
    await instance.restoreDefaultColors();
    instance.removeAllExplorerLabels();
    await instance.setStructureGhostColors(true);
  } catch (e) {
    console.warn('[demo] restore failed:', e);
  }
}

async function deleteRefs(instance: MolstarInstance | null, refs: string[]) {
  const plugin = instance?.viewer?.ctx;
  if (!plugin) return;
  for (const ref of refs) {
    try { await plugin.build().delete(ref).commit(); } catch { /* gone */ }
  }
}

function applyPostprocessing(instance: MolstarInstance | null) {
  const plugin = instance?.viewer?.ctx;
  if (!plugin?.canvas3d) return;
  plugin.canvas3d.setProps({
    postprocessing: STYLIZED_POSTPROCESSING,
    renderer: { pickingAlphaThreshold: 0.1 },
  });
}

function getLigandComponents(instance: MolstarInstance, instanceId: string) {
  const store = instance['getState']();
  const components = store.molstarInstances.instances[instanceId]?.components ?? {};
  const result: { key: string; compId: string; authAsymId: string; authSeqId: number }[] = [];
  for (const [key, comp] of Object.entries(components)) {
    if ((comp as any).type === 'ligand') {
      result.push({ key, compId: (comp as any).compId, authAsymId: (comp as any).authAsymId, authSeqId: (comp as any).authSeqId });
    }
  }
  return result;
}

function getPolymerChainIds(instance: MolstarInstance, instanceId: string): string[] {
  const store = instance['getState']();
  const components = store.molstarInstances.instances[instanceId]?.components ?? {};
  const chains: string[] = [];
  for (const [, comp] of Object.entries(components)) {
    if ((comp as any).type === 'polymer') chains.push((comp as any).chainId);
  }
  return chains;
}

function getClassification(instance: MolstarInstance, instanceId: string): Record<string, string> {
  const store = instance['getState']();
  return store.molstarInstances.instances[instanceId]?.tubulinClassification ?? {};
}

/** Build a chainId -> hex color map for the explanation card chain dots */
function buildChainColors(classification: Record<string, string>, chainIds: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const id of chainIds) result[id] = getGhostHexForFamily(classification[id]);
  return result;
}

export interface BondPairInfo {
  residueA: { chainId: string; authSeqId: number; compId: string };
  residueB: { chainId: string; authSeqId: number; compId: string };
  type: string;
}

interface ChainBondResidues {
  residuesA: Set<number>;
  residuesB: Set<number>;
  bondCount: number;
  pairs: BondPairInfo[];
}

/**
 * Run Molstar's interaction computation on the structure.
 * Returns the raw Interactions object for downstream extraction.
 */
async function computeStructureInteractions(plugin: any, structure: Structure): Promise<any> {
  let interactions: any;
  await plugin.runTask(Task.create('Compute interactions', async (runtime: any) => {
    interactions = await computeInteractions(
      { runtime, assetManager: plugin.managers.asset },
      structure,
      {},
    );
  }));
  return interactions ?? null;
}

/**
 * Given pre-computed interactions, extract the residues that participate in
 * non-covalent bonds between two specific chains.
 */
function extractInterChainBonds(
  structure: Structure,
  interactions: any,
  chainA: string,
  chainB: string,
): ChainBondResidues {
  const residuesA = new Set<number>();
  const residuesB = new Set<number>();
  const pairs: BondPairInfo[] = [];
  let bondCount = 0;

  if (!interactions) return { residuesA, residuesB, bondCount, pairs };

  const { contacts, unitsFeatures } = interactions;

  // Cache unit-id -> { chainId, isPolymer }
  const unitInfoCache = new Map<number, { chainId: string; isPolymer: boolean }>();
  function getUnitInfo(unitId: number): { chainId: string; isPolymer: boolean } {
    if (unitInfoCache.has(unitId)) return unitInfoCache.get(unitId)!;
    const unit = structure.unitMap.get(unitId);
    const loc = StructureElement.Location.create(structure, unit, unit.elements[0]);
    const info = {
      chainId: StructureProperties.chain.auth_asym_id(loc),
      isPolymer: StructureProperties.entity.type(loc) === 'polymer',
    };
    unitInfoCache.set(unitId, info);
    return info;
  }

  for (let i = 0; i < contacts.edgeCount; i++) {
    const edge = contacts.edges[i];
    const { unitA: uIdA, indexA, unitB: uIdB, indexB } = edge;

    const infoA = getUnitInfo(uIdA);
    const infoB = getUnitInfo(uIdB);

    // Skip non-polymer units (waters, ions, ligands)
    if (!infoA.isPolymer || !infoB.isPolymer) continue;

    let swapped = false;
    if (infoA.chainId === chainA && infoB.chainId === chainB) { /* ok */ }
    else if (infoA.chainId === chainB && infoB.chainId === chainA) { swapped = true; }
    else continue;

    const uA = structure.unitMap.get(uIdA);
    const uB = structure.unitMap.get(uIdB);
    const fA = unitsFeatures.get(uIdA);
    const fB = unitsFeatures.get(uIdB);
    if (!fA || !fB) continue;

    const memberA = fA.members[fA.offsets[indexA]];
    const memberB = fB.members[fB.offsets[indexB]];

    const locA = StructureElement.Location.create(structure, uA, uA.elements[memberA]);
    const locB = StructureElement.Location.create(structure, uB, uB.elements[memberB]);

    // Double-check both sides are polymer residues at the element level too
    if (StructureProperties.entity.type(locA) !== 'polymer') continue;
    if (StructureProperties.entity.type(locB) !== 'polymer') continue;

    const seqA = StructureProperties.residue.auth_seq_id(locA);
    const seqB = StructureProperties.residue.auth_seq_id(locB);
    const compIdA = StructureProperties.atom.label_comp_id(locA);
    const compIdB = StructureProperties.atom.label_comp_id(locB);
    const typeLabel = interactionTypeLabel(edge.props.type);

    bondCount++;

    if (!swapped) {
      residuesA.add(seqA);
      residuesB.add(seqB);
      pairs.push({
        residueA: { chainId: chainA, authSeqId: seqA, compId: compIdA },
        residueB: { chainId: chainB, authSeqId: seqB, compId: compIdB },
        type: typeLabel,
      });
    } else {
      residuesA.add(seqB);
      residuesB.add(seqA);
      pairs.push({
        residueA: { chainId: chainA, authSeqId: seqB, compId: compIdB },
        residueB: { chainId: chainB, authSeqId: seqA, compId: compIdA },
        type: typeLabel,
      });
    }
  }

  return { residuesA, residuesB, bondCount, pairs };
}

export interface LigandBondInfo {
  /** Polymer residue that contacts the ligand */
  residue: { chainId: string; authSeqId: number; compId: string };
  type: string;
}

/**
 * Given pre-computed interactions, extract polymer residues that form
 * non-covalent bonds with a specific ligand (identified by compId + authSeqId + chainId).
 */
function extractLigandBonds(
  structure: Structure,
  interactions: any,
  ligandCompId: string,
  ligandChainId: string,
  ligandSeqId: number,
): { residues: Set<number>; bondCount: number; contacts: LigandBondInfo[] } {
  const residues = new Set<number>();
  const contacts: LigandBondInfo[] = [];
  let bondCount = 0;

  if (!interactions) return { residues, bondCount, contacts };

  const { contacts: interContacts, unitsFeatures } = interactions;

  // Cache unit info
  const unitInfoCache = new Map<number, { chainId: string; isPolymer: boolean }>();
  function getUnitInfo(unitId: number): { chainId: string; isPolymer: boolean } {
    if (unitInfoCache.has(unitId)) return unitInfoCache.get(unitId)!;
    const unit = structure.unitMap.get(unitId);
    const loc = StructureElement.Location.create(structure, unit, unit.elements[0]);
    const info = {
      chainId: StructureProperties.chain.auth_asym_id(loc),
      isPolymer: StructureProperties.entity.type(loc) === 'polymer',
    };
    unitInfoCache.set(unitId, info);
    return info;
  }

  for (let i = 0; i < interContacts.edgeCount; i++) {
    const edge = interContacts.edges[i];
    const { unitA: uIdA, indexA, unitB: uIdB, indexB } = edge;

    const uA = structure.unitMap.get(uIdA);
    const uB = structure.unitMap.get(uIdB);
    const fA = unitsFeatures.get(uIdA);
    const fB = unitsFeatures.get(uIdB);
    if (!fA || !fB) continue;

    const memberA = fA.members[fA.offsets[indexA]];
    const memberB = fB.members[fB.offsets[indexB]];

    const locA = StructureElement.Location.create(structure, uA, uA.elements[memberA]);
    const locB = StructureElement.Location.create(structure, uB, uB.elements[memberB]);

    const compA = StructureProperties.atom.label_comp_id(locA);
    const compB = StructureProperties.atom.label_comp_id(locB);
    const chainA = StructureProperties.chain.auth_asym_id(locA);
    const chainB = StructureProperties.chain.auth_asym_id(locB);
    const seqA = StructureProperties.residue.auth_seq_id(locA);
    const seqB = StructureProperties.residue.auth_seq_id(locB);

    const typeLabel = interactionTypeLabel(edge.props.type);

    // Check if side A is the ligand and side B is polymer (or vice versa)
    let polymerLoc: typeof locA | null = null;
    let polymerChain: string | null = null;
    let polymerSeq = 0;
    let polymerComp = '';

    if (compA === ligandCompId && chainA === ligandChainId && seqA === ligandSeqId) {
      const infoB = getUnitInfo(uIdB);
      if (infoB.isPolymer && StructureProperties.entity.type(locB) === 'polymer') {
        polymerChain = chainB;
        polymerSeq = seqB;
        polymerComp = compB;
      }
    } else if (compB === ligandCompId && chainB === ligandChainId && seqB === ligandSeqId) {
      const infoA = getUnitInfo(uIdA);
      if (infoA.isPolymer && StructureProperties.entity.type(locA) === 'polymer') {
        polymerChain = chainA;
        polymerSeq = seqA;
        polymerComp = compA;
      }
    }

    if (polymerChain) {
      bondCount++;
      residues.add(polymerSeq);
      contacts.push({
        residue: { chainId: polymerChain, authSeqId: polymerSeq, compId: polymerComp },
        type: typeLabel,
      });
    }
  }

  // Also check intra-unit contacts (ligand and polymer in same unit)
  for (const unit of structure.units) {
    const unitFeatures = interactions.unitsFeatures.get(unit.id);
    const unitContacts = interactions.unitsContacts.get(unit.id);
    if (!unitFeatures || !unitContacts) continue;

    for (let ei = 0; ei < unitContacts.edgeCount; ei++) {
      const idxA = unitContacts.a[ei];
      const idxB = unitContacts.b[ei];

      const mA = unitFeatures.members[unitFeatures.offsets[idxA]];
      const mB = unitFeatures.members[unitFeatures.offsets[idxB]];

      const locI = StructureElement.Location.create(structure, unit, unit.elements[mA]);
      const locJ = StructureElement.Location.create(structure, unit, unit.elements[mB]);

      const cI = StructureProperties.atom.label_comp_id(locI);
      const cJ = StructureProperties.atom.label_comp_id(locJ);
      const chI = StructureProperties.chain.auth_asym_id(locI);
      const chJ = StructureProperties.chain.auth_asym_id(locJ);
      const sI = StructureProperties.residue.auth_seq_id(locI);
      const sJ = StructureProperties.residue.auth_seq_id(locJ);

      const typeLabel = interactionTypeLabel(unitContacts.edgeProps.type[ei]);

      if (cI === ligandCompId && chI === ligandChainId && sI === ligandSeqId) {
        if (StructureProperties.entity.type(locJ) === 'polymer') {
          bondCount++;
          residues.add(sJ);
          contacts.push({ residue: { chainId: chJ, authSeqId: sJ, compId: cJ }, type: typeLabel });
        }
      } else if (cJ === ligandCompId && chJ === ligandChainId && sJ === ligandSeqId) {
        if (StructureProperties.entity.type(locI) === 'polymer') {
          bondCount++;
          residues.add(sI);
          contacts.push({ residue: { chainId: chI, authSeqId: sI, compId: cI }, type: typeLabel });
        }
      }
    }
  }

  return { residues, bondCount, contacts };
}

// Keep the old proximity-based helper as fallback
function getInterfaceResidues(structure: any, chainA: string, chainB: string): number[] {
  const surroundsExpr = buildSurroundingsQuery(buildChainQuery(chainA), 4.0);
  const loci = executeQuery(surroundsExpr, structure);
  if (!loci) return [];
  const ids = new Set<number>();
  StructureElement.Loci.forEachLocation(loci, (loc) => {
    if (StructureProperties.chain.auth_asym_id(loc) === chainB) {
      ids.add(StructureProperties.residue.auth_seq_id(loc));
    }
  });
  return Array.from(ids);
}

// ── Demo: GDP / GTP ──

const NUC_COLOR_GTP = Color(0x1565C0); // deep blue
const NUC_COLOR_GDP = Color(0xE65100); // deep orange
const NUC_HEX_GTP = '#1565C0';
const NUC_HEX_GDP = '#E65100';

/** Is this a GTP-type nucleotide? (vs GDP-type) */
function isGtpLike(compId: string): boolean {
  return ['GTP', 'GNP', 'GSP', 'GMPPCP', 'GMPPNP', 'GPPNHP', 'GTPS', 'ATP', 'ANP', 'ACP'].includes(compId);
}

async function showGdpGtp(ctx: LandingDemoContext): Promise<DemoResult> {
  const inst = ctx.heterodimer;
  if (!inst) return { cleanup: noop, explanation: null };

  const plugin = inst.viewer.ctx;
  const structure = inst.viewer.getCurrentStructure();
  if (!plugin || !structure) return { cleanup: noop, explanation: null };

  const hierarchy = plugin.managers.structure.hierarchy.current;
  if (hierarchy.structures.length === 0) return { cleanup: noop, explanation: null };
  const structureCell = hierarchy.structures[0].cell;

  const ligands = getLigandComponents(inst, 'landing_9mlf');
  const nucleotides = ligands.filter(l => NUCLEOTIDE_COMP_IDS.has(l.compId));
  const createdRefs: string[] = [];

  // Compute interactions once
  let interactions: any;
  try {
    interactions = await computeStructureInteractions(plugin, structure);
  } catch (err) {
    console.warn('[demo] interaction computation failed:', err);
  }

  // Build tabs for each nucleotide
  const tabs: DemoTab[] = [];

  for (const nuc of nucleotides) {
    const isGtp = isGtpLike(nuc.compId);
    const nucColor = isGtp ? NUC_COLOR_GTP : NUC_COLOR_GDP;
    const nucHex = isGtp ? NUC_HEX_GTP : NUC_HEX_GDP;

    // Nucleotide ball-and-stick
    const ligandExpr = MS.struct.generator.atomGroups({
      'residue-test': MS.core.logic.and([
        MS.core.rel.eq([MS.ammp('auth_comp_id'), nuc.compId]),
        MS.core.rel.eq([MS.ammp('auth_asym_id'), nuc.authAsymId]),
        MS.core.rel.eq([MS.ammp('auth_seq_id'), nuc.authSeqId]),
      ]),
    });

    const ligComp = await plugin.builders.structure.tryCreateComponentFromExpression(
      structureCell,
      ligandExpr,
      `demo-nuc-${nuc.key}`,
      { label: nuc.compId },
    );

    if (ligComp) {
      createdRefs.push(ligComp.ref);
      await plugin.builders.structure.representation.addRepresentation(ligComp, {
        type: 'ball-and-stick',
        color: 'uniform',
        colorParams: { value: nucColor },
        typeParams: { sizeFactor: 0.4 },
      });
    }

    // Extract contacting polymer residues
    let ligandContacts: LigandBondInfo[] = [];
    if (interactions) {
      const bondData = extractLigandBonds(structure, interactions, nuc.compId, nuc.authAsymId, nuc.authSeqId);
      ligandContacts = bondData.contacts;

      // Create ball-and-stick for binding pocket residues
      const pocketResidues = Array.from(bondData.residues);
      if (pocketResidues.length > 0) {
        // Determine which polymer chain the ligand sits on
        const pocketChain = nuc.authAsymId;
        const classification = getClassification(inst, 'landing_9mlf');
        const ghostColor = getMolstarGhostColor(classification[pocketChain]);

        const pocketComp = await plugin.builders.structure.tryCreateComponentFromExpression(
          structureCell,
          buildMultiResidueQuery(pocketChain, pocketResidues),
          `demo-nuc-pocket-${nuc.key}`,
          { label: `${nuc.compId} pocket` },
        );
        if (pocketComp) {
          createdRefs.push(pocketComp.ref);
          await plugin.builders.structure.representation.addRepresentation(pocketComp, {
            type: 'ball-and-stick',
            color: 'uniform',
            colorParams: { value: ghostColor },
            typeParams: { sizeFactor: 0.15 },
          });
        }

        // Interaction lines between ligand + pocket
        const ifaceExpr = MS.struct.combinator.merge([
          ligandExpr,
          buildMultiResidueQuery(pocketChain, pocketResidues),
        ]);
        const ifaceComp = await plugin.builders.structure.tryCreateComponentFromExpression(
          structureCell,
          ifaceExpr,
          `demo-nuc-iface-${nuc.key}`,
          { label: `${nuc.compId} interactions` },
        );
        if (ifaceComp) {
          createdRefs.push(ifaceComp.ref);
          try {
            await plugin.builders.structure.representation.addRepresentation(ifaceComp, {
              type: 'interactions',
              color: 'interaction-type',
            });
          } catch { /* ok */ }
        }
      }
    }

    // Label
    const loci = executeQuery(ligandExpr, structure);
    if (loci) {
      await inst.addExplorerLabel(`demo-nuc-label-${nuc.key}`, loci, nuc.compId, nucColor);
    }

    const chainLabel = nuc.authAsymId === 'A' ? 'alpha' : nuc.authAsymId === 'B' ? 'beta' : nuc.authAsymId;
    const gtpDesc = `Bound to ${chainLabel}-tubulin at the non-exchangeable N-site. This GTP is never hydrolyzed and is structurally integral to the fold.`;
    const gdpDesc = `Bound to ${chainLabel}-tubulin at the exchangeable E-site. GTP here is hydrolyzed upon polymerization, driving microtubule dynamics.`;

    tabs.push({
      label: nuc.compId,
      description: isGtp ? gtpDesc : gdpDesc,
      color: nucHex,
      ligandContacts,
      ligandChainId: nuc.authAsymId,
      ligandSeqId: nuc.authSeqId,
      ligandCompId: nuc.compId,
    });
  }

  applyPostprocessing(inst);

  if (createdRefs.length === 0) {
    return {
      cleanup: noop,
      explanation: {
        title: 'Nucleotide sites',
        body: 'No nucleotide ligands resolved in this structure.',
        target: 'heterodimer',
      },
    };
  }

  return {
    cleanup: () => {
      deleteRefs(inst, createdRefs);
      inst.removeAllExplorerLabels();
      inst.viewer.highlightLoci(null);
      applyPostprocessing(inst);
    },
    explanation: {
      title: 'Nucleotide binding',
      body: 'Each tubulin monomer binds one guanine nucleotide. Hover residues to see contacts.',
      target: 'heterodimer',
      tabs,
      chainColors: buildChainColors(getClassification(inst, 'landing_9mlf'), ['A', 'B']),
    },
  };
}

// ── Demo: Taxol binding ──

async function showTaxol(ctx: LandingDemoContext): Promise<DemoResult> {
  const inst = ctx.heterodimer;
  if (!inst) return { cleanup: noop, explanation: null };

  try {
    const res = await fetch(`${API_BASE_URL}/ligands/neighborhoods/9MLF/B`);
    if (!res.ok) throw new Error(`Neighborhoods ${res.status}`);
    const data = await res.json();
    const neighborhoods = data.neighborhoods ?? [];

    let target = neighborhoods.find((n: any) =>
      ['TXL', 'TA1', 'TAX'].includes((n.ligand_id ?? '').toUpperCase())
    );
    if (!target) {
      target = neighborhoods
        .filter((n: any) => !NUCLEOTIDE_COMP_IDS.has((n.ligand_id ?? '').toUpperCase()))
        .sort((a: any, b: any) => (b.residue_count ?? 0) - (a.residue_count ?? 0))[0];
    }
    if (!target || !target.residues?.length) {
      return { cleanup: noop, explanation: null };
    }

    const residues = target.residues as { auth_asym_id: string; auth_seq_id: number }[];
    const ligandName = target.ligand_name ?? target.ligand_id ?? 'Drug';

    const colorings = residues.map(r => ({
      chainId: r.auth_asym_id,
      authSeqId: r.auth_seq_id,
      color: DEMO_COLOR_ACCENT,
    }));
    await inst.applyColorscheme('demo-taxol', colorings);

    // Also create a representation for the drug ligand itself
    const plugin = inst.viewer.ctx;
    const structure = inst.viewer.getCurrentStructure();
    const createdRefs: string[] = [];

    if (plugin && structure) {
      const hierarchy = plugin.managers.structure.hierarchy.current;
      if (hierarchy.structures.length > 0) {
        const structureCell = hierarchy.structures[0].cell;
        const ligandExpr = MS.struct.generator.atomGroups({
          'residue-test': MS.core.logic.and([
            MS.core.rel.eq([MS.ammp('auth_comp_id'), target.ligand_id]),
            MS.core.rel.eq([MS.ammp('auth_asym_id'), target.ligand_auth_asym_id]),
            MS.core.rel.eq([MS.ammp('auth_seq_id'), target.ligand_auth_seq_id]),
          ]),
        });
        const comp = await plugin.builders.structure.tryCreateComponentFromExpression(
          structureCell,
          ligandExpr,
          `demo-drug-${target.ligand_id}`,
          { label: ligandName },
        );
        if (comp) {
          createdRefs.push(comp.ref);
          await plugin.builders.structure.representation.addRepresentation(comp, {
            type: 'ball-and-stick',
            color: 'uniform',
            colorParams: { value: DEMO_COLOR_ACCENT },
            typeParams: { sizeFactor: 0.4 },
          });
        }
      }
    }

    return {
      cleanup: () => {
        restoreInstance(inst);
        deleteRefs(inst, createdRefs);
      },
      explanation: {
        title: `${ligandName} binding pocket`,
        body: `${residues.length} residues in the binding pocket on beta-tubulin. The taxane site stabilizes lateral contacts in the microtubule lattice.`,
        target: 'heterodimer',
      },
    };
  } catch (e) {
    console.error('[demo] showTaxol failed:', e);
    return { cleanup: noop, explanation: null };
  }
}

// ── Demo: Intra-dimer contacts ──

async function showIntraDimerContacts(ctx: LandingDemoContext): Promise<DemoResult> {
  const inst = ctx.heterodimer;
  if (!inst) return { cleanup: noop, explanation: null };

  const structure = inst.viewer.getCurrentStructure();
  const plugin = inst.viewer.ctx;
  if (!structure || !plugin) return { cleanup: noop, explanation: null };

  const hierarchy = plugin.managers.structure.hierarchy.current;
  if (hierarchy.structures.length === 0) return { cleanup: noop, explanation: null };
  const structureCell = hierarchy.structures[0].cell;
  const createdRefs: string[] = [];

  // Compute actual non-covalent bonds between chains A and B
  let bonds: ChainBondResidues;
  try {
    const interactions = await computeStructureInteractions(plugin, structure);
    bonds = extractInterChainBonds(structure, interactions, 'A', 'B');
  } catch (err) {
    console.warn('[demo] interaction computation failed:', err);
    return { cleanup: noop, explanation: null };
  }

  if (bonds.residuesA.size === 0 && bonds.residuesB.size === 0) {
    return { cleanup: noop, explanation: null };
  }

  const residuesAArr = Array.from(bonds.residuesA);
  const residuesBArr = Array.from(bonds.residuesB);

  // Look up ghost colors from the tubulin classification
  const classification = getClassification(inst, 'landing_9mlf');
  const colorA = getMolstarGhostColor(classification['A']);
  const colorB = getMolstarGhostColor(classification['B']);

  // Per-chain ball-and-stick components (inheriting ghost colors)
  if (residuesAArr.length > 0) {
    const compA = await plugin.builders.structure.tryCreateComponentFromExpression(
      structureCell,
      buildMultiResidueQuery('A', residuesAArr),
      'demo-iface-A',
      { label: 'Interface (A)' },
    );
    if (compA) {
      createdRefs.push(compA.ref);
      await plugin.builders.structure.representation.addRepresentation(compA, {
        type: 'ball-and-stick',
        color: 'uniform',
        colorParams: { value: colorA },
        typeParams: { sizeFactor: 0.15 },
      });
    }
  }

  if (residuesBArr.length > 0) {
    const compB = await plugin.builders.structure.tryCreateComponentFromExpression(
      structureCell,
      buildMultiResidueQuery('B', residuesBArr),
      'demo-iface-B',
      { label: 'Interface (B)' },
    );
    if (compB) {
      createdRefs.push(compB.ref);
      await plugin.builders.structure.representation.addRepresentation(compB, {
        type: 'ball-and-stick',
        color: 'uniform',
        colorParams: { value: colorB },
        typeParams: { sizeFactor: 0.15 },
      });
    }
  }

  // Combined component for interaction dashed lines (needs both chains to draw inter-chain bonds)
  const combinedExpr = MS.struct.combinator.merge([
    buildMultiResidueQuery('A', residuesAArr),
    buildMultiResidueQuery('B', residuesBArr),
  ]);
  const ifaceComp = await plugin.builders.structure.tryCreateComponentFromExpression(
    structureCell,
    combinedExpr,
    'demo-iface-AB-interactions',
    { label: 'A/B interactions' },
  );
  if (ifaceComp) {
    createdRefs.push(ifaceComp.ref);
    try {
      await plugin.builders.structure.representation.addRepresentation(ifaceComp, {
        type: 'interactions',
        color: 'interaction-type',
      });
    } catch (err) {
      console.warn('[demo] interactions repr failed:', err);
    }
  }

  applyPostprocessing(inst);

  const totalResidues = bonds.residuesA.size + bonds.residuesB.size;
  return {
    cleanup: () => {
      deleteRefs(inst, createdRefs);
      inst.removeAllExplorerLabels();
      inst.viewer.highlightLoci(null);
      applyPostprocessing(inst);
    },
    explanation: {
      title: 'Intra-dimer interface',
      body: 'Non-covalent bonds at the alpha-beta contact surface holding the heterodimer together. Hover to inspect, click to focus.',
      target: 'heterodimer',
      bondPairs: bonds.pairs,
      chainColors: buildChainColors(classification, ['A', 'B']),
    },
  };
}

// ── Demo: Inter-dimer contacts ──

async function showInterDimerContacts(ctx: LandingDemoContext): Promise<DemoResult> {
  const inst = ctx.lattice;
  if (!inst) return { cleanup: noop, explanation: null };

  const structure = inst.viewer.getCurrentStructure();
  const plugin = inst.viewer.ctx;
  if (!structure || !plugin) return { cleanup: noop, explanation: null };

  const chainIds = getPolymerChainIds(inst, 'landing_6wvm');
  if (chainIds.length < 2) return { cleanup: noop, explanation: null };

  const hierarchy = plugin.managers.structure.hierarchy.current;
  if (hierarchy.structures.length === 0) return { cleanup: noop, explanation: null };
  const structureCell = hierarchy.structures[0].cell;
  const createdRefs: string[] = [];
  let pairsShown = 0;
  let totalBonds = 0;

  // Look up ghost colors from classification
  const classification = getClassification(inst, 'landing_6wvm');

  // Compute interactions once for the whole structure
  let interactions: any;
  try {
    interactions = await computeStructureInteractions(plugin, structure);
  } catch (err) {
    console.warn('[demo] interaction computation failed:', err);
    return { cleanup: noop, explanation: null };
  }

  // Collect all bond pairs across interfaces for the card
  const allPairs: BondPairInfo[] = [];

  for (let i = 0; i < chainIds.length; i++) {
    for (let j = i + 1; j < chainIds.length; j++) {
      const a = chainIds[i];
      const b = chainIds[j];

      // Only show inter-dimer contacts: same-class chain pairs (alpha-alpha, beta-beta)
      // which represent longitudinal contacts between dimers in the protofilament.
      // Alpha-beta pairs are intra-dimer contacts (shown in the other demo).
      const familyA = classification[a];
      const familyB = classification[b];
      if (familyA !== familyB) continue;

      const bonds = extractInterChainBonds(structure, interactions, a, b);

      if (bonds.residuesA.size === 0 && bonds.residuesB.size === 0) continue;
      pairsShown++;
      totalBonds += bonds.bondCount;
      allPairs.push(...bonds.pairs);

      const resAArr = Array.from(bonds.residuesA);
      const resBArr = Array.from(bonds.residuesB);

      const colorA = getMolstarGhostColor(classification[a]);
      const colorB = getMolstarGhostColor(classification[b]);

      // Per-chain ball-and-stick with ghost colors
      if (resAArr.length > 0) {
        const compA = await plugin.builders.structure.tryCreateComponentFromExpression(
          structureCell,
          buildMultiResidueQuery(a, resAArr),
          `demo-iface-${a}-${b}-chainA`,
          { label: `Interface ${a}` },
        );
        if (compA) {
          createdRefs.push(compA.ref);
          await plugin.builders.structure.representation.addRepresentation(compA, {
            type: 'ball-and-stick',
            color: 'uniform',
            colorParams: { value: colorA },
            typeParams: { sizeFactor: 0.12 },
          });
        }
      }

      if (resBArr.length > 0) {
        const compB = await plugin.builders.structure.tryCreateComponentFromExpression(
          structureCell,
          buildMultiResidueQuery(b, resBArr),
          `demo-iface-${a}-${b}-chainB`,
          { label: `Interface ${b}` },
        );
        if (compB) {
          createdRefs.push(compB.ref);
          await plugin.builders.structure.representation.addRepresentation(compB, {
            type: 'ball-and-stick',
            color: 'uniform',
            colorParams: { value: colorB },
            typeParams: { sizeFactor: 0.12 },
          });
        }
      }

      // Combined component for interaction lines
      const combinedExpr = MS.struct.combinator.merge([
        buildMultiResidueQuery(a, resAArr),
        buildMultiResidueQuery(b, resBArr),
      ]);
      const ifaceComp = await plugin.builders.structure.tryCreateComponentFromExpression(
        structureCell,
        combinedExpr,
        `demo-iface-${a}-${b}-interactions`,
        { label: `${a}/${b} interactions` },
      );
      if (ifaceComp) {
        createdRefs.push(ifaceComp.ref);
        try {
          await plugin.builders.structure.representation.addRepresentation(ifaceComp, {
            type: 'interactions',
            color: 'interaction-type',
          });
        } catch { /* ok */ }
      }
    }
  }

  applyPostprocessing(inst);

  return {
    cleanup: () => {
      deleteRefs(inst, createdRefs);
      inst.removeAllExplorerLabels();
      inst.viewer.highlightLoci(null);
      applyPostprocessing(inst);
    },
    explanation: {
      title: 'Inter-dimer contacts',
      body: 'Longitudinal bonds between adjacent dimers in the protofilament. These hold the microtubule lattice together. Hover to inspect, click to focus.',
      target: 'lattice',
      bondPairs: allPairs,
      chainColors: buildChainColors(classification, chainIds),
    },
  };
}

// ── Demo: PTM sites ──

async function showPTMs(ctx: LandingDemoContext): Promise<DemoResult> {
  const inst = ctx.heterodimer;
  if (!inst) return { cleanup: noop, explanation: null };

  try {
    const [resA, resB] = await Promise.all([
      fetch(`${API_BASE_URL}/annotations/polymer/9MLF/A`),
      fetch(`${API_BASE_URL}/annotations/polymer/9MLF/B`),
    ]);

    const colorings: { chainId: string; authSeqId: number; color: Color }[] = [];
    const labelPositions: { chainId: string; authSeqId: number; text: string }[] = [];

    for (const [chainId, res] of [['A', resA], ['B', resB]] as const) {
      if (!res.ok) continue;
      const data = await res.json();
      const variants = data.variants ?? data.annotations ?? [];
      for (const v of variants) {
        const phenotype = (v.phenotype ?? '').toLowerCase();
        if (v.type === 'ptm' || v.type === 'modification' ||
            phenotype.includes('acetyl') || phenotype.includes('phospho') ||
            phenotype.includes('glutamyl') || phenotype.includes('glycyl')) {
          const seqId = v.auth_seq_id ?? v.authSeqId;
          if (seqId) {
            colorings.push({ chainId, authSeqId: seqId, color: DEMO_COLOR_PTM });
            labelPositions.push({ chainId, authSeqId: seqId, text: `${v.wild_type ?? ''}${seqId} ${v.phenotype ?? 'PTM'}` });
          }
        }
      }
    }

    if (!colorings.some(c => c.chainId === 'A' && c.authSeqId === 40)) {
      colorings.push({ chainId: 'A', authSeqId: 40, color: DEMO_COLOR_PTM });
      labelPositions.push({ chainId: 'A', authSeqId: 40, text: 'K40 acetylation' });
    }

    if (colorings.length > 0) await inst.applyColorscheme('demo-ptm', colorings);

    const structure = inst.viewer.getCurrentStructure();
    if (structure) {
      for (const pos of labelPositions.slice(0, 5)) {
        const loci = executeQuery(buildMultiResidueQuery(pos.chainId, [pos.authSeqId]), structure);
        if (loci) await inst.addExplorerLabel(`demo-ptm-${pos.chainId}-${pos.authSeqId}`, loci, pos.text, DEMO_COLOR_PTM);
      }
    }

    return {
      cleanup: () => { restoreInstance(inst); },
      explanation: {
        title: 'Post-translational modifications',
        body: `${colorings.length} PTM sites. K40 acetylation on alpha-tubulin marks stable microtubules.`,
        target: 'heterodimer',
      },
    };
  } catch (e) {
    console.error('[demo] showPTMs failed:', e);
    return { cleanup: noop, explanation: null };
  }
}

// ── Demo: Key mutations ──

async function showKeyMutations(ctx: LandingDemoContext): Promise<DemoResult> {
  const inst = ctx.heterodimer;
  if (!inst) return { cleanup: noop, explanation: null };

  try {
    const [resA, resB] = await Promise.all([
      fetch(`${API_BASE_URL}/annotations/polymer/9MLF/A`),
      fetch(`${API_BASE_URL}/annotations/polymer/9MLF/B`),
    ]);

    const colorings: { chainId: string; authSeqId: number; color: Color }[] = [];
    const labelPositions: { chainId: string; authSeqId: number; text: string }[] = [];

    for (const [chainId, res] of [['A', resA], ['B', resB]] as const) {
      if (!res.ok) continue;
      const data = await res.json();
      const variants = data.variants ?? data.annotations ?? [];
      for (const v of variants) {
        if (v.type === 'substitution' || v.type === 'mutation') {
          const seqId = v.auth_seq_id ?? v.authSeqId;
          if (seqId) {
            colorings.push({ chainId, authSeqId: seqId, color: DEMO_COLOR_MUT });
            const wt = v.wild_type ?? '';
            const obs = v.observed ?? '';
            const phenotype = v.phenotype ? ` (${v.phenotype})` : '';
            labelPositions.push({ chainId, authSeqId: seqId, text: `${wt}${seqId}${obs}${phenotype}` });
          }
        }
      }
    }

    if (colorings.length > 0) await inst.applyColorscheme('demo-mutations', colorings);

    const structure = inst.viewer.getCurrentStructure();
    if (structure) {
      for (const pos of labelPositions.slice(0, 8)) {
        const loci = executeQuery(buildMultiResidueQuery(pos.chainId, [pos.authSeqId]), structure);
        if (loci) await inst.addExplorerLabel(`demo-mut-${pos.chainId}-${pos.authSeqId}`, loci, pos.text, DEMO_COLOR_MUT);
      }
    }

    return {
      cleanup: () => { restoreInstance(inst); },
      explanation: {
        title: 'Tubulin mutations',
        body: `${colorings.length} clinically relevant substitutions. Mutations can confer drug resistance or cause tubulinopathies.`,
        target: 'heterodimer',
      },
    };
  } catch (e) {
    console.error('[demo] showKeyMutations failed:', e);
    return { cleanup: noop, explanation: null };
  }
}

// ── Demo: Flexible tails ──

async function showFlexibleTail(ctx: LandingDemoContext): Promise<DemoResult> {
  const inst = ctx.heterodimer;
  if (!inst) return { cleanup: noop, explanation: null };

  const structure = inst.viewer.getCurrentStructure();
  if (!structure) return { cleanup: noop, explanation: null };

  const colorings: { chainId: string; authSeqId: number; color: Color }[] = [];
  const TAIL_LENGTH = 20;

  for (const chainId of ['A', 'B']) {
    const seqIds: number[] = [];
    for (const unit of structure.units) {
      const loc = StructureElement.Location.create(structure, unit, unit.elements[0]);
      if (StructureProperties.chain.auth_asym_id(loc) !== chainId) continue;
      for (let i = 0; i < unit.elements.length; i++) {
        loc.element = unit.elements[i];
        if (StructureProperties.entity.type(loc) !== 'polymer') continue;
        seqIds.push(StructureProperties.residue.auth_seq_id(loc));
      }
    }

    const uniqueIds = [...new Set(seqIds)].sort((a, b) => a - b);
    const tailIds = uniqueIds.slice(-TAIL_LENGTH);
    const tailColor = chainId === 'A' ? DEMO_COLOR_TAIL_A : DEMO_COLOR_TAIL_B;

    for (const id of tailIds) colorings.push({ chainId, authSeqId: id, color: tailColor });

    if (tailIds.length > 0) {
      const midId = tailIds[Math.floor(tailIds.length / 2)];
      const loci = executeQuery(buildMultiResidueQuery(chainId, [midId]), structure);
      if (loci) {
        const family = chainId === 'A' ? 'Alpha' : 'Beta';
        await inst.addExplorerLabel(`demo-tail-${chainId}`, loci, `${family} C-terminal tail`, tailColor);
      }
    }
  }

  if (colorings.length > 0) await inst.applyColorscheme('demo-tail', colorings);

  return {
    cleanup: () => { restoreInstance(inst); },
    explanation: {
      title: 'C-terminal tails',
      body: 'The disordered C-terminal tails extend from the microtubule surface. They carry most PTMs and mediate interactions with MAPs and motor proteins.',
      target: 'heterodimer',
    },
  };
}

// ── Registry ──

export const LANDING_DEMOS: LandingDemo[] = [
  { id: 'gdp-gtp', label: 'GDP / GTP', description: 'Show nucleotide binding sites', category: 'ligands', target: '9MLF', run: showGdpGtp },
  { id: 'taxol', label: 'Taxol binding', description: 'Drug binding pocket on beta-tubulin', category: 'ligands', target: '9MLF', run: showTaxol },
  { id: 'intra-dimer', label: 'Intra-dimer contacts', description: 'Alpha-beta interface bonds', category: 'contacts', target: '9MLF', run: showIntraDimerContacts },
  { id: 'inter-dimer', label: 'Inter-dimer contacts', description: 'Longitudinal bonds in the lattice', category: 'contacts', target: '6WVM', run: showInterDimerContacts },
  { id: 'ptms', label: 'PTM sites', description: 'Post-translational modifications including K40', category: 'modifications', target: '9MLF', run: showPTMs },
  { id: 'tail', label: 'Flexible tails', description: 'Disordered C-terminal tails', category: 'modifications', target: '9MLF', run: showFlexibleTail },
  { id: 'mutations', label: 'Key mutations', description: 'Clinically relevant tubulin mutations', category: 'mutations', target: null, run: showKeyMutations },
];

export const DEMO_CATEGORY_LABELS: Record<DemoCategory, string> = {
  ligands: 'Ligands',
  contacts: 'Contacts',
  modifications: 'Modifications',
  mutations: 'Mutations',
};
