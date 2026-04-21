// src/components/msa/MSALabels.tsx
'use client';

import { useRef, useEffect, useCallback } from 'react';
import { ChevronRight, ChevronDown, Plus, Eye, EyeOff } from 'lucide-react';
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
import {
  setVariantsVisible,
  toggleLigandSite,
  toggleModificationType,
} from '@/store/slices/annotationsSlice';
import { makeChainKey } from '@/lib/chain_key';
import { parseLayerType } from './auxiliary/layerKind';
import { isAuxLayerActive } from './auxiliary/colorProviders';
import { ColorSwatchPicker } from '@/components/ui/ColorSwatchPicker';
import {
  resolveLigandColor,
  resolveVariantColor,
  resolveModificationColor,
} from '@/lib/colors/annotationPaletteResolve';
import {
  setLigandColorOverride,
  clearLigandColorOverride,
  setVariantColorOverride,
  clearVariantColorOverride,
  setModificationColorOverride,
  clearModificationColorOverride,
  selectLigandOverrides,
  selectVariantOverrides,
  selectModificationOverrides,
} from '@/store/slices/colorOverridesSlice';
import type { VariantType } from '@/store/slices/annotationsSlice';

interface MSALabelsProps {
  sequences: MsaSequence[];
  rowHeight: number;
  scrollTop: number;
  onWidthCalculated?: (width: number) => void;
  visibleChainKeys?: Set<string>;
  onToggleChainVisibility?: (chainKey: string) => void;
  onSoloChain?: (chainKey: string) => void;
  expandedSequences?: Set<string>;
  onToggleExpand?: (seqId: string) => void;
  onAddAlignment?: () => void;
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
  isotype: string;
}

