// src/lib/controllers/StructureController.ts

import { ColorRule, IStructureController } from '../types/sync';
import { MolstarInstance } from '@/components/molstar/services/MolstarInstance';
import { ResidueColoring } from '@/components/molstar/coloring/types';
import { Color } from 'molstar/lib/mol-util/color';

/**
 * Controller for Molstar structure operations.
 * Wraps MolstarInstance and provides a clean API.
 */
export class StructureController implements IStructureController {
  constructor(private instance: MolstarInstance | null) {}

  setInstance(instance: MolstarInstance | null): void {
    this.instance = instance;
  }

  applyColors(rules: ColorRule[]): void {
    if (!this.instance) {
      console.warn('[StructureController] No instance available');
      return;
    }

    console.log('[StructureController] applyColors:', rules.length, 'rules');

    // Group residues by color for efficient application
    const colorings: ResidueColoring[] = [];

    for (const rule of rules) {
      if (rule.residues) {
        const colorInt = parseInt(rule.color.replace('#', ''), 16);
        for (const { chainId, authSeqId } of rule.residues) {
          colorings.push({
            chainId,
            authSeqId,
            color: Color(colorInt),
          });
        }
      }
    }

    if (colorings.length > 0) {
      console.log('[StructureController] Applying', colorings.length, 'residue colorings');
      this.instance.applyColorscheme('sync-dispatcher', colorings);
    }
  }

  restoreDefaultColors(): void {
    if (!this.instance) return;
    console.log('[StructureController] restoreDefaultColors');
    this.instance.restoreDefaultColors();
  }

  highlightResidue(chainId: string, authSeqId: number, highlight: boolean): void {
    if (!this.instance) return;
    
    if (highlight) {
      this.instance.highlightResidue(chainId, authSeqId);
    } else {
      this.clearHighlight();
    }
  }

  clearHighlight(): void {
    if (!this.instance) return;
    this.instance.clearHighlight();
  }

  focusResidue(chainId: string, authSeqId: number): void {
    if (!this.instance) return;
    console.log('[StructureController] focusResidue:', chainId, authSeqId);
    this.instance.focusResidue(chainId, authSeqId);
  }

  focusResidueRange(chainId: string, startAuth: number, endAuth: number): void {
    if (!this.instance) return;
    console.log('[StructureController] focusResidueRange:', chainId, startAuth, endAuth);
    this.instance.focusResidueRange(chainId, startAuth, endAuth);
  }
}