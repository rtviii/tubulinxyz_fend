// src/components/msa/MSALabels.tsx
'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
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

const FAMILY_GREEK: Record<string, string> = {
  tubulin_alpha: '\u03B1',
  tubulin_beta: '\u03B2',
  tubulin_gamma: '\u03B3',
  tubulin_delta: '\u03B4',
  tubulin_epsilon: '\u03B5',
};

interface ParsedLabel {
  name: string;
  species: string;
  family: string;
  structure: string;
}

function parseLabel(seq: MsaSequence): ParsedLabel {
  if (seq.originType === 'pdb' && seq.chainRef) {
    const greek = seq.family ? FAMILY_GREEK[seq.family] ?? '' : '';
    return {
      name: '',
      species: seq.organism ?? '',
      family: greek,
      structure: `${seq.chainRef.pdbId}:${seq.chainRef.chainId}`,
    };
  }

  if (seq.originType === 'master') {
    return parseMasterLabel(seq.name);
  }

  return { name: seq.name, species: '', family: '', structure: '' };
}

function parseMasterLabel(name: string): ParsedLabel {
  // Parse UniProt-style FASTA IDs: "sp|Q9H4B7|TBB1_HUMAN"
  const parts = name.split('|');
  if (parts.length >= 3) {
    const entry = parts[2]; // e.g. "TBB1_HUMAN"
    const underIdx = entry.lastIndexOf('_');
    if (underIdx > 0) {
      const protName = entry.substring(0, underIdx);
      const species = entry.substring(underIdx + 1);
      return { name: protName, species, family: '', structure: '' };
    }
    return { name: entry, species: '', family: '', structure: '' };
  }
  return { name, species: '', family: '', structure: '' };
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
}: MSALabelsProps) {
  const dispatch = useAppDispatch();
  const selectedId = useAppSelector(selectSelectedSequenceId);
  const hoveredChainKey = useAppSelector(selectHoveredChainKey);
  const selectedChainKey = useAppSelector(selectSelectedChainKey);
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);

  const lastMasterIndex = sequences.reduce(
    (acc, seq, idx) => (seq.originType === 'master' ? idx : acc),
    -1
  );

  // Measure a reasonable default width on first render
  useEffect(() => {
    if (!measureRef.current || sequences.length === 0) return;
    const measureEl = measureRef.current;
    let maxWidth = 0;
    for (const seq of sequences) {
      const p = parseLabel(seq);
      const text = [p.name, p.species, p.family, p.structure].filter(Boolean).join('  ');
      measureEl.textContent = text;
      maxWidth = Math.max(maxWidth, measureEl.offsetWidth);
    }
    const finalWidth = Math.max(maxWidth + 24, 120);
    onWidthCalculated?.(finalWidth);
  }, [sequences, onWidthCalculated]);

  const handleMouseEnter = useCallback((seq: MsaSequence) => {
    const ck = chainKeyForSequence(seq);
    if (ck) dispatch(setHoveredChain(ck));
  }, [dispatch]);

  const handleMouseLeave = useCallback(() => {
    dispatch(setHoveredChain(null));
  }, [dispatch]);

  const handleClick = useCallback((seq: MsaSequence) => {
    const ck = chainKeyForSequence(seq);
    if (ck) dispatch(toggleSelectedChainFocus(ck));
  }, [dispatch]);

  const hasMasters = lastMasterIndex >= 0;
  const hasPdb = sequences.some(s => s.originType === 'pdb');

  return (
    <div
      ref={containerRef}
      className="h-full overflow-hidden bg-gray-50/50"
    >
      <div
        ref={measureRef}
        style={{
          position: 'absolute',
          visibility: 'hidden',
          whiteSpace: 'nowrap',
          fontSize: '10px',
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
          const isLastMaster = idx === lastMasterIndex && hasMasters;
          const isFirstPdb = isPdb && idx === lastMasterIndex + 1;
          const parsed = parseLabel(seq);

          return (
            <div
              key={seq.id}
              onClick={() => isPdb && handleClick(seq)}
              onMouseEnter={() => handleMouseEnter(seq)}
              onMouseLeave={handleMouseLeave}
              className={`
                flex items-center gap-1 px-1.5 select-none whitespace-nowrap
                text-[10px] font-mono transition-colors
                ${isSelected
                  ? 'bg-green-100 text-green-800 font-medium'
                  : isHovered
                    ? 'bg-blue-50 text-gray-700'
                    : isMaster
                      ? 'text-gray-400'
                      : 'text-gray-600'
                }
                ${isPdb && !isSelected && !isHovered ? 'hover:bg-gray-100' : ''}
                ${isLastMaster ? 'border-b-[3px] border-gray-400' : ''}
                ${isFirstPdb ? 'font-semibold' : ''}
              `}
              style={{
                height: rowHeight,
                lineHeight: `${rowHeight}px`,
                cursor: isPdb ? 'pointer' : 'default',
              }}
              title={seq.name}
            >
              {parsed.family && (
                <span className="text-gray-500 w-3 text-center flex-shrink-0">{parsed.family}</span>
              )}
              {parsed.structure && (
                <span className="text-gray-700 flex-shrink-0">{parsed.structure}</span>
              )}
              {parsed.name && (
                <span className={isMaster ? 'text-gray-500' : 'text-gray-700'}>{parsed.name}</span>
              )}
              {parsed.species && (
                <span className="text-gray-400 flex-shrink-0">{parsed.species}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
