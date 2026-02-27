// src/components/explorer/ExplorerPanel.tsx

import { useState, useCallback } from 'react';
import { Sparkles, Loader2, X } from 'lucide-react';
import type { ExplorerContext, ExplorerQuestion } from './types';
import { useNucleotideHighlight } from './questions/useNucleotideHighlight';
import { useInterfaceContacts } from './questions/useInterfaceContacts';
import { CanonicalSiteSearch } from './CanonicalSiteSearch';

// ────────────────────────────────────────────
// Question button
// ────────────────────────────────────────────

function QuestionButton({
  question,
  onClick,
}: {
  question: ExplorerQuestion;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={question.isLoading}
      className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
        question.isActive
          ? 'bg-blue-50 text-blue-700 border border-blue-200'
          : 'text-gray-600 hover:bg-gray-50 border border-transparent'
      }`}
      title={question.description}
    >
      <span className="flex items-center justify-between">
        <span className="truncate">{question.label}</span>
        {question.isLoading && (
          <Loader2 size={11} className="animate-spin flex-shrink-0 ml-1" />
        )}
        {question.isActive && !question.isLoading && (
          <X size={11} className="flex-shrink-0 ml-1 text-blue-400" />
        )}
      </span>
    </button>
  );
}

// ────────────────────────────────────────────
// Panel
// ────────────────────────────────────────────

interface ExplorerPanelProps {
  context: ExplorerContext;
}

export function ExplorerPanel({ context }: ExplorerPanelProps) {
  // Track which button question is active so we can clear it when another activates
  const [activeButtonId, setActiveButtonId] = useState<string | null>(null);
  // Track whether the search heatmap is active
  const [searchActive, setSearchActive] = useState(false);

  const nucleotideQuestion = useNucleotideHighlight(context);
  const interfaceQuestion = useInterfaceContacts(context);

  const buttonQuestions: ExplorerQuestion[] = [
    nucleotideQuestion,
    interfaceQuestion,
  ].filter(q => q.available);

  const handleButtonClick = useCallback(
    async (question: ExplorerQuestion) => {
      // If this question is already active, toggle it off
      if (question.isActive) {
        await question.clear();
        setActiveButtonId(null);
        return;
      }

      // Clear any other active button question
      const prev = buttonQuestions.find(q => q.isActive);
      if (prev) await prev.clear();

      // Clear search heatmap if active (they share the colorscheme)
      if (searchActive) {
        await context.instance?.restoreDefaultColors();
        setSearchActive(false);
      }

      await question.execute();
      setActiveButtonId(question.id);
    },
    [buttonQuestions, searchActive, context.instance]
  );

  const handleSearchActiveChange = useCallback(
    async (active: boolean) => {
      // If search is activating, clear any active button question first
      if (active) {
        const prev = buttonQuestions.find(q => q.isActive);
        if (prev) {
          await prev.clear();
          setActiveButtonId(null);
        }
      }
      setSearchActive(active);
    },
    [buttonQuestions]
  );

  const hasAnything = buttonQuestions.length > 0 || !!context.profile;
  if (!hasAnything) return null;

  return (
    <section>
      <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
        <Sparkles size={11} className="text-gray-400" />
        Explore
      </h2>
      <div className="space-y-1.5">
        {buttonQuestions.map(q => (
          <QuestionButton
            key={q.id}
            question={q}
            onClick={() => handleButtonClick(q)}
          />
        ))}

        {/* Canonical binding site search */}
        <CanonicalSiteSearch
          context={context}
          onActiveChange={handleSearchActiveChange}
        />
      </div>
    </section>
  );
}