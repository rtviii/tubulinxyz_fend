// src/lib/controllers/MSAController.ts

import { ColorRule, IMSAController } from '../types/sync';
import { ResizableMSAContainerHandle } from '@/app/msalite/components/ResizableMSAContainer';

/**
 * Controller for MSA operations.
 * Wraps the ResizableMSAContainer and provides a clean API for the SyncDispatcher.
 */
export class MSAController implements IMSAController {
  private msaRef: React.RefObject<ResizableMSAContainerHandle>;
  private currentScheme: string = 'clustal2';

  constructor(msaRef: React.RefObject<ResizableMSAContainerHandle>) {
    this.msaRef = msaRef;
  }

  // ============================================================
  // Color Scheme Methods
  // ============================================================

  setColorScheme(scheme: string): void {
    console.log('[MSAController] setColorScheme:', scheme);
    this.currentScheme = scheme;
    this.msaRef.current?.setColorScheme(scheme);
    this.msaRef.current?.redraw();
  }

  getCurrentScheme(): string {
    return this.currentScheme;
  }

  // ============================================================
  // Annotation Coloring Methods
  // ============================================================

  applyColors(rules: ColorRule[], defaultColor: string): void {
    console.log('[MSAController] applyColors:', rules.length, 'rules');

    // Build nightingale color config from rules
    const positionColors: Record<number, string> = {};
    const cellColors: Record<string, string> = {};

    for (const rule of rules) {
      // Column-wide coloring (applies to all sequences)
      if (rule.msaColumns) {
        for (const pos of rule.msaColumns) {
          positionColors[pos] = rule.color;
        }
      }

      // Row-specific coloring (applies to specific sequence rows)
      if (rule.msaCells) {
        for (const { row, column } of rule.msaCells) {
          cellColors[`${row}-${column}`] = rule.color;
        }
      }
    }

    // Update the global config used by nightingale's custom color scheme
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

  // ============================================================
  // Navigation Methods
  // ============================================================

  jumpToRange(start: number, end: number): void {
    console.log('[MSAController] jumpToRange:', start, end);
    this.msaRef.current?.jumpToRange(start, end);
  }

  redraw(): void {
    console.log('[MSAController] redraw');
    this.msaRef.current?.redraw();
  }

  // ============================================================
  // Hover Highlight Methods
  // ============================================================

  /**
   * Highlight a single MSA position (column) across all sequences.
   * Used for hover sync from Molstar -> MSA.
   * 
   * This uses nightingale's built-in highlight attribute which draws
   * a colored rectangle over the specified region.
   */
  highlightPosition(msaPosition: number): void {
    console.log('[MSAController] highlightPosition:', msaPosition);
    this.msaRef.current?.setHighlight(msaPosition, msaPosition);
  }

  /**
   * Highlight a range of MSA positions (columns) across all sequences.
   * Used for range selection or binding site hover preview.
   */
  highlightRange(start: number, end: number): void {
    console.log('[MSAController] highlightRange:', start, '-', end);
    this.msaRef.current?.setHighlight(start, end);
  }

  /**
   * Clear the hover highlight.
   * Called when mouse leaves the triggering element (Molstar residue,
   * annotation panel item, etc.)
   */
  clearHighlight(): void {
    console.log('[MSAController] clearHighlight');
    this.msaRef.current?.clearHighlight();
  }
}