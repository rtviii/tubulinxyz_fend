// src/components/annotations/VariantsPanel.tsx
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

const TYPE_LABELS: Record<VariantType, string> = {
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

  // Group by type for summary
  const counts = variants.reduce((acc, v) => {
    acc[v.type] = (acc[v.type] || 0) + 1;
    return acc;
  }, {} as Record<VariantType, number>);

  return (
    <div className="space-y-2">
      {/* Header with toggle */}
      <div className="flex items-center justify-between py-1.5 px-2 rounded bg-gray-50">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Variants ({variants.length})</span>
          <div className="flex gap-1">
            {Object.entries(counts).map(([type, count]) => (
              <span
                key={type}
                className="text-[10px] px-1.5 py-0.5 rounded font-medium text-white"
                style={{ backgroundColor: VARIANT_COLORS[type as VariantType] }}
              >
                {count} {TYPE_LABELS[type as VariantType]}
              </span>
            ))}
          </div>
        </div>
        <button
          onClick={() => onToggleVariants(!showVariants)}
          className="p-1 text-gray-400 hover:text-gray-700"
        >
          {showVariants ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
      </div>

      {/* Scrollable variant list */}
      {showVariants && (
        <div className="max-h-48 overflow-y-auto space-y-0.5 border rounded bg-white">
          {variants.map((variant, idx) => (
            <VariantRow
              key={`${variant.masterIndex}-${idx}`}
              variant={variant}
              onFocus={onFocusVariant}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function VariantRow({
  variant,
  onFocus,
}: {
  variant: Variant;
  onFocus?: (masterIndex: number) => void;
}) {
  const color = VARIANT_COLORS[variant.type];
  
  // Format the variant label based on type

const label = variant.type === 'deletion'
    ? `${variant.fromResidue}${variant.masterIndex}del`
    : variant.type === 'insertion'
    ? `${variant.masterIndex}ins${variant.toResidue}`
    : `${variant.fromResidue}${variant.masterIndex}${variant.toResidue}`;

  return (
    <div className="group flex items-center gap-2 px-2 py-1 hover:bg-gray-50 text-xs">
      {/* Type badge */}
      <span
        className="w-8 text-center text-[9px] px-1 py-0.5 rounded font-semibold text-white flex-shrink-0"
        style={{ backgroundColor: color }}
      >
        {TYPE_LABELS[variant.type]}
      </span>

      {/* Variant notation */}
      <span className="font-mono font-medium text-gray-800 flex-shrink-0">
        {label}
      </span>

      {/* Phenotype (truncated) */}
      {variant.phenotype && (
        <span
          className="text-gray-500 truncate flex-1 min-w-0"
          title={variant.phenotype}
        >
          {variant.phenotype}
        </span>
      )}

      {/* Source/UniProt */}
      {variant.uniprotId && !variant.phenotype && (
        <span className="text-gray-400 text-[10px]">{variant.uniprotId}</span>
      )}

      {/* Focus button */}
      {onFocus && (
        <button
          onClick={() => onFocus(variant.masterIndex)}
          className="p-0.5 text-gray-300 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
        >
          <Focus size={12} />
        </button>
      )}
    </div>
  );
}