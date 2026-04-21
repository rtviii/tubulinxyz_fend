'use client';

// Each page that wants a live cross-page assistant sets up a provider with:
// - `target`: which backend tool group to use ('viewer' | 'filters')
// - `buildContext`: returns the current context blob to send with the request.
//   Called fresh on each submit so we never ship stale state.
// - `onResponse`: consumes the decoded backend response (dispatches actions
//   or applies filters).
//
// The shared chat pill reads this context via `useAssistantTarget`. If the
// provider is absent, the pill falls back to a disabled "soon" state.

import { createContext, useContext, type ReactNode } from 'react';

export type AssistantTarget = 'viewer' | 'filters';

export interface AssistantHandlerResult {
  // Short human readback; the pill shows this in the feedback popover.
  summary?: string;
  // If set, the pill shows a clarification bubble instead of success.
  clarification?: string;
  // If set, the pill shows an error state with this message.
  error?: string;
}

export interface AssistantTargetValue {
  target: AssistantTarget;
  // Invoked when the user submits. The handler is responsible for posting
  // to the backend, interpreting the response, and running any side effects
  // (dispatching viewer actions / applying filter state). Returns a short
  // status object for the pill UI.
  handle: (text: string, signal: AbortSignal) => Promise<AssistantHandlerResult>;
  // Placeholder text to show in the pill. Optional.
  placeholder?: string;
}

const AssistantTargetContext = createContext<AssistantTargetValue | null>(null);

export function AssistantTargetProvider({
  value,
  children,
}: {
  // `null` is allowed so pages can mount the provider unconditionally and
  // flip the value on/off without remounting the subtree (critical: a
  // conditional wrap at the page root unmounts refs and tears down the
  // molstar viewer).
  value: AssistantTargetValue | null;
  children: ReactNode;
}) {
  return (
    <AssistantTargetContext.Provider value={value}>{children}</AssistantTargetContext.Provider>
  );
}

export function useAssistantTarget(): AssistantTargetValue | null {
  return useContext(AssistantTargetContext);
}
