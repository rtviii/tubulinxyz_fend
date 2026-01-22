// src/lib/sync/SyncDispatcher.ts

import {
  SyncAction,
  ColorRule,
  PositionMapping,
  PositionMapper,
  createPositionMapper,
  ColorState,
} from './types';
import { ColorManager } from './ColorManager';
import { MSAController } from './MSAController';
import { StructureController } from './StructureController';

/**
 * Central dispatcher coordinating MSA and Structure controllers.
 * 
 * Handles:
 * - Bidirectional hover sync between MSA and Molstar
 * - Color rule management (binding sites, mutations, etc.)
 * - Navigation commands (jump to range, focus residue)
 */
export class SyncDispatcher {
  private colorManager: ColorManager;
  private msaController: MSAController | null = null;
  private structureController: StructureController | null = null;
  private positionMapper: PositionMapper | null = null;
  private chainId: string | null = null;

  constructor() {
    this.colorManager = new ColorManager();
    this.colorManager.subscribe(() => this.syncColors());
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

  setContext(chainId: string, positionMapping: PositionMapping | null): void {
    this.chainId = chainId;
    this.positionMapper = createPositionMapper(positionMapping);
  }

  clearContext(): void {
    this.chainId = null;
    this.positionMapper = null;
  }

  // ============================================================
  // Action Dispatch
  // ============================================================

  dispatch(action: SyncAction): void {
    switch (action.type) {
      case 'ADD_COLOR_RULE':
        this.colorManager.addRule(action.rule);
        break;
      case 'REMOVE_COLOR_RULE':
        this.colorManager.removeRule(action.id);
        this.syncColors();
        break;
      case 'CLEAR_COLORS':
        this.colorManager.clearRules();
        this.msaController?.clearColors();
        this.structureController?.restoreDefaultColors();
        break;
      case 'SET_COLOR_SCHEME':
        this.colorManager.clearRules();
        this.msaController?.setColorScheme(action.scheme);
        this.structureController?.restoreDefaultColors();
        break;
      case 'HIGHLIGHT_RESIDUE':
        this.handleHighlightResidue(action.chainId, action.authSeqId, action.msaPosition);
        break;
      case 'CLEAR_HIGHLIGHT':
        this.structureController?.clearHighlight();
        this.msaController?.clearHighlight();
        break;
      case 'FOCUS_RESIDUE':
        this.handleFocusResidue(action.chainId, action.authSeqId, action.msaPosition);
        break;
      case 'FOCUS_RANGE':
        this.structureController?.focusResidueRange(action.chainId, action.startAuth, action.endAuth);
        if (action.msaStart !== undefined && action.msaEnd !== undefined) {
          this.msaController?.jumpToRange(action.msaStart, action.msaEnd);
        }
        break;
      case 'JUMP_TO_RANGE':
        this.msaController?.jumpToRange(action.start, action.end);
        if (this.chainId && this.positionMapper) {
          const startAuth = this.positionMapper.msaToAuth(action.start);
          const endAuth = this.positionMapper.msaToAuth(action.end);
          if (startAuth !== undefined && endAuth !== undefined) {
            this.structureController?.focusResidueRange(this.chainId, startAuth, endAuth);
          }
        }
        break;
    }
  }

  // ============================================================
  // Highlight Handlers
  // ============================================================

  private handleHighlightResidue(chainId: string, authSeqId?: number, msaPosition?: number): void {
    let resolvedAuthSeqId = authSeqId;
    let resolvedMsaPosition = msaPosition;

    if (resolvedAuthSeqId === undefined && resolvedMsaPosition !== undefined) {
      resolvedAuthSeqId = this.positionMapper?.msaToAuth(resolvedMsaPosition);
    }
    if (resolvedMsaPosition === undefined && resolvedAuthSeqId !== undefined) {
      resolvedMsaPosition = this.positionMapper?.authToMSA(resolvedAuthSeqId);
    }

    if (resolvedAuthSeqId !== undefined) {
      this.structureController?.highlightResidue(chainId, resolvedAuthSeqId, true);
    }
    if (resolvedMsaPosition !== undefined) {
      this.msaController?.highlightPosition(resolvedMsaPosition);
    }
  }

  private handleFocusResidue(chainId: string, authSeqId?: number, msaPosition?: number): void {
    let resolvedAuthSeqId = authSeqId;
    let resolvedMsaPosition = msaPosition;

    if (resolvedAuthSeqId === undefined && resolvedMsaPosition !== undefined) {
      resolvedAuthSeqId = this.positionMapper?.msaToAuth(resolvedMsaPosition);
    }
    if (resolvedMsaPosition === undefined && resolvedAuthSeqId !== undefined) {
      resolvedMsaPosition = this.positionMapper?.authToMSA(resolvedAuthSeqId);
    }

    if (resolvedAuthSeqId !== undefined) {
      this.structureController?.focusResidue(chainId, resolvedAuthSeqId);
    }
    if (resolvedMsaPosition !== undefined) {
      this.msaController?.jumpToRange(resolvedMsaPosition, resolvedMsaPosition);
    }
  }

  // ============================================================
  // Color Sync
  // ============================================================

  private syncColors(): void {
    const state = this.colorManager.getState();

    if (state.rules.length === 0) {
      this.msaController?.clearColors();
      this.structureController?.restoreDefaultColors();
      return;
    }

    this.msaController?.applyColors(state.rules, state.defaultColor);
    this.structureController?.applyColors(state.rules);
  }

  // ============================================================
  // Event Handlers (for external callers)
  // ============================================================

  onMolstarHover(chainId: string, authSeqId: number): void {
    if (chainId !== this.chainId) return;
    this.dispatch({ type: 'HIGHLIGHT_RESIDUE', chainId, authSeqId });
  }

  onMolstarHoverEnd(): void {
    this.dispatch({ type: 'CLEAR_HIGHLIGHT' });
  }

  onMSAHover(msaPosition: number): void {
    if (!this.chainId) return;
    this.dispatch({ type: 'HIGHLIGHT_RESIDUE', chainId: this.chainId, msaPosition });
  }

  onMSAHoverEnd(): void {
    this.dispatch({ type: 'CLEAR_HIGHLIGHT' });
  }

  highlightFromAnnotation(msaPosition: number): void {
    if (!this.chainId) return;
    this.dispatch({ type: 'HIGHLIGHT_RESIDUE', chainId: this.chainId, msaPosition });
  }

  highlightRangeFromAnnotation(msaStart: number, msaEnd: number): void {
    if (!this.chainId) return;
    this.msaController?.highlightRange(msaStart, msaEnd);
    if (this.positionMapper) {
      const startAuth = this.positionMapper.msaToAuth(msaStart);
      if (startAuth !== undefined) {
        this.structureController?.highlightResidue(this.chainId, startAuth, true);
      }
    }
  }

  clearHighlight(): void {
    this.dispatch({ type: 'CLEAR_HIGHLIGHT' });
  }

  // ============================================================
  // Binding Sites
  // ============================================================

  addBindingSite(id: string, name: string, color: string, msaPositions: number[], priority: number = 10): void {
    const residues: Array<{ chainId: string; authSeqId: number }> = [];

    if (this.chainId && this.positionMapper) {
      for (const msaPos of msaPositions) {
        const authSeqId = this.positionMapper.msaToAuth(msaPos);
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

  removeBindingSite(id: string): void {
    this.dispatch({ type: 'REMOVE_COLOR_RULE', id });
  }

  // ============================================================
  // Mutations
  // ============================================================

  addMutations(id: string, mutations: Array<{ msaPosition: number; color: string }>, rowIndex: number, priority: number = 5): void {
    if (mutations.length === 0) return;

    const residues: Array<{ chainId: string; authSeqId: number }> = [];

    if (this.chainId && this.positionMapper) {
      for (const { msaPosition } of mutations) {
        const authSeqId = this.positionMapper.msaToAuth(msaPosition);
        if (authSeqId !== undefined) {
          residues.push({ chainId: this.chainId, authSeqId });
        }
      }
    }

    const rule: ColorRule = {
      id,
      type: 'mutation',
      priority,
      msaCells: mutations.map((m) => ({ row: rowIndex, column: m.msaPosition })),
      residues,
      color: mutations[0].color,
    };

    this.dispatch({ type: 'ADD_COLOR_RULE', rule });
  }

  removeMutations(id: string): void {
    this.dispatch({ type: 'REMOVE_COLOR_RULE', id });
  }

  // ============================================================
  // General
  // ============================================================

  clearAllColors(): void {
    this.dispatch({ type: 'CLEAR_COLORS' });
  }

  setColorScheme(scheme: string): void {
    this.dispatch({ type: 'SET_COLOR_SCHEME', scheme });
  }

  getColorState(): ColorState {
    return this.colorManager.getState();
  }

  getCurrentColorScheme(): string | null {
    return this.msaController?.getCurrentScheme() || null;
  }

  getActiveChainId(): string | null {
    return this.chainId;
  }

  hasContext(): boolean {
    return this.chainId !== null && this.positionMapper !== null;
  }
}