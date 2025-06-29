import { StateObjectSelector } from "molstar/lib/mol-state";
import { ResidueIndex, Structure } from "molstar/lib/mol-model/structure";
export interface LigandInstance {
    compId: string;      
    auth_asym_id: string; 
    auth_seq_id: number;  
    uniqueKey: string;   
}

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

export const IonNames = new Set([
    'HOH',
    '118',
    '119',
    '543',
    '1AL',
    '1CU',
    '2FK',
    '2HP',
    '2OF',
    '3CO',
    '3MT',
    '3NI',
    '3OF',
    '3P8',
    '4MO',
    '4PU',
    '4TI',
    '6MO',
    'ACT',
    'AG',
    'AL',
    'ALF',
    'AM',
    'ATH',
    'AU',
    'AU3',
    'AUC',
    'AZI',
    'BA',
    'BCT',
    'BEF',
    'BF4',
    'BO4',
    'BR',
    'BS3',
    'BSY',
    'CA',
    'CAC',
    'CD',
    'CD1',
    'CD3',
    'CD5',
    'CE',
    'CF',
    'CHT',
    'CL',
    'CO',
    'CO3',
    'CO5',
    'CON',
    'CR',
    'CS',
    'CSB',
    'CU',
    'CU1',
    'CU3',
    'CUA',
    'CUZ',
    'CYN',
    'DME',
    'DMI',
    'DSC',
    'DTI',
    'DY',
    'E4N',
    'EDR',
    'EMC',
    'ER3',
    'EU',
    'EU3',
    'F',
    'FE',
    'FE2',
    'FPO',
    'GA',
    'GD3',
    'GEP',
    'HAI',
    'HG',
    'HGC',
    'IN',
    'IOD',
    'IR',
    'IR3',
    'IRI',
    'IUM',
    'K',
    'KO4',
    'LA',
    'LCO',
    'LCP',
    'LI',
    'LU',
    'MAC',
    'MG',
    'MH2',
    'MH3',
    'MLI',
    'MMC',
    'MN',
    'MN3',
    'MN5',
    'MN6',
    'MO1',
    'MO2',
    'MO3',
    'MO4',
    'MO5',
    'MO6',
    'MOO',
    'MOS',
    'MOW',
    'MW1',
    'MW2',
    'MW3',
    'NA',
    'NA2',
    'NA5',
    'NA6',
    'NAO',
    'NAW',
    'ND',
    'NET',
    'NH4',
    'NI',
    'NI1',
    'NI2',
    'NI3',
    'NO2',
    'NO3',
    'NRU',
    'NT3',
    'O4M',
    'OAA',
    'OC1',
    'OC2',
    'OC3',
    'OC4',
    'OC5',
    'OC6',
    'OC7',
    'OC8',
    'OCL',
    'OCM',
    'OCN',
    'OCO',
    'OF1',
    'OF2',
    'OF3',
    'OH',
    'OS',
    'OS4',
    'OXL',
    'PB',
    'PBM',
    'PD',
    'PDV',
    'PER',
    'PI',
    'PO3',
    'PO4',
    'PR',
    'PT',
    'PT4',
    'PTN',
    'RB',
    'RH3',
    'RHD',
    'RHF',
    'RU',
    'SB',
    'SCN',
    'SE4',
    'SEK',
    'SM',
    'SMO',
    'SO3',
    'SO4',
    'SR',
    'T1A',
    'TB',
    'TBA',
    'TCN',
    'TEA',
    'TH',
    'THE',
    'TL',
    'TMA',
    'TRA',
    'UNX',
    'V',
    'VN3',
    'VO4',
    'W',
    'WO5',
    'Y1',
    'YB',
    'YB2',
    'YH',
    'YT3',
    'ZCM',
    'ZN',
    'ZN2',
    'ZN3',
    'ZNO',
    'ZO3',
    'ZR',
    'ZTM',
    'NCO',
    'OHX'
]);
export function getLigandInstances(structure: Structure): LigandInstance[] {
    const instances: LigandInstance[] = [];
    const uniqueKeys = new Set<string>();

    const { _rowCount: residueCount } = structure.model.atomicHierarchy.residues;
    const { offsets: residueOffsets } = structure.model.atomicHierarchy.residueAtomSegments;
    const chainIndex = structure.model.atomicHierarchy.chainAtomSegments.index;

    for (let rI = 0 as ResidueIndex; rI < residueCount; rI++) {
        const cI = chainIndex[residueOffsets[rI]];
        const eI = structure.model.atomicHierarchy.index.getEntityFromChain(cI);
        const entityType = structure.model.entities.data.type.value(eI);

        // We only care about non-polymer or branched entities (ligands, sugars)
        if (entityType !== 'non-polymer' && entityType !== 'branched') continue;

        const compId = structure.model.atomicHierarchy.atoms.label_comp_id.value(residueOffsets[rI]);

        if (IonNames.has(compId) || compId === 'HOH') continue;

        const auth_asym_id = structure.model.atomicHierarchy.chains.auth_asym_id.value(cI);
        const auth_seq_id = structure.model.atomicHierarchy.residues.auth_seq_id.value(rI);
        
        const uniqueKey = `${compId}_${auth_asym_id}_${auth_seq_id}`;

        // Ensure we only add each instance once
        if (!uniqueKeys.has(uniqueKey)) {
            instances.push({
                compId,
                auth_asym_id,
                auth_seq_id,
                uniqueKey
            });
            uniqueKeys.add(uniqueKey);
        }
    }

    return instances;
}
