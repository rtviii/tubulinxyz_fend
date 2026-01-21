// src/lib/controllers/MSAController.ts

import { ColorRule, IMSAController } from '../types/sync';
import { ResizableMSAContainerHandle } from '@/app/msalite/components/ResizableMSAContainer';

/**
 * Controller for MSA operations.
 * Wraps the ResizableMSAContainer and provides a clean API.
 */
export class MSAController implements IMSAController {
  private msaRef: React.RefObject<ResizableMSAContainerHandle>;
  private currentScheme: string = 'clustal2';

  constructor(msaRef: React.RefObject<ResizableMSAContainerHandle>) {
    this.msaRef = msaRef;
  }

  setColorScheme(scheme: string): void {
    console.log('[MSAController] setColorScheme:', scheme);
    this.currentScheme = scheme;
    this.msaRef.current?.setColorScheme(scheme);
    this.msaRef.current?.redraw();
  }

  applyColors(rules: ColorRule[], defaultColor: string): void {
    console.log('[MSAController] applyColors:', rules.length, 'rules');
    
    // Build nightingale color config
    const positionColors: Record<number, string> = {};
    const cellColors: Record<string, string> = {};

    for (const rule of rules) {
      // Column-wide coloring
      if (rule.msaColumns) {
        for (const pos of rule.msaColumns) {
          positionColors[pos] = rule.color;
        }
      }

      // Row-specific coloring
      if (rule.msaCells) {
        for (const { row, column } of rule.msaCells) {
          cellColors[`${row}-${column}`] = rule.color;
        }
      }
    }

    // Update the global config
    window.__nightingaleCustomColors = {
      positionColors,
      cellColors: Object.keys(cellColors).length > 0 ? cellColors : undefined,
      defaultColor,
    };

    console.log('[MSAController] Applied config:', {
      positionColors: Object.keys(positionColors).length,
      cellColors: Object.keys(cellColors).length,
      defaultColor,
    });

    // Switch to custom scheme and redraw
    this.setColorScheme('custom-position');
  }

  clearColors(): void {
    console.log('[MSAController] clearColors');
    delete window.__nightingaleCustomColors;
    this.setColorScheme('clustal2');
  }

  jumpToRange(start: number, end: number): void {
    console.log('[MSAController] jumpToRange:', start, end);
    this.msaRef.current?.jumpToRange(start, end);
  }

  redraw(): void {
    console.log('[MSAController] redraw');
    this.msaRef.current?.redraw();
  }

  getCurrentScheme(): string {
    return this.currentScheme;
  }
}