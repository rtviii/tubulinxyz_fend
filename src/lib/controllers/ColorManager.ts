// src/lib/controllers/ColorManager.ts

import { ColorRule, ColorState } from '../types/sync';

/**
 * Central color state manager.
 * Manages color rules with priority-based resolution.
 */
export class ColorManager {
  private state: ColorState = {
    rules: [],
    defaultColor: '#ffffff',
  };

  private listeners: Set<() => void> = new Set();

  addRule(rule: ColorRule): void {
    // Remove existing rule with same ID
    this.state.rules = this.state.rules.filter((r) => r.id !== rule.id);
    
    // Add new rule and sort by priority (descending)
    this.state.rules.push(rule);
    this.state.rules.sort((a, b) => b.priority - a.priority);
    
    this.notify();
  }

  removeRule(id: string): void {
    const prevLength = this.state.rules.length;
    this.state.rules = this.state.rules.filter((r) => r.id !== id);
    
    if (this.state.rules.length !== prevLength) {
      this.notify();
    }
  }

  clearRules(): void {
    if (this.state.rules.length > 0) {
      this.state.rules = [];
      this.notify();
    }
  }

  setDefaultColor(color: string): void {
    if (this.state.defaultColor !== color) {
      this.state.defaultColor = color;
      this.notify();
    }
  }

  getState(): ColorState {
    return {
      rules: [...this.state.rules],
      defaultColor: this.state.defaultColor,
    };
  }

  /**
   * Resolve MSA column colors from current rules.
   * Returns a map of position -> color (highest priority wins).
   */
  resolveMSAColumnColors(): Map<number, string> {
    const colors = new Map<number, string>();
    
    // Rules are already sorted by priority (descending)
    // We iterate in reverse so lower priority is overwritten by higher
    for (let i = this.state.rules.length - 1; i >= 0; i--) {
      const rule = this.state.rules[i];
      if (rule.msaColumns) {
        for (const pos of rule.msaColumns) {
          colors.set(pos, rule.color);
        }
      }
    }
    
    return colors;
  }

  /**
   * Resolve MSA cell colors (row-specific) from current rules.
   * Returns a map of "row-column" -> color.
   */
  resolveMSACellColors(): Map<string, string> {
    const colors = new Map<string, string>();
    
    for (let i = this.state.rules.length - 1; i >= 0; i--) {
      const rule = this.state.rules[i];
      if (rule.msaCells) {
        for (const { row, column } of rule.msaCells) {
          colors.set(`${row}-${column}`, rule.color);
        }
      }
    }
    
    return colors;
  }

  /**
   * Resolve Molstar residue colors from current rules.
   * Returns residues grouped by color for efficient application.
   */
  resolveMolstarColors(): Array<{
    color: string;
    residues: Array<{ chainId: string; authSeqId: number }>;
  }> {
    const colorMap = new Map<string, Array<{ chainId: string; authSeqId: number }>>();
    
    for (let i = this.state.rules.length - 1; i >= 0; i--) {
      const rule = this.state.rules[i];
      if (rule.residues) {
        if (!colorMap.has(rule.color)) {
          colorMap.set(rule.color, []);
        }
        colorMap.get(rule.color)!.push(...rule.residues);
      }
    }
    
    return Array.from(colorMap.entries()).map(([color, residues]) => ({
      color,
      residues,
    }));
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener());
  }
}