// src/components/msa/MSALabels.tsx
'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, ChevronDown, Plus, Eye, EyeOff, X, Info } from 'lucide-react';
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
  toggleModificationMuted,
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
import { PerChainPtmDropdown } from './PerChainPtmDropdown';
import {
  addTrack,
  removeTrack,
  toggleTrackVisibility,
  clearAllTracks,
  selectAllTracks,
  type FilterSpec,
  type Family,
  type TrackEntry,
} from '@/store/slices/annotationTracksSlice';
import { AddTrackDialog } from './AddTrackDialog';

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
  primaryPdbId?: string | null;
  primaryChainId?: string | null;
  onRemoveAlignedChain?: (chainKey: string) => void;
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
  primaryPdbId,
  primaryChainId,
  onRemoveAlignedChain,
}: MSALabelsProps) {
  const dispatch = useAppDispatch();
  const selectedId = useAppSelector(selectSelectedSequenceId);
  const hoveredChainKey = useAppSelector(selectHoveredChainKey);
  const selectedChainKey = useAppSelector(selectSelectedChainKey);
  const annotationChains = useAppSelector(state => state.annotations.chains);
  const allTracks = useAppSelector(selectAllTracks);
  const ligandOverrides = useAppSelector(selectLigandOverrides);
  const variantOverrides = useAppSelector(selectVariantOverrides);
  const modificationOverrides = useAppSelector(selectModificationOverrides);
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);

  // Track-info popover state: which track row's info card is currently open
  // and the screen-space rect of its anchor button (for positioning).
  const [openTrackInfo, setOpenTrackInfo] = useState<{ id: string; rect: DOMRect } | null>(null);

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
    // +24 baseline buffer + 22 for the per-chain PTMs trigger that sits at the
    // end of every PDB row (handled inline now, not absolutely positioned).
    const finalWidth = Math.max(maxWidth + 46, 140);
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
          // Blank gap row between master group and pdb group -- no labels, no events.
          if (seq.originType === 'spacer') {
            return (
              <div
                key={seq.id}
                style={{ height: rowHeight }}
                aria-hidden="true"
              />
            );
          }

          const isAux = seq.originType === 'auxiliary';
          const ck = chainKeyForSequence(seq);
          const isPdb = seq.originType === 'pdb';
          const isMaster = seq.originType === 'master';
          const isSelected = ck ? ck === selectedChainKey : seq.id === selectedId;
          const isHovered = ck ? ck === hoveredChainKey : false;
          const isLastMaster = idx === lastMasterIndex && hasMasters;
          // "First PDB" = the first pdb row after the master group (or after the spacer that follows it).
          const prevSeq = idx > 0 ? sequences[idx - 1] : null;
          const isFirstPdb = isPdb && (!prevSeq || prevSeq.originType === 'master' || prevSeq.originType === 'spacer');

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
            const chainKey = seq.parentSequenceId ?? '';
            const chainVis = annotationChains[chainKey]?.visibility;
            // Tracks are global; resolve the entry from the tracks slice
            // (desc.id for tracks is the bare hash without 'track_' prefix).
            const trackEntry = desc?.kind === 'track' && desc.id
              ? (allTracks.find(t => t.spec.id === `track_${desc.id}` || t.spec.id === desc.id) ?? null)
              : null;

            // Layer "active" state drives the eye icon.
            //   - track: entry.visibility.visible
            //   - PTM:   selected AND not muted
            //   - others: standard chain visibility flag
            const layerActive = desc
              ? (desc.kind === 'track'
                  ? Boolean(trackEntry?.visibility.visible)
                  : (chainVis
                      ? isAuxLayerActive(desc, chainVis)
                      : desc.kind !== 'ptm'))
              : true;

            // Eye click semantics:
            //   - variants: flip showVariants (paint on/off; row stays)
            //   - ligand:   flip site in visibleLigandIds (paint on/off; row stays)
            //   - ptm:      flip muted state ONLY (paint on/off; row stays).
            //   - track:    flip TrackVisibility.visible.
            const handleToggleLayer = (e: React.MouseEvent) => {
              e.stopPropagation();
              if (!desc) return;
              if (desc.kind === 'track') {
                if (trackEntry) dispatch(toggleTrackVisibility(trackEntry.spec.id));
                return;
              }
              if (!chainKey) return;
              switch (desc.kind) {
                case 'variants':
                  dispatch(setVariantsVisible({ chainKey, visible: !layerActive }));
                  break;
                case 'ligand':
                  if (desc.id) dispatch(toggleLigandSite({ chainKey, siteId: desc.id }));
                  break;
                case 'ptm':
                  if (desc.id) dispatch(toggleModificationMuted({ chainKey, modType: desc.id }));
                  break;
              }
            };

            // X click semantics:
            //   - ptm:   removes the type from visibleModificationTypes.
            //   - track: removes the track entirely (it's global, not chain-scoped).
            //   - others: no delete (data is intrinsic to the chain).
            const handleDeleteLayer = (e: React.MouseEvent) => {
              e.stopPropagation();
              if (!desc) return;
              if (desc.kind === 'track') {
                if (trackEntry) dispatch(removeTrack(trackEntry.spec.id));
                return;
              }
              if (!chainKey || desc.kind !== 'ptm' || !desc.id) return;
              dispatch(toggleModificationType({ chainKey, modType: desc.id }));
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
            } else if (desc?.kind === 'track' && trackEntry) {
              const paint = trackEntry.spec.paint;
              if (paint.kind === 'flat') {
                swatches = (
                  <span
                    className="inline-block w-2 h-2 rounded-sm flex-shrink-0 border border-white/50"
                    style={{ backgroundColor: paint.color }}
                    title={`Track paint: ${paint.color}`}
                  />
                );
              } else {
                // byField: show a multi-segment chip from the palette's first few values
                const chips = Object.values(paint.palette).slice(0, 3);
                swatches = (
                  <span className="inline-flex items-center gap-0.5 flex-shrink-0" title="By-field paint">
                    {chips.map((c, i) => (
                      <span
                        key={i}
                        className="inline-block w-1.5 h-2 rounded-[1px]"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </span>
                );
              }
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

            // Unified aux row layout: all aux rows (variants, ligands, PTMs)
            // get the indented "quote" border so they visually nest under their
            // parent chain. PTM rows additionally get an X to deselect the type.
            const isPtmRow = desc?.kind === 'ptm';
            const isTrackRow = desc?.kind === 'track';
            const isDeletable = isPtmRow || isTrackRow;
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
                  title={layerActive ? 'Hide overpaint' : 'Show overpaint'}
                  className={`flex-shrink-0 p-0 ${layerActive ? 'text-gray-400' : 'text-gray-300'} hover:text-gray-600`}
                >
                  <EyeIcon size={9} />
                </button>
                {swatches}
                <span className={layerActive ? 'text-gray-400' : 'text-gray-300'}>
                  {seq.layerLabel ?? seq.name}
                </span>
                {isTrackRow && trackEntry && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      setOpenTrackInfo(prev =>
                        prev?.id === trackEntry.spec.id ? null : { id: trackEntry.spec.id, rect }
                      );
                    }}
                    title="Show how this track was built"
                    className="ml-auto flex-shrink-0 p-0 text-gray-300 hover:text-blue-500"
                  >
                    <Info size={9} />
                  </button>
                )}
                {isDeletable && (
                  <button
                    onClick={handleDeleteLayer}
                    title={isTrackRow ? 'Remove this track' : 'Remove this PTM track'}
                    className={`${isTrackRow ? '' : 'ml-auto'} flex-shrink-0 p-0 text-gray-300 hover:text-red-500`}
                  >
                    <X size={9} />
                  </button>
                )}
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
              {/* Tool cluster: uniform h-4 buttons grouped on the left of every PDB row. */}
              {isPdb && (
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  {onToggleExpand && (
                    <button
                      type="button"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => { e.stopPropagation(); onToggleExpand(seq.id); }}
                      title={isExpanded ? 'Collapse chain' : 'Expand chain (variants, ligands)'}
                      className="w-4 h-4 inline-flex items-center justify-center rounded text-gray-400 hover:text-gray-800 hover:bg-gray-100 transition-colors"
                    >
                      {isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                    </button>
                  )}
                  {ck && onToggleChainVisibility && (
                    <button
                      type="button"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => { e.stopPropagation(); onToggleChainVisibility(ck); }}
                      title={isChainVisible ? 'Hide chain in 3D view' : 'Show chain in 3D view'}
                      className={`w-4 h-4 inline-flex items-center justify-center rounded hover:bg-gray-100 transition-colors ${
                        isChainVisible ? 'text-gray-400 hover:text-gray-800' : 'text-gray-300 hover:text-gray-500'
                      }`}
                    >
                      <VisEyeIcon size={10} />
                    </button>
                  )}
                  {(() => {
                    if (!ck || !onRemoveAlignedChain) return null;
                    const isPrimary = !!(primaryPdbId && primaryChainId
                      && ck === makeChainKey(primaryPdbId, primaryChainId));
                    if (isPrimary) return null;
                    return (
                      <button
                        type="button"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => { e.stopPropagation(); onRemoveAlignedChain(ck); }}
                        title="Remove alignment"
                        className="w-4 h-4 inline-flex items-center justify-center rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <X size={10} />
                      </button>
                    );
                  })()}
                  {ck && <PerChainPtmDropdown chainKey={ck} />}
                </div>
              )}

              {/* Text labels: truncate when the labels column is narrow. */}
              <div
                className="flex items-center gap-1 min-w-0 flex-1 overflow-hidden"
                style={{ marginLeft: isPdb ? 6 : 0 }}
              >
                <span
                  className="whitespace-nowrap overflow-hidden text-ellipsis"
                  style={{ display: 'block', width: '100%' }}
                >
                  {parsed.family && (
                    <span className="text-gray-500 mr-1">{parsed.family}</span>
                  )}
                  {parsed.structure && (
                    <span className="text-gray-700 mr-1">{parsed.structure}</span>
                  )}
                  {parsed.isotype && (
                    <span className="text-blue-500 mr-1">{parsed.isotype}</span>
                  )}
                  {parsed.name && (
                    <span className={`mr-1 ${isMaster ? 'text-gray-500' : 'text-gray-700'}`}>
                      {parsed.name}
                    </span>
                  )}
                  {parsed.species && (
                    <span className="text-gray-400">{parsed.species}</span>
                  )}
                </span>
              </div>
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

        {/* Annotation track surfaces:
              - Custom track: full FilterSpec builder modal (Phase 3)
              - Presets disclosure: quick smoke-test surface (kept for now) */}
        <TrackPanelFooter rowHeight={rowHeight} sequences={sequences} />
      </div>

      {/* Track info popover: shows the FilterSpec underlying a track row when
          the user clicks its Info button. Portal-rendered so it can overflow
          the narrow label column. */}
      {openTrackInfo && (() => {
        const entry = allTracks.find(t => t.spec.id === openTrackInfo.id);
        if (!entry) return null;
        return (
          <TrackInfoPopover
            entry={entry}
            anchorRect={openTrackInfo.rect}
            onClose={() => setOpenTrackInfo(null)}
          />
        );
      })()}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Track panel footer — "Custom track" button (opens modal) + presets disclosure
