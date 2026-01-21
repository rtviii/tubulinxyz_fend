// src/lib/controllers/SyncDispatcher.ts

import { SyncAction, ColorRule, PositionMapping } from '../types/sync';
import { ColorManager } from './ColorManager';
import { MSAController } from './MSAController';
import { StructureController } from './StructureController';

/**
 * Central dispatcher that coordinates MSA and Structure controllers.
 * Handles actions and ensures both views stay in sync.
 */
export class SyncDispatcher {
  private colorManager: ColorManager;
  private msaController: MSAController | null = null;
  private structureController: StructureController | null = null;
  private positionMapping: PositionMapping | null = null;
  private chainId: string | null = null;

  constructor() {
    this.colorManager = new ColorManager();

    // Subscribe to color changes and auto-sync
    this.colorManager.subscribe(() => {
      this.syncColors();
    });
  }

  // ============================================================
  // Setup
  // ============================================================

  setMSAController(controller: MSAController): void {
    this.msaController = controller;
  }

  setStructureController(controller: StructureController): void {
    this.structureController = controller;
  }

  setContext(chainId: string, positionMapping: PositionMapping): void {
    this.chainId = chainId;
    this.positionMapping = positionMapping;
  }

  clearContext(): void {
    this.chainId = null;
    this.positionMapping = null;
  }

  // ============================================================
  // Action dispatch
  // ============================================================

  dispatch(action: SyncAction): void {
    console.log('[SyncDispatcher] Dispatching:', action.type);

    switch (action.type) {
      case 'ADD_COLOR_RULE':
        this.handleAddColorRule(action.rule);
        break;

      case 'REMOVE_COLOR_RULE':
        this.handleRemoveColorRule(action.id);
        break;

      case 'CLEAR_COLORS':
        this.handleClearColors();
        break;

      case 'SET_COLOR_SCHEME':
        this.handleSetColorScheme(action.scheme);
        break;

      case 'HIGHLIGHT_RESIDUE':
        this.handleHighlightResidue(action.chainId, action.authSeqId, action.msaPosition);
        break;

      case 'CLEAR_HIGHLIGHT':
        this.handleClearHighlight();
        break;

      case 'FOCUS_RESIDUE':
        this.handleFocusResidue(action.chainId, action.authSeqId, action.msaPosition);
        break;

      case 'FOCUS_RANGE':
        this.handleFocusRange(action.chainId, action.startAuth, action.endAuth, action.msaStart, action.msaEnd);
        break;

      case 'JUMP_TO_RANGE':
        this.handleJumpToRange(action.start, action.end);
        break;

      default:
        console.warn('[SyncDispatcher] Unknown action:', (action as any).type);
    }
  }

  // ============================================================
  // Action handlers
  // ============================================================

  private handleAddColorRule(rule: ColorRule): void {
    this.colorManager.addRule(rule);
    // syncColors() is called automatically via subscription
  }

  private handleRemoveColorRule(id: string): void {
    this.colorManager.removeRule(id);
  }

  private handleClearColors(): void {
    this.colorManager.clearRules();
    this.msaController?.clearColors();
    this.structureController?.restoreDefaultColors();
  }

  private handleSetColorScheme(scheme: string): void {
    this.colorManager.clearRules();
    this.msaController?.setColorScheme(scheme);
    this.structureController?.restoreDefaultColors();
  }

  private handleHighlightResidue(chainId: string, authSeqId: number, msaPosition?: number): void {
    this.structureController?.highlightResidue(chainId, authSeqId, true);
    // TODO: Highlight in MSA if needed
  }

  private handleClearHighlight(): void {
    this.structureController?.clearHighlight();
  }

  private handleFocusResidue(chainId: string, authSeqId: number, msaPosition?: number): void {
    this.structureController?.focusResidue(chainId, authSeqId);
    
    if (msaPosition !== undefined) {
      this.msaController?.jumpToRange(msaPosition, msaPosition);
    }
  }

  private handleFocusRange(
    chainId: string,
    startAuth: number,
    endAuth: number,
    msaStart?: number,
    msaEnd?: number
  ): void {
    this.structureController?.focusResidueRange(chainId, startAuth, endAuth);
    
    if (msaStart !== undefined && msaEnd !== undefined) {
      this.msaController?.jumpToRange(msaStart, msaEnd);
    }
  }

  private handleJumpToRange(start: number, end: number): void {
    this.msaController?.jumpToRange(start, end);
    
    // Also focus structure if we have mapping
    if (this.chainId && this.positionMapping) {
      const startAuth = this.positionMapping[start];
      const endAuth = this.positionMapping[end];
      
      if (startAuth !== undefined && endAuth !== undefined) {
        this.structureController?.focusResidueRange(this.chainId, startAuth, endAuth);
      }
    }
  }

  // ============================================================
  // Color synchronization
  // ============================================================

  private syncColors(): void {
    const state = this.colorManager.getState();
    
    console.log('[SyncDispatcher] Syncing colors:', state.rules.length, 'rules');

    if (state.rules.length === 0) {
      this.msaController?.clearColors();
      this.structureController?.restoreDefaultColors();
      return;
    }

    // Apply to MSA
    this.msaController?.applyColors(state.rules, state.defaultColor);

    // Apply to structure
    this.structureController?.applyColors(state.rules);
  }

  // ============================================================
  // Helper methods for building color rules
  // ============================================================

  addBindingSite(
    id: string,
    name: string,
    color: string,
    msaPositions: number[],
    priority: number = 10
  ): void {
    const residues: Array<{ chainId: string; authSeqId: number }> = [];

    if (this.chainId && this.positionMapping) {
      for (const msaPos of msaPositions) {
        const authSeqId = this.positionMapping[msaPos];
        if (authSeqId !== undefined) {
          residues.push({ chainId: this.chainId, authSeqId });
        }
      }
    }

    const rule: ColorRule = {
      id,
      type: 'binding-site',
      priority,
      msaColumns: msaPositions,
      residues,
      color,
      label: name,
    };

    this.dispatch({ type: 'ADD_COLOR_RULE', rule });
  }

  addMutations(
    id: string,
    mutations: Array<{ msaPosition: number; color: string }>,
    rowIndex: number,
    priority: number = 5
  ): void {
    const msaCells = mutations.map(({ msaPosition }) => ({
      row: rowIndex,
      column: msaPosition,
    }));

    const residues: Array<{ chainId: string; authSeqId: number }> = [];

    if (this.chainId && this.positionMapping) {
      for (const { msaPosition } of mutations) {
        const authSeqId = this.positionMapping[msaPosition];
        if (authSeqId !== undefined) {
          residues.push({ chainId: this.chainId, authSeqId });
        }
      }
    }

    // For simplicity, using first mutation's color for the entire rule
    // In a real scenario, you might want separate rules per mutation
    const color = mutations[0]?.color || '#ff0000';

    const rule: ColorRule = {
      id,
      type: 'mutation',
      priority,
      msaCells,
      residues,
      color,
    };

    this.dispatch({ type: 'ADD_COLOR_RULE', rule });
  }

  removeBindingSite(id: string): void {
    this.dispatch({ type: 'REMOVE_COLOR_RULE', id });
  }

  clearAllColors(): void {
    this.dispatch({ type: 'CLEAR_COLORS' });
  }

  setColorScheme(scheme: string): void {
    this.dispatch({ type: 'SET_COLOR_SCHEME', scheme });
  }

  // ============================================================
  // Getters
  // ============================================================

  getColorState() {
    return this.colorManager.getState();
  }

  getCurrentColorScheme(): string | null {
    return this.msaController?.getCurrentScheme() || null;
  }
}