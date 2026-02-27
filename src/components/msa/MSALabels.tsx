// src/components/msa/MSALabels.tsx
'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { Eye, EyeOff, Focus } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/store';
import {
  selectSelectedSequenceId,
  MsaSequence,
} from '@/store/slices/sequence_registry';
import {
  setHoveredChain,
  toggleSelectedChain as toggleSelectedChainFocus,
  selectHoveredChainKey,
  selectSelectedChainKey,
} from '@/store/slices/chainFocusSlice';
import { makeChainKey } from '@/lib/chain_key';

interface MSALabelsProps {
  sequences: MsaSequence[];
  rowHeight: number;
  scrollTop: number;
  onWidthCalculated?: (width: number) => void;
  visibleChainKeys?: Set<string>;
  onToggleChainVisibility?: (chainKey: string) => void;
  onSoloChain?: (chainKey: string) => void;
}

function formatLabel(seq: MsaSequence): string {
  if (seq.originType === 'pdb' && seq.chainRef) {
    const family = seq.family ? formatFamily(seq.family) : null;
    const structLabel = `${seq.chainRef.pdbId}:${seq.chainRef.chainId}`;
    return family ? `${family} - ${structLabel}` : structLabel;
  }

  // Master sequences: use the FASTA record ID (e.g. "TBA1B_HUMAN")
  if (seq.originType === 'master') {
    return seq.name;
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

function chainKeyForSequence(seq: MsaSequence): string | null {
  if (seq.originType !== 'pdb' || !seq.chainRef) return null;
  return makeChainKey(seq.chainRef.pdbId, seq.chainRef.chainId);
}

export function MSALabels({
  sequences,
  rowHeight,
  scrollTop,
  onWidthCalculated,
  visibleChainKeys,
  onToggleChainVisibility,
  onSoloChain,
}: MSALabelsProps) {
  const dispatch = useAppDispatch();
  const selectedId = useAppSelector(selectSelectedSequenceId);
  const hoveredChainKey = useAppSelector(selectHoveredChainKey);
  const selectedChainKey = useAppSelector(selectSelectedChainKey);
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [labelWidth, setLabelWidth] = useState(0);
  const [localHoveredRow, setLocalHoveredRow] = useState<string | null>(null);

  // Find the boundary between master and pdb rows
  const lastMasterIndex = sequences.reduce(
    (acc, seq, idx) => (seq.originType === 'master' ? idx : acc),
    -1
  );

  useEffect(() => {
    if (!measureRef.current || sequences.length === 0) return;
    const measureEl = measureRef.current;
    let maxWidth = 0;
    for (const seq of sequences) {
      measureEl.textContent = formatLabel(seq);
      maxWidth = Math.max(maxWidth, measureEl.offsetWidth);
    }
    // Extra space for hover buttons
    const finalWidth = maxWidth + 56;
    setLabelWidth(finalWidth);
    onWidthCalculated?.(finalWidth);
  }, [sequences, onWidthCalculated]);

  const handleMouseEnter = useCallback((seq: MsaSequence) => {
    setLocalHoveredRow(seq.id);
    const ck = chainKeyForSequence(seq);
    if (ck) dispatch(setHoveredChain(ck));
  }, [dispatch]);

  const handleMouseLeave = useCallback(() => {
    setLocalHoveredRow(null);
    dispatch(setHoveredChain(null));
  }, [dispatch]);

  const handleClick = useCallback((seq: MsaSequence) => {
    const ck = chainKeyForSequence(seq);
    if (ck) dispatch(toggleSelectedChainFocus(ck));
  }, [dispatch]);

  return (
    <div
      ref={containerRef}
      className="h-full overflow-hidden border-r border-gray-200 bg-gray-50"
      style={{ width: labelWidth > 0 ? labelWidth : 'auto' }}
    >
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
        {sequences.map((seq, idx) => {
          const ck = chainKeyForSequence(seq);
          const isPdb = seq.originType === 'pdb';
          const isMaster = seq.originType === 'master';
          const isSelected = ck ? ck === selectedChainKey : seq.id === selectedId;
          const isHovered = ck ? ck === hoveredChainKey : false;
          const isLocalHovered = localHoveredRow === seq.id;
          const isLastMaster = idx === lastMasterIndex;
          const isVisible = ck ? (visibleChainKeys?.has(ck) ?? true) : true;

          return (
            <div
              key={seq.id}
              onClick={() => handleClick(seq)}
              onMouseEnter={() => handleMouseEnter(seq)}
              onMouseLeave={handleMouseLeave}
              className={`
                group flex items-center px-2 select-none
                text-xs font-mono truncate transition-colors
                ${isSelected
                  ? 'bg-green-100 text-green-800 font-medium'
                  : isHovered
                    ? 'bg-blue-50 text-gray-700'
                    : isMaster
                      ? 'text-gray-400'
                      : 'text-gray-600'
                }
                ${isMaster && !isSelected ? 'bg-gray-50' : ''}
                ${isPdb && !isSelected && !isHovered ? 'hover:bg-gray-100' : ''}
                ${isLastMaster ? 'border-b-2 border-gray-300' : ''}
              `}
              style={{
                height: rowHeight,
                lineHeight: `${rowHeight}px`,
                cursor: isPdb ? 'pointer' : 'default',
              }}
              title={formatLabel(seq)}
            >
              <span className="truncate flex-1 min-w-0">
                {formatLabel(seq)}
              </span>

              {/* Hover-reveal buttons for pdb rows */}
              {isPdb && ck && (
                <span
                  className="flex-shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-1"
                  onClick={e => e.stopPropagation()}
                >
                  {onToggleChainVisibility && (
                    <button
                      onClick={() => onToggleChainVisibility(ck)}
                      className="p-0 text-gray-300 hover:text-gray-600"
                      title={isVisible ? 'Hide in 3D' : 'Show in 3D'}
                    >
                      {isVisible ? <Eye size={10} /> : <EyeOff size={10} />}
                    </button>
                  )}
                  {onSoloChain && (
                    <button
                      onClick={() => onSoloChain(ck)}
                      className="p-0 text-gray-300 hover:text-blue-600"
                      title="Show only this chain"
                    >
                      <Focus size={10} />
                    </button>
                  )}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}