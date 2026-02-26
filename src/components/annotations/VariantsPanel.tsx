'use client';
import { Eye, EyeOff, Focus } from 'lucide-react';
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
  if (variants.length === 0) return null;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-[10px] font-medium text-gray-500">
          Variants ({variants.length})
        </span>
        <div className="ml-auto">
          <button
            onClick={() => onToggleVariants(!showVariants)}
            className="p-0.5 text-gray-300 hover:text-gray-600"
          >
            {showVariants ? <Eye size={11} /> : <EyeOff size={11} />}
          </button>
        </div>
      </div>

      {/* Compact variant rows */}
      {showVariants && (
        <div className="max-h-36 overflow-y-auto border border-gray-100 rounded bg-white">
          {variants.map((v, i) => {
            const label =
              v.type === 'deletion' ? `${v.fromResidue}${v.masterIndex}del` :
                v.type === 'insertion' ? `${v.masterIndex}ins${v.toResidue}` :
                  `${v.fromResidue}${v.masterIndex}${v.toResidue}`;

            return (
              <div
                key={`${v.masterIndex}-${i}`}
                className="group flex items-center gap-1.5 px-1.5 py-0.5 hover:bg-gray-50 text-[10px]"
              >
                <span
                  className="w-6 text-center text-[8px] py-px rounded font-semibold text-white flex-shrink-0 leading-tight"
                  style={{ backgroundColor: VARIANT_COLORS[v.type] }}
                >
                  {TYPE_LABEL[v.type]}
                </span>
                <span className="font-mono font-medium text-gray-700 flex-shrink-0">{label}</span>
                {v.phenotype && (
                  <span className="text-gray-400 truncate flex-1 min-w-0" title={v.phenotype}>
                    {v.phenotype}
                  </span>
                )}
                {v.uniprotId && !v.phenotype && (
                  <span className="text-gray-300">{v.uniprotId}</span>
                )}
                {onFocusVariant && (
                  <button
                    onClick={() => onFocusVariant(v.masterIndex)}
                    className="p-0.5 text-gray-200 hover:text-blue-500 opacity-0 group-hover:opacity-100 flex-shrink-0"
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