import { MolScriptBuilder as MS } from 'molstar/lib/mol-script/language/builder';
import { compile } from 'molstar/lib/mol-script/runtime/query/base';
import { QueryContext } from 'molstar/lib/mol-model/structure';
import { StructureSelection } from 'molstar/lib/mol-model/structure';
import type { MolstarViewer } from '@/components/molstar/core/MolstarViewer';

export type ResiduePair = [string, number];

export function residueListExpr(residues: ResiduePair[]) {
  const groups = residues.map(([chain, resi]) =>
    MS.struct.generator.atomGroups({
      'chain-test': MS.core.rel.eq([MS.struct.atomProperty.macromolecular.auth_asym_id(), chain]),
      'residue-test': MS.core.rel.eq([MS.struct.atomProperty.macromolecular.auth_seq_id(), resi]),
    })
  );
  return MS.struct.combinator.merge(groups);
}

export function lociFromResidues(viewer: MolstarViewer, residues: ResiduePair[]) {
  const structure = viewer.ctx.managers.structure.hierarchy.current.structures[0]?.cell.obj?.data;
  if (!structure) return null;

  const expr = residueListExpr(residues);
  const compiled = compile<StructureSelection>(expr)(new QueryContext(structure));
  return StructureSelection.toLociWithSourceUnits(compiled);
}
