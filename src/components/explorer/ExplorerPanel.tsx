import { useState, useCallback } from 'react';
import { Sparkles, Loader2, X } from 'lucide-react';
import type { ExplorerContext, ExplorerQuestion } from './types';
import { useNucleotideHighlight } from './questions/useNucleotideHighlight';
import { useInterfaceContacts } from './questions/useInterfaceContacts';
import { CanonicalSiteQuestion } from './CanonicalSiteSearch';

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
      className={`w-full text-left px-2.5 py-2 rounded text-xs transition-colors ${
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
  const [activeButtonId, setActiveButtonId] = useState<string | null>(null);
  const [searchActive, setSearchActive] = useState(false);

  const nucleotideQuestion = useNucleotideHighlight(context);
  const interfaceQuestion = useInterfaceContacts(context);

  const buttonQuestions: ExplorerQuestion[] = [
    nucleotideQuestion,
    interfaceQuestion,
  ].filter(q => q.available);

  const handleButtonClick = useCallback(
    async (question: ExplorerQuestion) => {
      if (question.isActive) {
        await question.clear();
        setActiveButtonId(null);
        return;
      }

      const prev = buttonQuestions.find(q => q.isActive);
      if (prev) await prev.clear();

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
    <section className="rounded-lg border border-gray-200 bg-gray-50/50 p-3">
      <h2 className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
        <Sparkles size={10} className="text-gray-300" />
        Ask assistant
        <span className="text-[9px] text-gray-300 font-normal normal-case">(WIP)</span>
      </h2>
      <div className="space-y-0.5">
        {buttonQuestions.map(q => (
          <QuestionButton
            key={q.id}
            question={q}
            onClick={() => handleButtonClick(q)}
          />
        ))}

        <CanonicalSiteQuestion
          context={context}
          onActiveChange={handleSearchActiveChange}
        />
      </div>
    </section>
  );
}