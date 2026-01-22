// src/lib/sync/MSAController.ts

import { ColorRule, IMSAController, NightingaleColorConfig } from './types';

export interface ResizableMSAContainerHandle {
  redraw: () => void;
  jumpToRange: (start: number, end: number) => void;
  setColorScheme: (scheme: string) => void;
  setHighlight: (start: number, end: number) => void;
  clearHighlight: () => void;
}

/**
 * Controller for MSA operations.
 * Manages the Nightingale MSA component and its custom color configuration.
 */
export class MSAController implements IMSAController {
  private msaRef: React.RefObject<ResizableMSAContainerHandle>;
  private currentScheme: string = 'clustal2';

  constructor(msaRef: React.RefObject<ResizableMSAContainerHandle>) {
    this.msaRef = msaRef;
  }

  // ============================================================
  // Color Scheme
  // ============================================================

  setColorScheme(scheme: string): void {
    this.currentScheme = scheme;
    this.msaRef.current?.setColorScheme(scheme);
    this.msaRef.current?.redraw();
  }

  getCurrentScheme(): string {
    return this.currentScheme;
  }

  // ============================================================
  // Custom Color Application
  // ============================================================

  applyColors(rules: ColorRule[], defaultColor: string): void {
    const positionColors: Record<number, string> = {};
    const cellColors: Record<string, string> = {};

    for (const rule of rules) {
      if (rule.msaColumns) {
        for (const pos of rule.msaColumns) {
          positionColors[pos] = rule.color;
        }
      }
      if (rule.msaCells) {
        for (const { row, column } of rule.msaCells) {
          cellColors[`${row}-${column}`] = rule.color;
        }
      }
    }

    const config: NightingaleColorConfig = {
      positionColors,
      cellColors: Object.keys(cellColors).length > 0 ? cellColors : undefined,
      defaultColor,
    };

    window.__nightingaleCustomColors = config;
    this.setColorScheme('custom-position');
  }

  clearColors(): void {
    delete window.__nightingaleCustomColors;
    this.setColorScheme('clustal2');
  }

  // ============================================================
  // Navigation
  // ============================================================

  jumpToRange(start: number, end: number): void {
    this.msaRef.current?.jumpToRange(start, end);
  }

  redraw(): void {
    this.msaRef.current?.redraw();
  }

  // ============================================================
  // Hover Highlighting
  // ============================================================

  highlightPosition(msaPosition: number): void {
    this.msaRef.current?.setHighlight(msaPosition, msaPosition);
  }

  highlightRange(start: number, end: number): void {
    this.msaRef.current?.setHighlight(start, end);
  }

  clearHighlight(): void {
    this.msaRef.current?.clearHighlight();
  }
}