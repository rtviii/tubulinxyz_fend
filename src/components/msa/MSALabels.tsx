// src/components/msa/MSALabels.tsx
'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/store';
import {
  selectSelectedSequenceId,
  toggleSelectedSequence,
  MsaSequence
} from '@/store/slices/sequence_registry';

interface MSALabelsProps {
  sequences: MsaSequence[];
  rowHeight: number;
  scrollTop: number;
  onWidthCalculated?: (width: number) => void;
}

function formatLabel(seq: MsaSequence): string {
  if (seq.originType === 'pdb' && seq.chainRef) {
    const family = seq.family ? formatFamily(seq.family) : null;
    const structLabel = `${seq.chainRef.pdbId}:${seq.chainRef.chainId}`;
    return family ? `${family} - ${structLabel}` : structLabel;
  }

  if (seq.originType === 'master') {
    return seq.family ? formatFamily(seq.family) : seq.name;
  }

  return seq.name;
}

function formatFamily(family: string): string {
  const tubulinMatch = family.match(/^tubulin_(\w+)$/);
  if (tubulinMatch) {
    return tubulinMatch[1].charAt(0).toUpperCase() + tubulinMatch[1].slice(1);
  }
  const mapMatch = family.match(/^map_(\w+)/);
  if (mapMatch) {
    return mapMatch[1].toUpperCase();
  }
  return family;
}

export function MSALabels({ sequences, rowHeight, scrollTop, onWidthCalculated }: MSALabelsProps) {
  const dispatch = useAppDispatch();
  const selectedId = useAppSelector(selectSelectedSequenceId);
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [labelWidth, setLabelWidth] = useState(0);

  useEffect(() => {
    if (!measureRef.current || sequences.length === 0) return;

    const measureEl = measureRef.current;
    let maxWidth = 0;

    for (const seq of sequences) {
      measureEl.textContent = formatLabel(seq);
      maxWidth = Math.max(maxWidth, measureEl.offsetWidth);
    }

    const finalWidth = maxWidth + 24;
    setLabelWidth(finalWidth);
    onWidthCalculated?.(finalWidth);
  }, [sequences, onWidthCalculated]);

  const handleLabelClick = useCallback((seqId: string) => {
    dispatch(toggleSelectedSequence(seqId));
  }, [dispatch]);

  return (
    <div ref={containerRef} className="h-full overflow-hidden border-r border-gray-200 bg-gray-50" style={{ width: labelWidth > 0 ? labelWidth : 'auto' }}>
      <div
        ref={measureRef}
        style={{
          position: 'absolute',
          visibility: 'hidden',
          whiteSpace: 'nowrap',
          fontSize: '12px',
          fontFamily: 'monospace',
        }}
      />
      <div style={{ transform: `translateY(${-scrollTop}px)` }}>
        {sequences.map((seq) => {
          const isSelected = seq.id === selectedId;
          return (
            <div
              key={seq.id}
              onClick={() => handleLabelClick(seq.id)}
              className={`
                flex items-center px-3 cursor-pointer select-none
                text-xs font-mono truncate transition-colors
                ${isSelected
                  ? 'bg-green-100 text-green-800 font-medium'
                  : 'hover:bg-gray-100 text-gray-600'
                }
              `}
              style={{
                height: rowHeight,
                lineHeight: `${rowHeight}px`,
              }}
              title={formatLabel(seq)}
            >
              {formatLabel(seq)}
            </div>
          );
        })}
      </div>
    </div>
  );
}