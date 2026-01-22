// src/lib/sync/StructureController.ts

import { ColorRule, IStructureController } from './types';
import { MolstarInstance } from '@/components/molstar/services/MolstarInstance';
import { ResidueColoring } from '@/components/molstar/coloring/types';
import { Color } from 'molstar/lib/mol-util/color';

/**
 * Controller for Molstar structure operations.
 */
export class StructureController implements IStructureController {
  constructor(private instance: MolstarInstance | null) {}

  setInstance(instance: MolstarInstance | null): void {
    this.instance = instance;
  }

  applyColors(rules: ColorRule[]): void {
    if (!this.instance) return;

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
      this.instance.applyColorscheme('sync-dispatcher', colorings);
    }
  }

  restoreDefaultColors(): void {
    this.instance?.restoreDefaultColors();
  }

  highlightResidue(chainId: string, authSeqId: number, highlight: boolean): void {
    if (!this.instance) return;
    if (highlight) {
      this.instance.highlightResidue(chainId, authSeqId, true);
    } else {
      this.clearHighlight();
    }
  }

  clearHighlight(): void {
    this.instance?.clearHighlight();
  }

  focusResidue(chainId: string, authSeqId: number): void {
    this.instance?.focusResidue(chainId, authSeqId);
  }

  focusResidueRange(chainId: string, startAuth: number, endAuth: number): void {
    this.instance?.focusResidueRange(chainId, startAuth, endAuth);
  }
}