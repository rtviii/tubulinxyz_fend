// src/data/research_dummy_data.ts

export const researchDummyData = {
  ligands: [
    {
      code: 'PAR',
      parentStructure: '3J7Z',
      structureColor: 'bg-blue-500',
      description: 'Inhibits dynein motor activity'
    },
    {
      code: 'COL',
      parentStructure: '4O2B',
      structureColor: 'bg-green-500',
      description: 'Destabilizes microtubules'
    },
    {
      code: 'TAX',
      parentStructure: '1JFF',
      structureColor: 'bg-purple-500',
      description: 'Stabilizes microtubule polymers'
    },
    {
      code: 'VIN',
      parentStructure: '1SA0',
      structureColor: 'bg-red-500',
      description: 'Binds to vinca domain'
    },
    {
      code: 'NOC',
      parentStructure: '5J2T',
      structureColor: 'bg-yellow-500',
      description: 'Disrupts spindle formation'
    },
    {
      code: 'EPO',
      parentStructure: '6WVR',
      structureColor: 'bg-indigo-500',
      description: 'Promotes microtubule assembly'
    },
    {
      code: 'DOL',
      parentStructure: '3HKE',
      structureColor: 'bg-pink-500',
      description: 'Inhibits tubulin polymerization'
    },
    {
      code: 'GDP',
      parentStructure: '7SJ7',
      structureColor: 'bg-gray-500',
      description: 'Essential nucleotide cofactor'
    },
    {
      code: 'GTP',
      parentStructure: '6O2R',
      structureColor: 'bg-emerald-500',
      description: 'Drives polymerization dynamics'
    },
    {
      code: 'MAY',
      parentStructure: '4TV9',
      structureColor: 'bg-orange-500',
      description: 'Antimitotic marine toxin'
    }
  ],

  mutations: [
    {
      positions: ['R284C'],
      parentStructure: '6WVR',
      structureColor: 'bg-red-600',
      description: 'Associated with neurodegeneration'
    },
    {
      positions: ['D417N', 'R422H'],
      parentStructure: '3J7Z',
      structureColor: 'bg-orange-600',
      description: 'Causes cortical dysplasia'
    },
    {
      positions: ['E410K'],
      parentStructure: '4O2B',
      structureColor: 'bg-blue-600',
      description: 'Linked to lissencephaly'
    },
    {
      positions: ['P358S', 'A383T', 'R390H'],
      parentStructure: '1SA0',
      structureColor: 'bg-purple-600',
      description: 'Disrupts GTP binding site'
    },
    {
      positions: ['T107I'],
      parentStructure: '5J2T',
      structureColor: 'bg-green-600',
      description: 'Alters longitudinal contacts'
    },
    {
      positions: ['N228S', 'D249N'],
      parentStructure: '6O2R',
      structureColor: 'bg-yellow-600',
      description: 'Affects lateral interactions'
    },
    {
      positions: ['F351Y'],
      parentStructure: '4TV9',
      structureColor: 'bg-indigo-600',
      description: 'Impairs kinesin binding'
    },
    {
      positions: ['G93D', 'V94M', 'L95P'],
      parentStructure: '7SJ7',
      structureColor: 'bg-pink-600',
      description: 'Destabilizes M-loop region'
    },
    {
      positions: ['H229Y'],
      parentStructure: '3HKE',
      structureColor: 'bg-gray-600',
      description: 'Reduces drug sensitivity'
    },
    {
      positions: ['R262C', 'Q265L'],
      parentStructure: '1JFF',
      structureColor: 'bg-emerald-600',
      description: 'Confers taxane resistance'
    }
  ],

  ptms: [
    {
      type: 'K40 Acetylation',
      parentStructure: '6WVR',
      structureColor: 'bg-blue-500',
      description: 'Marks stable microtubules'
    },
    {
      type: 'S172 Phosphorylation',
      parentStructure: '3J7Z',
      structureColor: 'bg-green-500',
      description: 'Cell cycle regulation'
    },
    {
      type: 'Y272 Phosphorylation',
      parentStructure: '4O2B',
      structureColor: 'bg-purple-500',
      description: 'Mitotic checkpoint control'
    },
    {
      type: 'K252 Ubiquitination',
      parentStructure: '1SA0',
      structureColor: 'bg-red-500',
      description: 'Targets for degradation'
    },
    {
      type: 'R391 Methylation',
      parentStructure: '5J2T',
      structureColor: 'bg-yellow-500',
      description: 'Modulates protein interactions'
    },
    {
      type: 'T349 Phosphorylation',
      parentStructure: '6O2R',
      structureColor: 'bg-indigo-500',
      description: 'Aurora kinase substrate'
    },
    {
      type: 'K394 Sumoylation',
      parentStructure: '4TV9',
      structureColor: 'bg-pink-500',
      description: 'Nuclear transport regulation'
    },
    {
      type: 'C12 Glutamylation',
      parentStructure: '7SJ7',
      structureColor: 'bg-gray-500',
      description: 'C-terminal tail modification'
    },
    {
      type: 'Y200 Nitrosylation',
      parentStructure: '3HKE',
      structureColor: 'bg-emerald-500',
      description: 'Oxidative stress response'
    },
    {
      type: 'S444 Glycylation',
      parentStructure: '1JFF',
      structureColor: 'bg-orange-500',
      description: 'Tail domain polymodification'
    }
  ]
};