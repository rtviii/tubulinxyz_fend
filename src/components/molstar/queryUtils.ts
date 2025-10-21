/**
 * Reusable Molstar query utilities
 * Provides common query patterns used across the application
 */

import { MolScriptBuilder as MS } from 'molstar/lib/mol-script/language/builder';
import { compile } from 'molstar/lib/mol-script/runtime/query/compiler';
import { QueryContext, Structure, StructureSelection } from 'molstar/lib/mol-model/structure';
import { StructureElement } from 'molstar/lib/mol-model/structure';
import { Expression } from 'molstar/lib/mol-script/language/expression';

/**
 * Query builder for selecting residues
 */
export class ResidueQueryBuilder {
  private chainId?: string;
  private residueRange?: { start: number; end: number };
  private singleResidue?: number;
  private compIds?: string[];

  forChain(chainId: string): this {
    this.chainId = chainId;
    return this;
  }

  withResidueRange(start: number, end: number): this {
    this.residueRange = { start, end };
    return this;
  }

  withResidue(residueNum: number): this {
    this.singleResidue = residueNum;
    return this;
  }

  withCompIds(compIds: string[]): this {
    this.compIds = compIds;
    return this;
  }

  build(): Expression {
    const tests: Expression[] = [];

    // Chain test
    if (this.chainId) {
      tests.push(
        MS.core.rel.eq([MS.ammp('auth_asym_id'), this.chainId])
      );
    }

    // Residue test
    if (this.singleResidue !== undefined) {
      tests.push(
        MS.core.rel.eq([MS.ammp('auth_seq_id'), this.singleResidue])
      );
    } else if (this.residueRange) {
      tests.push(
        MS.core.rel.inRange([
          MS.ammp('auth_seq_id'),
          this.residueRange.start,
          this.residueRange.end
        ])
      );
    }

    // Component ID test
    if (this.compIds && this.compIds.length > 0) {
      tests.push(
        MS.core.set.has([
          MS.set(...this.compIds),
          MS.ammp('auth_comp_id')
        ])
      );
    }

    return MS.struct.generator.atomGroups({
      'residue-test': tests.length > 1 
        ? MS.core.logic.and(tests)
        : tests[0]
    });
  }
}

/**
 * Query builder for selecting ligands
 */
export class LigandQueryBuilder {
  private compId?: string;
  private chainId?: string;
  private seqId?: number;

  withCompId(compId: string): this {
    this.compId = compId;
    return this;
  }

  inChain(chainId: string): this {
    this.chainId = chainId;
    return this;
  }

  atPosition(seqId: number): this {
    this.seqId = seqId;
    return this;
  }

  build(): Expression {
    const tests: Expression[] = [];

    if (this.compId) {
      tests.push(MS.core.rel.eq([MS.ammp('auth_comp_id'), this.compId]));
    }
    if (this.chainId) {
      tests.push(MS.core.rel.eq([MS.ammp('auth_asym_id'), this.chainId]));
    }
    if (this.seqId !== undefined) {
      tests.push(MS.core.rel.eq([MS.ammp('auth_seq_id'), this.seqId]));
    }

    return MS.struct.generator.atomGroups({
      'residue-test': tests.length > 1 
        ? MS.core.logic.and(tests)
        : tests[0]
    });
  }
}

/**
 * Query executor that compiles and runs queries
 */
// export class QueryExecutor {
//   constructor(private structure: Structure) {}

//   /**
//    * Execute a query and return the selection
//    */
//   execute(query: Expression): StructureSelection.Query.Result {
//     const compiled = compile(query);
//     return compiled(new QueryContext(this.structure));
//   }

//   /**
//    * Execute a query and convert to Loci
//    */
//   executeToLoci(query: Expression): StructureElement.Loci {
//     const selection = this.execute(query);
//     return StructureSelection.toLociWithSourceUnits(selection);
//   }

//   /**
//    * Check if a query returns any results
//    */
//   hasResults(query: Expression): boolean {
//     const selection = this.execute(query);
//     return !StructureSelection.isEmpty(selection);
//   }

//   /**
//    * Get the number of atoms selected by a query
//    */
//   countAtoms(query: Expression): number {
//     const selection = this.execute(query);
//     const structure = StructureSelection.unionStructure(selection);
//     return structure.elementCount;
//   }
// }