function parseLabel(seq: MsaSequence): ParsedLabel {
  if (seq.originType === 'pdb' && seq.chainRef) {
    const greek = seq.family ? FAMILY_GREEK[seq.family] ?? '' : '';
    return {
      name: '',
      species: seq.organism ?? '',
      family: greek,
      structure: `${seq.chainRef.pdbId}:${seq.chainRef.chainId}`,
      isotype: seq.isotype ?? '',
    };
  }

  if (seq.originType === 'master') {
    return parseMasterLabel(seq.name);
  }

  return { name: seq.name, species: '', family: '', structure: '', isotype: '' };
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
      return { name: protName, species, family: '', structure: '', isotype: '' };
    }
    return { name: entry, species: '', family: '', structure: '', isotype: '' };
  }
  return { name, species: '', family: '', structure: '', isotype: '' };
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
  expandedSequences,
  onToggleExpand,
  onAddAlignment,
}: MSALabelsProps) {
  const dispatch = useAppDispatch();
  const selectedId = useAppSelector(selectSelectedSequenceId);
  const hoveredChainKey = useAppSelector(selectHoveredChainKey);
  const selectedChainKey = useAppSelector(selectSelectedChainKey);
  const annotationChains = useAppSelector(state => state.annotations.chains);
  const ligandOverrides = useAppSelector(selectLigandOverrides);
  const variantOverrides = useAppSelector(selectVariantOverrides);
  const modificationOverrides = useAppSelector(selectModificationOverrides);
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
      const text = [p.name, p.species, p.family, p.structure, p.isotype].filter(Boolean).join('  ');
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
          const isAux = seq.originType === 'auxiliary';
          const ck = chainKeyForSequence(seq);
          const isPdb = seq.originType === 'pdb';
          const isMaster = seq.originType === 'master';
          const isSelected = ck ? ck === selectedChainKey : seq.id === selectedId;
          const isHovered = ck ? ck === hoveredChainKey : false;
          const isLastMaster = idx === lastMasterIndex && hasMasters;
          const isFirstPdb = isPdb && idx === lastMasterIndex + 1;

          // Check if this PDB row is expanded (has visible auxiliary sub-rows)
          const isExpanded = isPdb && expandedSequences?.has(seq.id);
          // Check if next row is NOT an auxiliary of the same parent (= last aux in group)
          const isLastAux = isAux && (
            idx === sequences.length - 1 ||
            sequences[idx + 1]?.parentSequenceId !== seq.parentSequenceId
          );

          // ── Auxiliary track label ──
          if (isAux) {
            const desc = seq.layerType ? parseLayerType(seq.layerType) : null;
            const isTopLevelMod = desc?.kind === 'ptm';
            const chainKey = seq.parentSequenceId ?? '';
            const chainVis = annotationChains[chainKey]?.visibility;

            // Layer "active" state drives the eye icon.
            // 'variants' defaults true when no chain visibility is loaded; ptm defaults false.
            const layerActive = desc
              ? (chainVis
                  ? isAuxLayerActive(desc, chainVis)
                  : desc.kind !== 'ptm')
              : true;

            const handleToggleLayer = (e: React.MouseEvent) => {
              e.stopPropagation();
              if (!chainKey || !desc) return;
              switch (desc.kind) {
                case 'variants':
                  dispatch(setVariantsVisible({ chainKey, visible: !layerActive }));
                  break;
                case 'ligand':
                  if (desc.id) dispatch(toggleLigandSite({ chainKey, siteId: desc.id }));
                  break;
                case 'ptm':
                  if (desc.id) dispatch(toggleModificationType({ chainKey, modType: desc.id }));
                  break;
              }
            };

            const EyeIcon = layerActive ? Eye : EyeOff;

            // Build a color swatch (or swatches) for the aux row based on layer kind.
            // - ligand: one swatch keyed by ligandId (look up the site to resolve ligandId from site.id)
            // - ptm:    one swatch keyed by modification type (desc.id)
            // - variants: three tiny swatches for SUB/INS/DEL (one row contains all three types)
            let swatches: React.ReactNode = null;
            if (desc?.kind === 'ligand' && desc.id) {
              const site = annotationChains[chainKey]?.data?.ligandSites.find(s => s.id === desc.id);
              const ligandId = site?.ligandId;
              if (ligandId) {
                const color = resolveLigandColor(ligandOverrides, ligandId);
                const isOverridden = Boolean(ligandOverrides[ligandId]);
                swatches = (
                  <ColorSwatchPicker
                    color={color}
                    isOverridden={isOverridden}
                    onChange={(hex) => dispatch(setLigandColorOverride({ key: ligandId, color: hex }))}
                    onReset={() => dispatch(clearLigandColorOverride(ligandId))}
                    title={`Color for ${ligandId}`}
                  >
                    <span
                      className="inline-block w-2 h-2 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: color }}
                    />
                  </ColorSwatchPicker>
                );
              }
            } else if (desc?.kind === 'ptm' && desc.id) {
              const color = resolveModificationColor(modificationOverrides, desc.id);
              const isOverridden = Boolean(modificationOverrides[desc.id]);
              const modType = desc.id;
              swatches = (
                <ColorSwatchPicker
                  color={color}
                  isOverridden={isOverridden}
                  onChange={(hex) => dispatch(setModificationColorOverride({ key: modType, color: hex }))}
                  onReset={() => dispatch(clearModificationColorOverride(modType))}
                  title={`Color for ${modType}`}
                >
                  <span
                    className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: color }}
                  />
                </ColorSwatchPicker>
              );
            } else if (desc?.kind === 'variants') {
              const types: VariantType[] = ['substitution', 'insertion', 'deletion'];
              swatches = (
                <span className="inline-flex items-center gap-0.5 flex-shrink-0">
                  {types.map(t => {
                    const color = resolveVariantColor(variantOverrides, t);
                    const isOverridden = Boolean(variantOverrides[t]);
                    return (
                      <ColorSwatchPicker
                        key={t}
                        color={color}
                        isOverridden={isOverridden}
                        onChange={(hex) => dispatch(setVariantColorOverride({ key: t, color: hex }))}
                        onReset={() => dispatch(clearVariantColorOverride(t))}
                        title={`Color for ${t}`}
                      >
                        <span
                          className="inline-block w-1.5 h-2 rounded-[1px]"
                          style={{ backgroundColor: color }}
                        />
                      </ColorSwatchPicker>
                    );
                  })}
                </span>
              );
            }

            if (isTopLevelMod) {
              return (
                <div
                  key={seq.id}
                  className="flex items-center gap-1 px-1.5 select-none whitespace-nowrap text-[10px] font-mono text-gray-500"
                  style={{
                    height: rowHeight,
                    lineHeight: `${rowHeight}px`,
                  }}
                  title={seq.layerLabel ?? seq.name}
                >
                  <button
                    onClick={handleToggleLayer}
                    className={`flex-shrink-0 p-0 ${layerActive ? 'text-orange-400' : 'text-gray-300'} hover:text-orange-600`}
                  >
                    <EyeIcon size={9} />
                  </button>
                  {swatches}
                  <span className={layerActive ? 'text-orange-500' : 'text-gray-300'}>{seq.layerLabel ?? seq.name}</span>
                </div>
              );
            }
            return (
              <div
                key={seq.id}
                className={`
                  flex items-center gap-1 pl-3 pr-1.5 select-none whitespace-nowrap
                  text-[9px] font-mono
                  bg-gray-50/80
                  ${isLastAux ? 'border-b border-gray-200' : ''}
                `}
                style={{
                  height: rowHeight,
                  lineHeight: `${rowHeight}px`,
                  borderLeft: '2px solid #d1d5db',
                }}
                title={seq.layerLabel ?? seq.name}
              >
                <button
                  onClick={handleToggleLayer}
                  className={`flex-shrink-0 p-0 ${layerActive ? 'text-gray-400' : 'text-gray-300'} hover:text-gray-600`}
                >
                  <EyeIcon size={9} />
                </button>
                {swatches}
                <span className={layerActive ? 'text-gray-400' : 'text-gray-300'}>{seq.layerLabel ?? seq.name}</span>
              </div>
            );
          }

          // ── Primary sequence label (master, pdb, etc.) ──
          const parsed = parseLabel(seq);
          const isChainVisible = isPdb && ck
            ? (visibleChainKeys ? visibleChainKeys.has(ck) : true)
            : true;
          const VisEyeIcon = isChainVisible ? Eye : EyeOff;

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
                    ? 'bg-green-50 text-gray-700'
                    : isMaster
                      ? 'text-gray-400'
                      : 'text-gray-600'
                }
                ${isPdb && !isSelected && !isHovered ? 'hover:bg-gray-100' : ''}
                ${isLastMaster ? 'border-b-[3px] border-gray-400' : ''}
                ${isPdb && !isFirstPdb ? 'border-t border-gray-300' : ''}
                ${isFirstPdb ? 'font-semibold' : ''}
                ${isPdb && !isChainVisible ? 'opacity-40' : ''}
              `}
              style={{
                height: rowHeight,
                lineHeight: `${rowHeight}px`,
                cursor: isPdb ? 'pointer' : 'default',
              }}
              title={seq.name}
            >
              {isPdb && onToggleExpand ? (
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleExpand(seq.id); }}
                  className="flex-shrink-0 w-3 h-3 flex items-center justify-center text-gray-400 hover:text-gray-600"
                >
                  {isExpanded
                    ? <ChevronDown size={10} />
                    : <ChevronRight size={10} />
                  }
                </button>
              ) : null}
              {isPdb && ck && onToggleChainVisibility ? (
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleChainVisibility(ck); }}
                  className={`flex-shrink-0 p-0 ${isChainVisible ? 'text-gray-400 hover:text-gray-700' : 'text-gray-300 hover:text-gray-500'}`}
                  title={isChainVisible ? 'Hide chain in 3D view' : 'Show chain in 3D view'}
                >
                  <VisEyeIcon size={10} />
                </button>
              ) : null}
              {parsed.family && (
                <span className="text-gray-500 w-3 text-center flex-shrink-0">{parsed.family}</span>
              )}
              {parsed.structure && (
                <span className="text-gray-700 flex-shrink-0">{parsed.structure}</span>
              )}
              {parsed.isotype && (
                <span className="text-blue-500 flex-shrink-0">{parsed.isotype}</span>
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
        {onAddAlignment && (
          <button
            onClick={onAddAlignment}
            className="flex items-center gap-1 px-1.5 w-full text-[9px] text-gray-400 hover:text-blue-500 hover:bg-blue-50/50 transition-colors"
            style={{ height: rowHeight, lineHeight: `${rowHeight}px` }}
          >
            <Plus size={10} />
            <span>add polymer</span>
          </button>
        )}
      </div>
    </div>
  );
}
