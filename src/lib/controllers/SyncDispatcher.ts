// src/lib/controllers/SyncDispatcher.ts

import {
  SyncAction,
  ColorRule,
  PositionMapping,
  PositionMapper,
  createPositionMapper,
  ColorState,
} from '../types/sync';
import { ColorManager } from './ColorManager';
import { MSAController } from './MSAController';
import { StructureController } from './StructureController';

/**
 * Central dispatcher that coordinates MSA and Structure controllers.
 * Handles actions and ensures both views stay in sync.
 * 
 * This is the main entry point for:
 * - Bidirectional hover sync between MSA and Molstar
 * - Color rule management (binding sites, mutations, etc.)
 * - Navigation commands (jump to range, focus residue)
 * 
 * Usage:
 *   const dispatcher = new SyncDispatcher();
 *   dispatcher.setMSAController(msaController);
 *   dispatcher.setStructureController(structureController);
 *   dispatcher.setContext(chainId, positionMapping);
 *   
 *   // Then wire up events:
 *   molstarViewer.subscribeToHover(info => dispatcher.onMolstarHover(...));
 *   msaContainer.onResidueHover = pos => dispatcher.onMSAHover(pos);
 */
export class SyncDispatcher {
  private colorManager: ColorManager;
  private msaController: MSAController | null = null;
  private structureController: StructureController | null = null;

  // Position mapping context
  private positionMapper: PositionMapper | null = null;
  private chainId: string | null = null;

  constructor() {
    this.colorManager = new ColorManager();

    // Subscribe to color changes and auto-sync both views
    this.colorManager.subscribe(() => {
      this.syncColors();
    });
  }

  // ============================================================
  // Setup Methods
  // ============================================================

  /**
   * Set the MSA controller. Call this when the MSA ref becomes available.
   */
  setMSAController(controller: MSAController): void {
    this.msaController = controller;
  }

  /**
   * Set the Structure controller. Call this when Molstar instance is ready.
   */
  setStructureController(controller: StructureController): void {
    this.structureController = controller;
  }

  /**
   * Set the current context for position mapping.
   * Call this when the active chain changes or when mapping data is loaded.
   * 
   * @param chainId - The auth_asym_id of the active chain
   * @param positionMapping - Map from MSA position -> auth_seq_id
   */
  setContext(chainId: string, positionMapping: PositionMapping | null): void {
    this.chainId = chainId;
    this.positionMapper = createPositionMapper(positionMapping);
    console.log('[SyncDispatcher] Context set:', { chainId, hasMapping: !!positionMapping });
  }

  /**
   * Clear the context (e.g., when exiting monomer view).
   */
  clearContext(): void {
    this.chainId = null;
    this.positionMapper = null;
    console.log('[SyncDispatcher] Context cleared');
  }

  // ============================================================
  // Action Dispatch
  // ============================================================

  /**
   * Main dispatch method. Handles all sync actions.
   */
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
        this.handleFocusRange(
          action.chainId,
          action.startAuth,
          action.endAuth,
          action.msaStart,
          action.msaEnd
        );
        break;

      case 'JUMP_TO_RANGE':
        this.handleJumpToRange(action.start, action.end);
        break;

