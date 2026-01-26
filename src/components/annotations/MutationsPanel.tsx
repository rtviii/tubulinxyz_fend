// src/components/annotations/MutationsPanel.tsx
import { Eye, EyeOff, Focus } from 'lucide-react';

export interface MutationRowData {
  id: string;
  masterIndex: number;
  authSeqId: number | null;
  fromResidue: string;
  toResidue: string;
  phenotype: string | null;
  label: string; // e.g., "S250F"
}

interface MutationsPanelProps {
  mutations: MutationRowData[];
  visibleMutationIds: Set<string>;
  onToggleMutation: (mutationId: string) => void;
  onFocusMutation: (masterIndex: number) => void;
  onShowAll: () => void;
  onHideAll: () => void;
}

export function MutationsPanel({
  mutations,
  visibleMutationIds,
  onToggleMutation,
  onFocusMutation,
  onShowAll,
  onHideAll,
}: MutationsPanelProps) {
  if (mutations.length === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">
          Mutations ({mutations.length})
        </span>
        <div className="flex gap-1">
          <button
            onClick={onShowAll}
            className="text-xs text-blue-600 hover:text-blue-800"
          >
            Show all
          </button>
          <span className="text-gray-300">|</span>
          <button
            onClick={onHideAll}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Hide all
          </button>
        </div>
      </div>

      <div className="space-y-1 max-h-64 overflow-y-auto">
        {mutations.map(mutation => (
          <MutationRow
            key={mutation.id}
            mutation={mutation}
            isVisible={visibleMutationIds.has(mutation.id)}
            onToggle={() => onToggleMutation(mutation.id)}
            onFocus={() => onFocusMutation(mutation.masterIndex)}
          />
        ))}
      </div>
    </div>
  );
}

function MutationRow({
  mutation,
  isVisible,
  onToggle,
  onFocus,
}: {
  mutation: MutationRowData;
  isVisible: boolean;
  onToggle: () => void;
  onFocus: () => void;
}) {
  const getColorForPhenotype = (phenotype: string | null) => {
    if (!phenotype) return '#ff6b6b';
    const lower = phenotype.toLowerCase();
    if (lower.includes('resistant') || lower.includes('resistance')) return '#e63946';
    if (lower.includes('sensitive') || lower.includes('sensitivity')) return '#06ffa5';
    if (lower.includes('benign')) return '#ffd60a';
    return '#ff6b6b';
  };

  const color = getColorForPhenotype(mutation.phenotype);

  return (
    <div className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-gray-50 group">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: color }}
        />
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium font-mono">{mutation.label}</span>
            {mutation.authSeqId && (
              <span className="text-xs text-gray-400">pos {mutation.authSeqId}</span>
            )}
          </div>
          {mutation.phenotype && (
            <span className="text-xs text-gray-500 truncate" title={mutation.phenotype}>
              {mutation.phenotype}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onFocus}
          className="p-1 text-gray-400 hover:text-blue-600"
          title="Focus"
        >
          <Focus size={14} />
        </button>
        <button
          onClick={onToggle}
          className="p-1 text-gray-400 hover:text-gray-700"
        >
          {isVisible ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
      </div>
    </div>
  );
}