// ---------------------------------------------------------------------------

function TrackPanelFooter({ rowHeight, sequences }: { rowHeight: number; sequences: MsaSequence[] }) {
  const [dialogOpen, setDialogOpen] = useState(false);

  // Family is implicit — derived from the displayed primary chain. The modal
  // doesn't expose a family selector; user opens the modal in the context of
  // whatever family they're viewing.
  const activeFamily = (() => {
    for (const s of sequences) {
      if (s.originType === 'pdb' || s.originType === 'master') {
        if (s.family) return s.family as Family;
      }
    }
    return null;
  })();

  const canOpen = activeFamily !== null;

  return (
    <>
      <button
        onClick={() => canOpen && setDialogOpen(true)}
        disabled={!canOpen}
        title={canOpen ? `Add a variants track for ${activeFamily?.replace('tubulin_', '')}` : 'Load a chain first'}
        className={`
          flex items-center gap-1 px-1.5 w-full text-[9px] transition-colors
          ${canOpen
            ? 'text-gray-400 hover:text-emerald-600 hover:bg-emerald-50/50'
            : 'text-gray-300 cursor-not-allowed'}
        `}
        style={{ height: rowHeight, lineHeight: `${rowHeight}px` }}
      >
        <Plus size={10} />
        <span>add variants track</span>
      </button>
      <TrackPresetButtons rowHeight={rowHeight} />
      {dialogOpen && activeFamily && (
        <AddTrackDialog
          family={activeFamily}
          onClose={() => setDialogOpen(false)}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Track preset buttons (smoke-test surface, kept alongside the modal)
// ---------------------------------------------------------------------------

interface PresetTrack {
  label: string;
  family: 'tubulin_alpha' | 'tubulin_beta';
  color: string;
  filters: FilterSpec;
}

const TRACK_PRESETS: PresetTrack[] = [
  {
    label: 'TUBB3 CFEOM',
    family: 'tubulin_beta',
    color: '#F39C12',
    filters: {
      kind: 'variants',
      family: 'tubulin_beta',
      sources: ['literature'],
      uniprot_ids: ['Q13509'],
      phenotype_contains: ['fibrosis of the extraocular'],
    },
  },
  {
    label: 'Tubulinopathies (beta)',
    family: 'tubulin_beta',
    color: '#E74C3C',
    filters: {
      kind: 'variants',
      family: 'tubulin_beta',
      sources: ['literature'],
      phenotype_contains: ['fibrosis', 'Cortical dysplasia', 'lissencephaly', 'microcephaly'],
    },
  },
  {
    label: 'K + acetylation (alpha)',
    family: 'tubulin_alpha',
    color: '#8E44AD',
    filters: {
      kind: 'variants',
      family: 'tubulin_alpha',
      sources: ['structural'],
      wild_type_aas: ['K'],
      co_occurs_with_mod_type: ['acetylation'],
    },
  },
  {
    label: 'Phospho human (alpha)',
    family: 'tubulin_alpha',
    color: '#3498DB',
    filters: {
      kind: 'modifications',
      family: 'tubulin_alpha',
      modification_types: ['phosphorylation'],
      species_tax_ids: [9606],
    },
  },
  {
    label: 'GTP contacts (beta)',
    family: 'tubulin_beta',
    color: '#1ABC9C',
    filters: {
      kind: 'binding_contacts',
      family: 'tubulin_beta',
      chemical_ids: ['GTP'],
    },
  },
];

function TrackPresetButtons({ rowHeight }: { rowHeight: number }) {
  const dispatch = useAppDispatch();
  const allTracks = useAppSelector(selectAllTracks);

  const handleAdd = (p: PresetTrack) => {
    dispatch(addTrack({
      label: p.label,
      family: p.family,
      filters: p.filters,
      paint: { kind: 'flat', color: p.color },
    }));
  };

  return (
    <details className="text-[9px]">
      <summary
        className="flex items-center gap-1 px-1.5 w-full text-gray-400 hover:text-emerald-600 hover:bg-emerald-50/50 cursor-pointer list-none transition-colors"
        style={{ height: rowHeight, lineHeight: `${rowHeight}px` }}
      >
        <Plus size={10} />
        <span>add track (presets)</span>
        {allTracks.length > 0 && (
          <span className="ml-auto text-emerald-600">{allTracks.length}</span>
        )}
      </summary>
      <div className="flex flex-col">
        {TRACK_PRESETS.map(p => (
          <button
            key={p.label}
            onClick={() => handleAdd(p)}
            className="flex items-center gap-1.5 pl-4 pr-1.5 w-full text-left text-gray-500 hover:bg-gray-100"
            style={{ height: rowHeight, lineHeight: `${rowHeight}px` }}
            title={`Add: ${p.label}`}
          >
            <span
              className="inline-block w-2 h-2 rounded-sm flex-shrink-0"
              style={{ backgroundColor: p.color }}
            />
            <span className="truncate">{p.label}</span>
          </button>
        ))}
        {allTracks.length > 0 && (
          <button
            onClick={() => dispatch(clearAllTracks())}
            className="flex items-center gap-1.5 pl-4 pr-1.5 w-full text-left text-gray-400 hover:text-red-500 hover:bg-red-50/50"
            style={{ height: rowHeight, lineHeight: `${rowHeight}px` }}
          >
            <X size={10} />
            <span>clear all tracks</span>
          </button>
        )}
      </div>
    </details>
  );
}

// ---------------------------------------------------------------------------
// TrackInfoPopover — shows the FilterSpec details for a track row.
// Portal-rendered, positioned to the right of the anchor button so it can
// overflow the narrow label column. Closes on click-outside or X.
// ---------------------------------------------------------------------------

function TrackInfoPopover({
  entry,
  anchorRect,
  onClose,
}: {
  entry: TrackEntry;
  anchorRect: DOMRect;
  onClose: () => void;
}) {
  const popoverRef = useRef<HTMLDivElement>(null);

  // Click-outside to close
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (!popoverRef.current) return;
      if (popoverRef.current.contains(e.target as Node)) return;
      onClose();
    };
    // Defer the listener attach by one tick so the click that OPENED the
    // popover doesn't immediately close it.
    const handle = setTimeout(() => {
      document.addEventListener('mousedown', onMouseDown);
    }, 0);
    return () => {
      clearTimeout(handle);
      document.removeEventListener('mousedown', onMouseDown);
    };
  }, [onClose]);

  // ESC to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const spec = entry.spec.filters;
  const paint = entry.spec.paint;

  // Build a row list from non-empty filter fields. Each row is [label, value-renderer].
  // Generic over the discriminated FilterSpec — only render keys that are
  // present and non-empty on the active variant.
  const rows: Array<{ label: string; value: React.ReactNode }> = [];
  rows.push({ label: 'Kind', value: <span className="font-mono">{spec.kind}</span> });
  rows.push({ label: 'Family', value: <span className="font-mono">{spec.family.replace('tubulin_', '')}</span> });

  const pushChips = (label: string, values: (string | number)[] | undefined) => {
    if (!values || values.length === 0) return;
    rows.push({
      label,
      value: (
        <span className="flex flex-wrap gap-0.5">
          {values.map((v, i) => (
            <span
              key={`${v}-${i}`}
              className="px-1 py-px rounded border border-gray-200 bg-gray-50 text-[9px] font-mono"
            >
              {String(v)}
            </span>
          ))}
        </span>
      ),
    });
  };

  if (spec.kind === 'variants') {
    pushChips('Sources', spec.sources);
    pushChips('Wild-type', spec.wild_type_aas);
    pushChips('Observed', spec.observed_aas);
    pushChips('UniProt IDs', spec.uniprot_ids);
    pushChips('Co-occurs PTM', spec.co_occurs_with_mod_type);
    pushChips('Species', spec.species_names);
    pushChips('Phenotype contains', spec.phenotype_contains);
    if (spec.position_range) {
      rows.push({
        label: 'Position range',
        value: <span className="font-mono">{spec.position_range[0]}–{spec.position_range[1]}</span>,
      });
    }
    if (spec.indel_present != null) {
      rows.push({ label: 'Indel only', value: <span>{spec.indel_present ? 'yes' : 'no'}</span> });
    }
  } else if (spec.kind === 'modifications') {
    pushChips('Mod types', spec.modification_types);
    pushChips('UniProt IDs', spec.uniprot_ids);
    pushChips('Tax IDs', spec.species_tax_ids);
    pushChips('Species names', spec.species_names);
    pushChips('Evidence source', spec.evidence_source);
    pushChips('Phenotype contains', spec.phenotype_contains);
    if (spec.position_range) {
      rows.push({ label: 'Position range', value: <span className="font-mono">{spec.position_range[0]}–{spec.position_range[1]}</span> });
    }
    if (spec.co_occurs_with_variant) {
      rows.push({ label: 'Co-occurs with variant', value: <span>yes</span> });
    }
  } else if (spec.kind === 'binding_contacts') {
    pushChips('Chemical IDs', spec.chemical_ids);
    pushChips('Structure IDs', spec.structure_ids);
  }

  // Position popover to the right of the anchor; if too close to right edge,
  // flip to the left side instead.
  const POPOVER_WIDTH = 320;
  const margin = 8;
  const wouldOverflow = anchorRect.right + margin + POPOVER_WIDTH > window.innerWidth;
  const left = wouldOverflow
    ? Math.max(margin, anchorRect.left - POPOVER_WIDTH - margin)
    : anchorRect.right + margin;
  const top = Math.min(
    Math.max(margin, anchorRect.top),
    window.innerHeight - 400,  // leave room for the popover height
  );

  const matched = entry.resolved?.length;

  return createPortal(
    <div
      ref={popoverRef}
      className="fixed z-50 bg-white border border-gray-200 rounded-md shadow-lg text-[10px] text-gray-700"
      style={{ top, left, width: POPOVER_WIDTH, maxHeight: 'min(400px, calc(100vh - 48px))' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-gray-100">
        <div className="flex items-center gap-1.5 min-w-0">
          {paint.kind === 'flat' && (
            <span
              className="w-2.5 h-2.5 rounded-sm flex-shrink-0 border border-white/50"
              style={{ backgroundColor: paint.color }}
            />
          )}
          <span className="font-semibold text-gray-800 truncate" title={entry.spec.label}>
            {entry.spec.label}
          </span>
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0 p-0.5 text-gray-400 hover:text-gray-700"
          title="Close"
        >
          <X size={10} />
        </button>
      </div>

      {/* Body */}
      <div className="px-2.5 py-1.5 overflow-y-auto" style={{ maxHeight: 320 }}>
        <table className="w-full">
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="align-top">
                <td className="text-[9px] uppercase tracking-wider text-gray-400 pr-2 py-0.5 whitespace-nowrap">
                  {r.label}
                </td>
                <td className="py-0.5">{r.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-2.5 py-1.5 border-t border-gray-100 bg-gray-50/50">
        <span className="text-[9px] text-gray-500">
          {entry.isLoading
            ? 'resolving…'
            : entry.error
              ? <span className="text-red-500">error</span>
              : matched != null
                ? <><span className="font-semibold text-gray-700">{matched}</span> position{matched === 1 ? '' : 's'} matched</>
                : 'not yet resolved'}
        </span>
        <span className="text-[9px] text-gray-300 font-mono truncate" title={entry.spec.id}>
          {entry.spec.id.slice(0, 14)}…
        </span>
      </div>
    </div>,
    document.body,
  );
}
