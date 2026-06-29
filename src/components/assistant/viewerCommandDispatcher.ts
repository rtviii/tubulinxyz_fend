// Execute viewer actions returned by the NL translator against a
// MolstarInstance. Pure dispatcher — no UI, no I/O. Call-site is responsible
// for having a live instance.
//
// Matches the Pydantic surface in
// `tubulinxyz/api/nl_translator/viewer_actions.py`. Each action type maps
// 1:1 to a public method on MolstarInstance (see
// `src/components/molstar/services/MolstarInstance.ts`).

import type { MolstarInstance } from '@/components/molstar/services/MolstarInstance';
import {
  addTrack,
  removeTrack,
  type FilterSpec,
  type TrackEntry,
} from '@/store/slices/annotationTracksSlice';
import type { ActionReport, ViewerAction, ViewerActionType } from './types';

// Extra capabilities the call-site (the structure page) supplies for actions
// that need more than a MolstarInstance — e.g. AlignChain needs the page's
// align flow; AddAnnotationTrack / RemoveAnnotationTrack need Redux access.
export interface ViewerDispatchContext {
  alignChain?: (rcsbId: string, authAsymId: string) => Promise<void> | void;
  // Redux dispatch — needed for annotation-track actions. The page closure
  // captures the store-bound dispatch.
  dispatch?: (action: unknown) => void;
  // Snapshot reader for existing tracks; needed by RemoveAnnotationTrack to
  // map a label substring to track ids. Closure should read state fresh on
  // each call (not capture a stale list).
  getTracks?: () => TrackEntry[];
  // Whether the page is currently in expert (monomer) view. AddAnnotationTrack
  // is only meaningful in expert mode (MSA is required to render).
  viewMode?: 'structure' | 'monomer';
  // Focus the binding site of a named ligand on a chain. Resolves the chemical
  // id to the actual contact residues from the page's annotations slice, draws
  // the binding-site representation in 3D, and jumps the MSA to the span.
  // authAsymId is optional; null/undefined falls back to the active monomer chain.
  focusBindingSite?: (chemicalId: string, authAsymId?: string | null) => Promise<void>;
  // Draw a chain's inter-chain contacts AND surface them in the bond-pill card.
  // When absent (e.g. landing, no card UI), the dispatcher calls the instance
  // method directly so the 3D still draws.
  showChainInterface?: (authAsymId: string, partnerAuthAsymIds?: string[]) => Promise<void>;
}

// Defense-in-depth guard. The backend validates action args against Pydantic
// models and drops bad ones, but the wire contract is stringly-typed
// (`{ type: string, args }`), so we re-check here before touching molstar: an
// unknown type or a missing required arg becomes a visible failed report
// instead of a call like `focusChain(undefined)` that silently no-ops. The
// Record<ViewerActionType, …> shape forces this table to track the union — add
// an action type and TypeScript makes you list its required args here.
const REQUIRED_ARGS: Record<ViewerActionType, string[]> = {
  FocusChain: ['auth_asym_id'],
  FocusResidue: ['auth_asym_id', 'auth_seq_id'],
  FocusResidueRange: ['auth_asym_id', 'start', 'end'],
  ClearFocus: [],
  SetChainVisibility: ['auth_asym_id', 'visible'],
  IsolateChain: ['auth_asym_id'],
  HighlightChain: ['auth_asym_id'],
  HighlightResidueRange: ['auth_asym_id', 'start', 'end'],
  ClearHighlight: [],
  AlignChain: ['rcsb_id', 'auth_asym_id'],
  AddAnnotationTrack: ['label', 'spec', 'color'],
  RemoveAnnotationTrack: ['label_match'],
  FocusBindingSite: ['chemical_id'],
  ShowChainInterface: ['auth_asym_id'],
};

function validateAction(action: ViewerAction): string | null {
  const required = REQUIRED_ARGS[action.type];
  if (!required) return `unknown action type: ${(action as { type?: string }).type ?? '(none)'}`;
  const args = (action.args ?? {}) as Record<string, unknown>;
  const missing = required.filter((k) => args[k] === undefined || args[k] === null);
  return missing.length ? `missing arg(s) for ${action.type}: ${missing.join(', ')}` : null;
}

