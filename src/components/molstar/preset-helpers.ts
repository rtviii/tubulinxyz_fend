import { StateObjectSelector } from "molstar/lib/mol-state";
import { ResidueIndex, Structure } from "molstar/lib/mol-model/structure";

export const AMINO_ACIDS_3_TO_1_CODE: { [key: string]: string } = {
    ALA: 'A', ARG: 'R', ASN: 'N', ASP: 'D', ASX: 'B', CYS: 'C',
    GLU: 'E', GLN: 'Q', GLX: 'Z', GLY: 'G', HIS: 'H', ILE: 'I',
    LEU: 'L', LYS: 'K', MET: 'M', PHE: 'F', PRO: 'P', SER: 'S',
    THR: 'T', TRP: 'W', TYR: 'Y', VAL: 'V'
};

export type ResidueData = [string, number];

export function getResidueSequence(component: StateObjectSelector, chainId: string): ResidueData[] {
    const sequence: ResidueData[] = [];
    const structure = component.obj?.data as Structure;
    if (!structure) return [];

    const { _rowCount: residueCount } = structure.model.atomicHierarchy.residues;
    const { offsets: residueOffsets } = structure.model.atomicHierarchy.residueAtomSegments;
    const chainIndex = structure.model.atomicHierarchy.chainAtomSegments.index;

    for (let rI = 0 as ResidueIndex; rI < residueCount; rI++) {
        const offset = residueOffsets[rI];
        const cI = chainIndex[offset];
        const residueChainId = structure.model.atomicHierarchy.chains.auth_asym_id.value(cI);

        if (residueChainId !== chainId) continue;

        const label_comp_id = structure.model.atomicHierarchy.atoms.label_comp_id.value(offset);
        const auth_seq_id = structure.model.atomicHierarchy.residues.auth_seq_id.value(rI);
        
        const oneLetterCode = AMINO_ACIDS_3_TO_1_CODE[label_comp_id] || label_comp_id;
        sequence.push([oneLetterCode, auth_seq_id]);
    }
    return sequence;
}