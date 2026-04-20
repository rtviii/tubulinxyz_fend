"use client";

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { API_BASE_URL } from "@/config";
import {
  backendFiltersToUi,
  type NLQueryResponse,
} from "./nlFilterMapper";
import type { UiFilters } from "./StructureFiltersPanel";

type Props = {
  currentFilters: UiFilters;
  onApply: (parsed: Partial<UiFilters>, summary: string) => void;
};

type PendingState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "clarify"; message: string }
  | { kind: "preview"; parsed: Partial<UiFilters>; summary: string }
  | { kind: "error"; message: string };

export function NLQueryBox({ currentFilters, onApply }: Props) {
  const [text, setText] = useState("");
  const [state, setState] = useState<PendingState>({ kind: "idle" });

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setState({ kind: "loading" });
    try {
      const resp = await fetch(`${API_BASE_URL}/nl_query/filters`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text: trimmed,
          target: "structures",
          current_filters: currentFilters,
        }),
      });
      if (!resp.ok) {
        const body = await resp.text();
        setState({ kind: "error", message: `HTTP ${resp.status}: ${body.slice(0, 200)}` });
        return;
      }
      const data: NLQueryResponse = await resp.json();
      if (data.clarification) {
        setState({ kind: "clarify", message: data.clarification });
        return;
      }
      if (!data.filters) {
        setState({ kind: "error", message: "No filters returned." });
        return;
      }
      const parsed = backendFiltersToUi(data.filters);
      setState({ kind: "preview", parsed, summary: data.summary || "(no summary)" });
    } catch (e: any) {
      setState({ kind: "error", message: e?.message ?? String(e) });
    }
  };

  const apply = () => {
    if (state.kind !== "preview") return;
    onApply(state.parsed, state.summary);
    setText("");
    setState({ kind: "idle" });
  };

  const cancel = () => {
    setState({ kind: "idle" });
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 mb-4">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
        <span className="text-xs font-medium text-gray-700">Ask in natural language</span>
      </div>
      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="e.g. human structures with taxol at resolution higher than 4A"
          className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded outline-none focus:border-indigo-400"
          disabled={state.kind === "loading"}
        />
        <button
          onClick={submit}
          disabled={state.kind === "loading" || !text.trim()}
          className="px-3 py-1.5 text-sm bg-indigo-500 text-white rounded hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          {state.kind === "loading" ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Translating
            </>
          ) : (
            "Translate"
          )}
        </button>
      </div>

      {state.kind === "clarify" && (
        <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
          {state.message}
        </div>
      )}

      {state.kind === "error" && (
        <div className="mt-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">
          {state.message}
        </div>
      )}

      {state.kind === "preview" && (
        <div className="mt-2 border border-indigo-100 bg-indigo-50/40 rounded px-2 py-1.5">
          <div className="text-[11px] font-medium text-gray-600 mb-1">Parsed filters</div>
          <div className="flex flex-wrap gap-1 mb-2">
            {Object.entries(state.parsed).map(([k, v]) => (
              <span
                key={k}
                className="text-[10px] bg-white border border-indigo-200 text-indigo-700 px-1.5 py-0.5 rounded font-mono"
              >
                {k}: {JSON.stringify(v)}
              </span>
            ))}
            {Object.keys(state.parsed).length === 0 && (
              <span className="text-[11px] text-gray-500 italic">
                No filter changes inferred.
              </span>
            )}
          </div>
          {state.summary && (
            <div className="text-[11px] text-gray-500 mb-2">{state.summary}</div>
          )}
          <div className="flex gap-1.5">
            <button
              onClick={apply}
              disabled={Object.keys(state.parsed).length === 0}
              className="px-2.5 py-1 text-[11px] bg-indigo-500 text-white rounded hover:bg-indigo-600 disabled:opacity-50"
            >
              Apply &amp; Run
            </button>
            <button
              onClick={cancel}
              className="px-2.5 py-1 text-[11px] bg-white text-gray-700 border border-gray-200 rounded hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
