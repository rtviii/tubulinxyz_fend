import { MolScriptBuilder as MS } from 'molstar/lib/mol-script/language/builder';
import { compile } from 'molstar/lib/mol-script/runtime/query/compiler';
import { QueryContext, Structure, StructureSelection, StructureProperties } from 'molstar/lib/mol-model/structure';
import { StructureElement } from 'molstar/lib/mol-model/structure';
import { LigandComponent } from './types';

// ============================================================
// Query Builders (Pure Functions)
// ============================================================

export const buildChainQuery = (chainId: string) =>
  MS.struct.generator.atomGroups({
    'chain-test': MS.core.rel.eq([MS.ammp('auth_asym_id'), chainId]),
  });

export const buildResidueQuery = (chainId: string, startResidue: number, endResidue?: number) => {
  const residueTest = endResidue !== undefined
    ? MS.core.rel.inRange([MS.ammp('auth_seq_id'), startResidue, endResidue])
    : MS.core.rel.eq([MS.ammp('auth_seq_id'), startResidue]);

  return MS.struct.generator.atomGroups({
    'chain-test': MS.core.rel.eq([MS.ammp('auth_asym_id'), chainId]),
    'residue-test': residueTest,
  });
};

export const buildMultiResidueQuery = (chainId: string, authSeqIds: number[]) => {
  return MS.struct.generator.atomGroups({
    'chain-test': MS.core.rel.eq([MS.ammp('auth_asym_id'), chainId]),
    'residue-test': MS.core.set.has([
      MS.set(...authSeqIds),
      MS.ammp('auth_seq_id'),
    ]),
  });
};

export const buildLigandQuery = (ligand: LigandComponent) =>
  MS.struct.generator.atomGroups({
    'residue-test': MS.core.logic.and([
      MS.core.rel.eq([MS.ammp('auth_comp_id'), ligand.compId]),
      MS.core.rel.eq([MS.ammp('auth_asym_id'), ligand.authAsymId]),
      MS.core.rel.eq([MS.ammp('auth_seq_id'), ligand.authSeqId]),
    ]),
  });

export const buildSurroundingsQuery = (baseQuery: ReturnType<typeof MS.struct.generator.atomGroups>, radius: number = 5) =>
  MS.struct.modifier.includeSurroundings({
    0: baseQuery,
    radius,
    'as-whole-residues': true,
  });

// ============================================================
// Query Execution
// ============================================================

export const executeQuery = (query: any, structure: Structure): StructureElement.Loci | null => {
  const compiled = compile(query);
  const selection = compiled(new QueryContext(structure));

  if (StructureSelection.isEmpty(selection)) return null;

  return StructureSelection.toLociWithSourceUnits(selection);
};

export const structureToLoci = (structure: Structure): StructureElement.Loci => {
  return Structure.toStructureElementLoci(structure);
};

// ============================================================
// Sequence Extraction
// ============================================================

const AMINO_ACIDS_3_TO_1: Record<string, string> = {
  ALA: 'A', ARG: 'R', ASN: 'N', ASP: 'D', CYS: 'C',
  GLN: 'Q', GLU: 'E', GLY: 'G', HIS: 'H', ILE: 'I',
  LEU: 'L', LYS: 'K', MET: 'M', PHE: 'F', PRO: 'P',
  SER: 'S', THR: 'T', TRP: 'W', TYR: 'Y', VAL: 'V',
  SEC: 'U', PYL: 'O',
};

export const extractObservedSequence = (
  structure: Structure,
  chainId: string
): { sequence: string; authSeqIds: number[] } | null => {
  let targetUnit: any = null;

  for (const unit of structure.units) {
    const unitChainId = StructureProperties.chain.auth_asym_id({
      unit,
      element: unit.elements[0],
    });
    const entityType = StructureProperties.entity.type({
      unit,
      element: unit.elements[0],
    });

    if (unitChainId === chainId && entityType === 'polymer') {
      targetUnit = unit;
      break;
    }
  }

  if (!targetUnit) return null;

  const location = StructureElement.Location.create(structure, targetUnit, targetUnit.elements[0]);
  const residueMap = new Map<number, string>();

  for (let i = 0; i < targetUnit.elements.length; i++) {
    location.element = targetUnit.elements[i];
    const authSeqId = StructureProperties.residue.auth_seq_id(location);

    if (residueMap.has(authSeqId)) continue;

    const compId = StructureProperties.atom.label_comp_id(location);
    const oneLetter = AMINO_ACIDS_3_TO_1[compId] || 'X';
    residueMap.set(authSeqId, oneLetter);
  }

  const sortedEntries = Array.from(residueMap.entries()).sort((a, b) => a[0] - b[0]);

  return {
    sequence: sortedEntries.map(([, aa]) => aa).join(''),
    authSeqIds: sortedEntries.map(([id]) => id),
  };
};