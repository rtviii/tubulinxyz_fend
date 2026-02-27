'use client';

import { useState } from 'react';
import { ChevronRight, Eye, EyeOff, Focus } from 'lucide-react';
import { Variant, VariantType } from '@/store/slices/annotationsSlice';
import { VARIANT_COLORS } from '@/store/slices/colorRulesSelector';

interface VariantsPanelProps {
  variants: Variant[];
  showVariants: boolean;
  onToggleVariants: (visible: boolean) => void;
  onFocusVariant?: (masterIndex: number) => void;
}

const TYPE_LABEL: Record<VariantType, string> = {
  substitution: 'SUB',
  insertion: 'INS',
  deletion: 'DEL',
};

export function VariantsPanel({
  variants,
  showVariants,
  onToggleVariants,
  onFocusVariant,
}: VariantsPanelProps) {
  const [expanded, setExpanded] = useState(true);

  if (variants.length === 0) return null;

  return (
    <div>
      <div
        onClick={() => setExpanded(e => !e)}
        className="flex items-center gap-1 w-full text-left py-0.5 cursor-pointer select-none"
      >
        <ChevronRight
          size={10}
          className={`text-gray-300 transition-transform duration-100 ${expanded ? 'rotate-90' : ''}`}
        />
        <span className="text-[10px] font-medium text-gray-500">
          Variants ({variants.length})
        </span>
        <div className="ml-auto" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => onToggleVariants(!showVariants)}
            className="p-0.5 text-gray-300 hover:text-gray-600"
            title={showVariants ? 'Hide variant highlights' : 'Show variant highlights'}
          >
            {showVariants ? <Eye size={11} /> : <EyeOff size={11} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="max-h-36 overflow-y-auto border border-gray-100 rounded bg-white">
          {variants.map((v, i) => {
            const label =
              v.type === 'deletion'
                ? `${v.fromResidue}${v.masterIndex}del`
                : v.type === 'insertion'
                  ? `${v.masterIndex}ins${v.toResidue}`
                  : `${v.fromResidue}${v.masterIndex}${v.toResidue}`;
            return (
              <div
                key={`${v.masterIndex}-${i}`}
                className="group flex items-center gap-1.5 px-1.5 py-0.5 hover:bg-gray-50 text-[10px] border-b border-gray-50 last:border-b-0"
              >
                <span
                  className="w-7 text-center text-[8px] py-px rounded font-semibold text-white flex-shrink-0 leading-tight"
                  style={{ backgroundColor: VARIANT_COLORS[v.type] }}
                >
                  {TYPE_LABEL[v.type]}
                </span>
                <span className="w-16 font-mono font-medium text-gray-700 flex-shrink-0">
                  {label}
                </span>
                <span className="flex-1 min-w-0 text-gray-400 truncate" title={v.phenotype ?? v.uniprotId ?? ''}>
                  {v.phenotype ?? v.uniprotId ?? ''}
                </span>
                {onFocusVariant && (
                  <button
                    onClick={() => onFocusVariant(v.masterIndex)}
                    className="p-0.5 text-gray-200 hover:text-blue-500 opacity-0 group-hover:opacity-100 flex-shrink-0"
                    title="Focus in viewer"
                  >
                    <Focus size={10} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}