export async function dispatchViewerActions(
  instance: MolstarInstance,
  actions: ViewerAction[],
  ctx: ViewerDispatchContext = {},
): Promise<ActionReport[]> {
  const reports: ActionReport[] = [];
  for (const action of actions) {
    const invalid = validateAction(action);
    if (invalid) {
      console.error('[viewerDispatcher] rejected action', action?.type, invalid);
      reports.push({ action, ok: false, error: invalid });
      continue;
    }
    try {
      await dispatchOne(instance, action, ctx);
      reports.push({ action, ok: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Surface to console so the user can diagnose without waiting for the
      // aggregated error toast (which is easy to miss).
      console.error('[viewerDispatcher] action failed', action.type, action.args, msg);
      reports.push({ action, ok: false, error: msg });
      // Keep going — later actions may not depend on earlier ones succeeding.
    }
  }
  return reports;
}

async function dispatchOne(
  instance: MolstarInstance,
  a: ViewerAction,
  ctx: ViewerDispatchContext,
): Promise<void> {
  switch (a.type) {
    case 'FocusChain':
      instance.focusChain(a.args.auth_asym_id);
      return;
    case 'FocusResidue':
      instance.focusResidue(a.args.auth_asym_id, a.args.auth_seq_id);
      return;
    case 'FocusResidueRange':
      instance.focusResidueRange(a.args.auth_asym_id, a.args.start, a.args.end);
      return;
    case 'ClearFocus':
      instance.clearFocus();
      return;
    case 'SetChainVisibility':
      instance.setChainVisibility(a.args.auth_asym_id, a.args.visible);
      return;
    case 'IsolateChain':
      instance.isolateChain(a.args.auth_asym_id, a.args.keep_ligands);
      return;
    case 'HighlightChain':
      instance.highlightChain(a.args.auth_asym_id, true);
      return;
    case 'HighlightResidueRange':
      instance.highlightResidueRange(a.args.auth_asym_id, a.args.start, a.args.end, true);
      return;
    case 'ClearHighlight':
      instance.clearHighlight();
      return;
    case 'AlignChain':
      if (!ctx.alignChain) {
        throw new Error('Alignment is only available in expert mode');
      }
      await ctx.alignChain(a.args.rcsb_id, a.args.auth_asym_id);
      return;
    case 'AddAnnotationTrack': {
      if (!ctx.dispatch) {
        throw new Error('Annotation tracks require dispatch in ViewerDispatchContext');
      }
      if (ctx.viewMode !== 'monomer') {
        // Honesty over silence: fail loudly so the assistant reports it rather
        // than claiming a track was added when nothing happened. (The prompt
        // also tells the model to avoid this outside expert mode.)
        throw new Error('Annotation tracks require expert (monomer) mode — switch to expert mode first');
      }
      const spec = a.args.spec as FilterSpec;
      ctx.dispatch(
        addTrack({
          label: a.args.label,
          family: spec.family,
          filters: spec,
          paint: { kind: 'flat', color: a.args.color },
          source: 'ai',
        }),
      );
      return;
    }
    case 'RemoveAnnotationTrack': {
      if (!ctx.dispatch || !ctx.getTracks) {
        throw new Error('Annotation tracks require dispatch + getTracks in ViewerDispatchContext');
      }
      const needle = a.args.label_match.toLowerCase();
      const tracks = ctx.getTracks();
      const matches = tracks.filter(t => t.spec.label.toLowerCase().includes(needle));
      if (matches.length === 0) {
        console.warn('[viewerDispatcher] RemoveAnnotationTrack: no track matched', needle);
        return;
      }
      for (const t of matches) {
        ctx.dispatch(removeTrack(t.spec.id));
      }
      return;
    }
    case 'FocusBindingSite': {
      console.log('[viewerDispatcher] FocusBindingSite ENTER', a.args);
      if (!ctx.focusBindingSite) {
        throw new Error('FocusBindingSite requires focusBindingSite in ViewerDispatchContext');
      }
      await ctx.focusBindingSite(a.args.chemical_id, a.args.auth_asym_id);
      console.log('[viewerDispatcher] FocusBindingSite OK');
      return;
    }
    case 'ShowChainInterface': {
      // Computed live from the loaded structure — no monomer-mode gate, so it
      // works in easy AND expert mode. Prefer the page callback (it also feeds
      // the bond-pill card); fall back to the bare instance draw when absent.
      const partners = a.args.partner_auth_asym_ids ?? undefined;
      if (ctx.showChainInterface) {
        await ctx.showChainInterface(a.args.auth_asym_id, partners);
      } else {
        await instance.focusChainInterface(a.args.auth_asym_id, partners);
      }
      return;
    }
    default: {
      // Exhaustiveness check — if a new action type is added to the union
      // and not handled here, TypeScript errors at compile time.
      const _exhaustive: never = a;
      void _exhaustive;
      throw new Error(`Unknown viewer action type`);
    }
  }
}