/**
 * Common query patterns
 */
export const QueryPatterns = {
  /**
   * Select entire chain
   */
  selectChain(chainId: string): Expression {
    return MS.struct.generator.atomGroups({
      'chain-test': MS.core.rel.eq([MS.ammp('auth_asym_id'), chainId])
    });
  },

  /**
   * Select protein backbone atoms
   */
  selectBackbone(chainId?: string): Expression {
    const backboneAtoms = ['CA', 'C', 'N', 'O'];
    const atomTest = MS.core.set.has([
      MS.set(...backboneAtoms),
      MS.ammp('label_atom_id')
    ]);

    if (chainId) {
      return MS.struct.generator.atomGroups({
        'chain-test': MS.core.rel.eq([MS.ammp('auth_asym_id'), chainId]),
        'atom-test': atomTest
      });
    }

    return MS.struct.generator.atomGroups({
      'atom-test': atomTest
    });
  },

  /**
   * Select side chains only
   */
  selectSideChains(chainId?: string): Expression {
    const backboneAtoms = ['CA', 'C', 'N', 'O'];
    const atomTest = MS.core.logic.not([
      MS.core.set.has([
        MS.set(...backboneAtoms),
        MS.ammp('label_atom_id')
      ])
    ]);

    if (chainId) {
      return MS.struct.generator.atomGroups({
        'chain-test': MS.core.rel.eq([MS.ammp('auth_asym_id'), chainId]),
        'atom-test': atomTest
      });
    }

    return MS.struct.generator.atomGroups({
      'atom-test': atomTest
    });
  },

  /**
   * Select waters
   */
  selectWaters(): Expression {
    return MS.struct.generator.atomGroups({
      'residue-test': MS.core.rel.eq([MS.ammp('label_comp_id'), 'HOH'])
    });
  },

  /**
   * Select by atom name
   */
  selectAtoms(atomNames: string[], chainId?: string): Expression {
    const atomTest = MS.core.set.has([
      MS.set(...atomNames),
      MS.ammp('label_atom_id')
    ]);

    if (chainId) {
      return MS.struct.generator.atomGroups({
        'chain-test': MS.core.rel.eq([MS.ammp('auth_asym_id'), chainId]),
        'atom-test': atomTest
      });
    }

    return MS.struct.generator.atomGroups({
      'atom-test': atomTest
    });
  },

  /**
   * Select surroundings of a selection
   */
  selectSurroundings(
    innerQuery: Expression,
    radius: number,
    includeWholeResidues: boolean = true
  ): Expression {
    return MS.struct.modifier.includeSurroundings({
      0: innerQuery,
      radius,
      'as-whole-residues': includeWholeResidues
    });
  },

  /**
   * Select by secondary structure
   */
  selectSecondaryStructure(type: 'helix' | 'sheet' | 'turn', chainId?: string): Expression {
    const flags = {
      helix: 0x1,
      sheet: 0x2,
      turn: 0x4
    };

    const structureTest = MS.core.flags.hasAny([
      MS.struct.atomProperty.macromolecular.secondaryStructureFlags(),
      flags[type]
    ]);

    if (chainId) {
      return MS.struct.generator.atomGroups({
        'chain-test': MS.core.rel.eq([MS.ammp('auth_asym_id'), chainId]),
        'residue-test': structureTest
      });
    }

    return MS.struct.generator.atomGroups({
      'residue-test': structureTest
    });
  }
};

/**
 * Convenience functions for common operations
 */
export const MolstarQueryHelpers = {
  /**
   * Create a residue query builder
   */
  residues(): ResidueQueryBuilder {
    return new ResidueQueryBuilder();
  },

  /**
   * Create a ligand query builder
   */
  ligands(): LigandQueryBuilder {
    return new LigandQueryBuilder();
  },

  /**
   * Create a query executor for a structure
   */
//   executor(structure: Structure): QueryExecutor {
//     return new QueryExecutor(structure);
//   },

//   /**
//    * Quick execute: compile and run a query on a structure
//    */
//   quickExecute(structure: Structure, query: Expression): StructureElement.Loci {
//     return new QueryExecutor(structure).executeToLoci(query);
//   }
};