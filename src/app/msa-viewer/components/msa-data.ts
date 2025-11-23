// src/app/msa-viewer/components/msa-data.ts

export const annotationData = {
  phosphorylation: {
    name: 'Phosphorylation',
    color: '#3B82F6',
    shape: 'circle' as const,
    features: [
      { accession: 'phos1', start: 15, end: 15, color: '#3B82F6', shape: 'circle' },
      { accession: 'phos2', start: 45, end: 45, color: '#3B82F6', shape: 'circle' },
      { accession: 'phos3', start: 89, end: 89, color: '#3B82F6', shape: 'circle' }
    ]
  },
  acetylation: {
    name: 'Acetylation',
    color: '#10B981',
    shape: 'diamond' as const,
    features: [
      { accession: 'ac1', start: 23, end: 23, color: '#10B981', shape: 'diamond' },
      { accession: 'ac2', start: 67, end: 67, color: '#10B981', shape: 'diamond' }
    ]
  },
  atp_binding: {
    name: 'ATP Binding',
    color: '#EF4444',
    shape: 'rectangle' as const,
    features: [
      { accession: 'atp1', start: 50, end: 65, color: '#EF4444', shape: 'rectangle' }
    ]
  },
  metal_binding: {
    name: 'Metal Binding',
    color: '#F59E0B',
    shape: 'hexagon' as const,
    features: [
      { accession: 'metal1', start: 30, end: 32, color: '#F59E0B', shape: 'hexagon' },
      { accession: 'metal2', start: 75, end: 77, color: '#F59E0B', shape: 'hexagon' }
    ]
  },
  glycosylation: {
    name: 'Glycosylation',
    color: '#8B5CF6',
    shape: 'triangle' as const,
    features: [
      { accession: 'glyco1', start: 102, end: 102, color: '#8B5CF6', shape: 'triangle' },
      { accession: 'glyco2', start: 156, end: 156, color: '#8B5CF6', shape: 'triangle' }
    ]
  }
};

export const mockRegionData = {
  ligand_binding: {
    name: 'Ligand Binding',
    color: '#EC4899',
    shape: 'rectangle' as const,
    features: [
      { accession: 'lig1', start: 120, end: 127, color: '#EC4899', shape: 'rectangle', tooltipContent: 'Substrate binding pocket' },
      { accession: 'lig2', start: 180, end: 186, color: '#EC4899', shape: 'rectangle', tooltipContent: 'Cofactor binding' }
    ]
  },
  catalytic_site: {
    name: 'Catalytic Site',
    color: '#F97316',
    shape: 'diamond' as const,
    features: [
      { accession: 'cat1', start: 95, end: 95, color: '#F97316', shape: 'diamond', tooltipContent: 'Catalytic residue H95' },
      { accession: 'cat2', start: 140, end: 140, color: '#F97316', shape: 'diamond', tooltipContent: 'Catalytic residue D140' },
      { accession: 'cat3', start: 165, end: 165, color: '#F97316', shape: 'diamond', tooltipContent: 'Catalytic residue S165' }
    ]
  },
  protein_interface: {
    name: 'Protein Interface',
    color: '#06B6D4',
    shape: 'rectangle' as const,
    features: [
      { accession: 'int1', start: 35, end: 43, color: '#06B6D4', shape: 'rectangle', tooltipContent: 'Dimer interface α1' },
      { accession: 'int2', start: 200, end: 208, color: '#06B6D4', shape: 'rectangle', tooltipContent: 'Dimer interface α2' }
    ]
  },
  regulatory_site: {
    name: 'Regulatory Site',
    color: '#A855F7',
    shape: 'circle' as const,
    features: [
      { accession: 'reg1', start: 72, end: 72, color: '#A855F7', shape: 'circle', tooltipContent: 'Phosphorylation site T72' },
      { accession: 'reg2', start: 145, end: 145, color: '#A855F7', shape: 'circle', tooltipContent: 'Allosteric site' }
    ]
  }
};