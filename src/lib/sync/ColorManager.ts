// src/lib/sync/ColorManager.ts

import { ColorRule, ColorState } from './types';

/**
 * Central color state manager with priority-based resolution.
 */
export class ColorManager {
  private state: ColorState = {
    rules: [],
    defaultColor: '#ffffff',
  };

  private listeners: Set<() => void> = new Set();

  addRule(rule: ColorRule): void {
    this.state.rules = this.state.rules.filter((r) => r.id !== rule.id);
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

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener());
  }
}