      default:
        console.warn('[SyncDispatcher] Unknown action:', (action as any).type);
    }
  }

  // ============================================================
  // Color Rule Handlers
  // ============================================================

  private handleAddColorRule(rule: ColorRule): void {
    this.colorManager.addRule(rule);
    // syncColors() is called automatically via subscription
  }

  private handleRemoveColorRule(id: string): void {
    this.colorManager.removeRule(id);
    // Need to explicitly sync since removeRule might not trigger if rule didn't exist
    this.syncColors();
  }

  private handleClearColors(): void {
    this.colorManager.clearRules();
    this.msaController?.clearColors();
    this.structureController?.restoreDefaultColors();
  }

  private handleSetColorScheme(scheme: string): void {
    // Clear any custom color rules first
    this.colorManager.clearRules();
    // Set the base color scheme on MSA
    this.msaController?.setColorScheme(scheme);
    // Restore default colors on structure
    this.structureController?.restoreDefaultColors();
  }

  // ============================================================
  // Highlight Handlers - BIDIRECTIONAL
  // ============================================================

  /**
   * Highlight a residue in BOTH viewers.
   * 
   * Can be called from:
   *   - MSA hover (provides msaPosition, we convert to authSeqId)
   *   - Molstar hover (provides chainId + authSeqId, we convert to msaPosition)
   *   - External component (can provide either or both)
   * 
   * The handler resolves any missing coordinates using the position mapper.
   */
  private handleHighlightResidue(
    chainId: string,
    authSeqId?: number,
    msaPosition?: number
  ): void {
    // Resolve missing coordinates via mapping
    let resolvedAuthSeqId = authSeqId;
    let resolvedMsaPosition = msaPosition;

    if (resolvedAuthSeqId === undefined && resolvedMsaPosition !== undefined) {
      resolvedAuthSeqId = this.positionMapper?.msaToAuth(resolvedMsaPosition);
    }
    if (resolvedMsaPosition === undefined && resolvedAuthSeqId !== undefined) {
      resolvedMsaPosition = this.positionMapper?.authToMSA(resolvedAuthSeqId);
    }

    console.log('[SyncDispatcher] Highlight resolved:', {
      chainId,
      authSeqId: resolvedAuthSeqId,
      msaPosition: resolvedMsaPosition,
    });

    // Highlight in structure (if we have auth_seq_id)
    if (resolvedAuthSeqId !== undefined) {
      this.structureController?.highlightResidue(chainId, resolvedAuthSeqId, true);
    }

    // Highlight in MSA (if we have msa position)
    if (resolvedMsaPosition !== undefined) {
      this.msaController?.highlightPosition(resolvedMsaPosition);
    }
  }

  private handleClearHighlight(): void {
    this.structureController?.clearHighlight();
    this.msaController?.clearHighlight();
  }

  // ============================================================
  // Focus Handlers
  // ============================================================

  private handleFocusResidue(
    chainId: string,
    authSeqId?: number,
    msaPosition?: number
  ): void {
    // Resolve missing coordinates
    let resolvedAuthSeqId = authSeqId;
    let resolvedMsaPosition = msaPosition;

    if (resolvedAuthSeqId === undefined && resolvedMsaPosition !== undefined) {
      resolvedAuthSeqId = this.positionMapper?.msaToAuth(resolvedMsaPosition);
    }
    if (resolvedMsaPosition === undefined && resolvedAuthSeqId !== undefined) {
      resolvedMsaPosition = this.positionMapper?.authToMSA(resolvedAuthSeqId);
    }

    // Focus camera in structure
    if (resolvedAuthSeqId !== undefined) {
      this.structureController?.focusResidue(chainId, resolvedAuthSeqId);
    }

    // Jump to position in MSA
    if (resolvedMsaPosition !== undefined) {
      this.msaController?.jumpToRange(resolvedMsaPosition, resolvedMsaPosition);
    }
  }

  private handleFocusRange(
    chainId: string,
    startAuth: number,
    endAuth: number,
    msaStart?: number,
    msaEnd?: number
  ): void {
    // Focus camera on range in structure
    this.structureController?.focusResidueRange(chainId, startAuth, endAuth);

    // Jump to range in MSA
    if (msaStart !== undefined && msaEnd !== undefined) {
      this.msaController?.jumpToRange(msaStart, msaEnd);
    }
  }

  private handleJumpToRange(start: number, end: number): void {
    // Jump in MSA
    this.msaController?.jumpToRange(start, end);

    // Also focus structure if we have mapping
    if (this.chainId && this.positionMapper) {
      const startAuth = this.positionMapper.msaToAuth(start);
      const endAuth = this.positionMapper.msaToAuth(end);

      if (startAuth !== undefined && endAuth !== undefined) {
        this.structureController?.focusResidueRange(this.chainId, startAuth, endAuth);
      }
    }
  }

  // ============================================================
  // Color Synchronization
  // ============================================================

  /**
   * Sync current color state to both controllers.
   * Called automatically when color rules change.
   */
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
  // Convenience Methods for External Callers
  // ============================================================

  /**
   * Called when Molstar emits a hover event.
   * Translates to MSA position and highlights both views.
   * 
   * @param chainId - The chain being hovered
   * @param authSeqId - The residue auth_seq_id
   */
  onMolstarHover(chainId: string, authSeqId: number): void {
    // Only sync if this is the active chain we're tracking
    if (chainId !== this.chainId) {
      console.log('[SyncDispatcher] Ignoring hover on non-active chain:', chainId);
      return;
    }

    this.dispatch({
      type: 'HIGHLIGHT_RESIDUE',
      chainId,
      authSeqId,
      msaPosition: undefined, // Will be resolved by handler
    });
  }

  /**
   * Called when Molstar hover leaves (mouse exits residue).
   */
  onMolstarHoverEnd(): void {
    this.dispatch({ type: 'CLEAR_HIGHLIGHT' });
  }

  /**
   * Called when MSA emits a hover event.
   * Translates to structure position and highlights both views.
   * 
   * @param msaPosition - The MSA column position (1-based)
   */
  onMSAHover(msaPosition: number): void {
    if (!this.chainId) {
      console.log('[SyncDispatcher] Ignoring MSA hover - no active chain');
      return;
    }

    this.dispatch({
      type: 'HIGHLIGHT_RESIDUE',
      chainId: this.chainId,
      authSeqId: undefined, // Will be resolved by handler
      msaPosition,
    });
  }

  /**
   * Called when MSA hover leaves.
   */
  onMSAHoverEnd(): void {
    this.dispatch({ type: 'CLEAR_HIGHLIGHT' });
  }

  /**
   * Highlight from external component (annotation panel, binding site list, etc.)
   * Accepts MSA position since annotations are typically defined in MSA space.
   * 
   * @param msaPosition - The MSA column position to highlight
   */
  highlightFromAnnotation(msaPosition: number): void {
    if (!this.chainId) {
      console.warn('[SyncDispatcher] Cannot highlight - no active chain');
      return;
    }
    this.dispatch({
      type: 'HIGHLIGHT_RESIDUE',
      chainId: this.chainId,
      msaPosition,
    });
  }

  /**
   * Highlight a range from external component.
   * Useful for hovering over binding site regions.
   */
  highlightRangeFromAnnotation(msaStart: number, msaEnd: number): void {
    if (!this.chainId) return;

    // For range highlight, we use the MSA's highlightRange
    this.msaController?.highlightRange(msaStart, msaEnd);

    // And highlight/focus the structure on the range
    if (this.positionMapper) {
      const startAuth = this.positionMapper.msaToAuth(msaStart);
      const endAuth = this.positionMapper.msaToAuth(msaEnd);
      if (startAuth !== undefined && endAuth !== undefined) {
        // Use highlight not focus - we don't want to move the camera on hover
        this.structureController?.highlightResidue(this.chainId, startAuth, true);
      }
    }
  }

  /**
   * Clear all highlights. Call on mouse leave from any triggering element.
   */
  clearHighlight(): void {
    this.dispatch({ type: 'CLEAR_HIGHLIGHT' });
  }

  // ============================================================
  // Binding Site Methods
  // ============================================================

  /**
   * Add a binding site color rule.
   * Automatically maps MSA positions to structure residues.
   * 
   * @param id - Unique identifier for this site
   * @param name - Display name
   * @param color - Hex color string (e.g., '#FF0000')
   * @param msaPositions - Array of MSA column positions
   * @param priority - Priority for color resolution (default 10)
   */
  addBindingSite(
    id: string,
    name: string,
    color: string,
    msaPositions: number[],
    priority: number = 10
  ): void {
    const residues: Array<{ chainId: string; authSeqId: number }> = [];

    // Map MSA positions to structure residues
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

  /**
   * Remove a binding site color rule.
   */
  removeBindingSite(id: string): void {
    this.dispatch({ type: 'REMOVE_COLOR_RULE', id });
  }

  // ============================================================
  // Mutation Methods
  // ============================================================

  /**
   * Add mutations as color rules.
   * Mutations are typically row-specific (apply to one sequence).
   * 
   * @param id - Unique identifier for this mutation set
   * @param mutations - Array of mutation positions and colors
   * @param rowIndex - Which MSA row (sequence) these apply to
   * @param priority - Priority for color resolution (default 5)
   */
  addMutations(
    id: string,
    mutations: Array<{ msaPosition: number; color: string }>,
    rowIndex: number,
    priority: number = 5
  ): void {
    if (mutations.length === 0) return;

    const residues: Array<{ chainId: string; authSeqId: number }> = [];

    // Map MSA positions to structure residues
    if (this.chainId && this.positionMapper) {
      for (const { msaPosition } of mutations) {
        const authSeqId = this.positionMapper.msaToAuth(msaPosition);
        if (authSeqId !== undefined) {
          residues.push({ chainId: this.chainId, authSeqId });
        }
      }
    }

    // Note: This assumes all mutations have the same color.
    // If mutations have different colors, you'd need separate rules.
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

  /**
   * Remove a mutation color rule.
   */
  removeMutations(id: string): void {
    this.dispatch({ type: 'REMOVE_COLOR_RULE', id });
  }

  // ============================================================
  // General Color Scheme Methods
  // ============================================================

  /**
   * Clear all color rules and restore default colors.
   */
  clearAllColors(): void {
    this.dispatch({ type: 'CLEAR_COLORS' });
  }

  /**
   * Set the base MSA color scheme (e.g., 'clustal2', 'buried').
   * Clears any custom color rules.
   */
  setColorScheme(scheme: string): void {
    this.dispatch({ type: 'SET_COLOR_SCHEME', scheme });
  }

  // ============================================================
  // Getters
  // ============================================================

  /**
   * Get the current color state (rules and default color).
   */
  getColorState(): ColorState {
    return this.colorManager.getState();
  }

  /**
   * Get the current MSA color scheme name.
   */
  getCurrentColorScheme(): string | null {
    return this.msaController?.getCurrentScheme() || null;
  }

  /**
   * Get the current active chain ID.
   */
  getActiveChainId(): string | null {
    return this.chainId;
  }

  /**
   * Check if the dispatcher has a valid context set.
   */
  hasContext(): boolean {
    return this.chainId !== null && this.positionMapper !== null;
  }
}