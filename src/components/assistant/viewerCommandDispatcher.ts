// Execute viewer actions returned by the NL translator against a
// MolstarInstance. Pure dispatcher — no UI, no I/O. Call-site is responsible
// for having a live instance.
//
// Matches the Pydantic surface in
// `tubulinxyz/api/nl_translator/viewer_actions.py`. Each action type maps
// 1:1 to a public method on MolstarInstance (see
// `src/components/molstar/services/MolstarInstance.ts`).

import type { MolstarInstance } from '@/components/molstar/services/MolstarInstance';
import type { ActionReport, ViewerAction } from './types';

export async function dispatchViewerActions(
  instance: MolstarInstance,
  actions: ViewerAction[],
): Promise<ActionReport[]> {
  const reports: ActionReport[] = [];
  for (const action of actions) {
    try {
      await dispatchOne(instance, action);
      reports.push({ action, ok: true });
    } catch (e) {
      reports.push({
        action,
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
      // Keep going — later actions may not depend on earlier ones succeeding.
    }
  }
  return reports;
}

async function dispatchOne(instance: MolstarInstance, a: ViewerAction): Promise<void> {
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
    default: {
      // Exhaustiveness check — if a new action type is added to the union
      // and not handled here, TypeScript errors at compile time.
      const _exhaustive: never = a;
      void _exhaustive;
      throw new Error(`Unknown viewer action type`);
    }
  }
}
