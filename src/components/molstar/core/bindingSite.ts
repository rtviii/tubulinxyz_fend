/**
 * Binding-site interaction helpers.
 *
 * Computes Molstar's non-covalent interaction network for a structure and
 * extracts the polymer residues + bond pairs touching a given ligand. The
 * helpers here are shared between the landing-page demos (which built the
 * original implementation) and the in-app ligand toolbox, which uses the
 * same pattern to surface a binding-site representation on demand.
 *
 * The extracted residue ids + bond pairs feed the standard three-layer
 * representation used in the demos:
 *   - ball-and-stick for the ligand
 *   - ball-and-stick for the contacting protein residues
 *   - 'interactions' representation (auto-coloured by interaction type) for
 *     the bonds between them
 */

import { Structure, StructureElement, StructureProperties } from 'molstar/lib/mol-model/structure';
import { computeInteractions } from 'molstar/lib/mol-model-props/computed/interactions/interactions';
import { interactionTypeLabel } from 'molstar/lib/mol-model-props/computed/interactions/common';
import { Task } from 'molstar/lib/mol-task';

export interface LigandBondInfo {
  /** Polymer residue that contacts the ligand */
  residue: { chainId: string; authSeqId: number; compId: string };
  /** Human-readable interaction type (e.g. "H-Bond", "Hydrophobic"). */
  type: string;
}

export interface LigandBondExtraction {
  /** Set of polymer auth_seq_id values that contact the ligand. */
  residues: Set<number>;
  /** Total number of bonds (each contact counted once). */
  bondCount: number;
  /** Per-bond detail. */
  contacts: LigandBondInfo[];
}

/**
 * Run Molstar's interaction computation on the structure.
 * Returns the raw Interactions object for downstream extraction. Returns
 * null if the runtime fails.
 */
export async function computeStructureInteractions(plugin: any, structure: Structure): Promise<any> {
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
 * Given pre-computed interactions, extract polymer residues that form
 * non-covalent bonds with a specific ligand (identified by compId + chainId
 * + authSeqId).
 */
export function extractLigandBonds(
  structure: Structure,
  interactions: any,
  ligandCompId: string,
  ligandChainId: string,
  ligandSeqId: number,
): LigandBondExtraction {
  const residues = new Set<number>();
  const contacts: LigandBondInfo[] = [];
  let bondCount = 0;

  if (!interactions) return { residues, bondCount, contacts };

  const { contacts: interContacts, unitsFeatures } = interactions;

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

  // Inter-unit contacts (ligand and polymer in different units).
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

  // Intra-unit contacts (ligand and polymer in the same unit).
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
