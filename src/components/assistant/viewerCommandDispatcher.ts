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
import type { ActionReport, ViewerAction } from './types';

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
}

export async function dispatchViewerActions(
  instance: MolstarInstance,
  actions: ViewerAction[],
  ctx: ViewerDispatchContext = {},
): Promise<ActionReport[]> {
  const reports: ActionReport[] = [];
  for (const action of actions) {
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
    default: {
      // Exhaustiveness check — if a new action type is added to the union
      // and not handled here, TypeScript errors at compile time.
      const _exhaustive: never = a;
      void _exhaustive;
      throw new Error(`Unknown viewer action type`);
    }
  }
}
