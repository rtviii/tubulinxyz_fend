'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, ExternalLink, Crosshair, Plus } from 'lucide-react';
import { useGetVariantsAtPositionQuery, useGetModificationsAtPositionQuery } from '@/store/tubxz_api';
import type { VariantAnnotation, ModificationAnnotation } from '@/store/tubxz_api';
import { MODIFICATION_COLORS } from '@/lib/colors/annotationPalette';
import { useOrganismMap } from '@/services/organism_map';
import type { MolstarInstance } from '@/components/molstar/services/MolstarInstance';
import type { ResiduePopupTarget } from './types';
import { useAppSelector, useAppDispatch } from '@/store/store';
import { selectAllTracks, setHoveredTrack, type TrackEntry } from '@/store/slices/annotationTracksSlice';

// ── Drag hook ────────────────────────────────────────────────

function useDrag(initialPos: { x: number; y: number }) {
  const [pos, setPos] = useState(initialPos);
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });
  // Track whether the user has manually dragged
  const userDragged = useRef(false);

  // Sync with new initial position only if user hasn't dragged
  useEffect(() => {
    if (!userDragged.current) setPos(initialPos);
  }, [initialPos.x, initialPos.y]); // eslint-disable-line react-hooks/exhaustive-deps

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    offset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      userDragged.current = true;
      setPos({ x: ev.clientX - offset.current.x, y: ev.clientY - offset.current.y });
    };
    const onUp = () => {
      dragging.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [pos.x, pos.y]);

  return { pos, onMouseDown, userDragged };
}

// ── Shared content (the inner card) ──────────────────────────

export function ResiduePopupContent({ target, onClose, onFocus, onToggleBallStick, ballStickActive, onAlignChain, onMouseDownHeader }: {
  target: ResiduePopupTarget;
  onClose: () => void;
  onFocus?: () => void;
  onToggleBallStick?: () => void;
  ballStickActive?: boolean;
  onAlignChain?: (pdbId: string, chainId: string) => void;
  onMouseDownHeader?: (e: React.MouseEvent) => void;
}) {
  const hasFamily = !!target.family;
  const organismMap = useOrganismMap();

  const { data: variantsData, isLoading: variantsLoading } = useGetVariantsAtPositionQuery(
    { family: target.family!, position: target.masterIndex },
    { skip: !hasFamily }
  );
  const { data: modsData, isLoading: modsLoading } = useGetModificationsAtPositionQuery(
    { family: target.family!, position: target.masterIndex },
    { skip: !hasFamily }
  );

  const isLoading = variantsLoading || modsLoading;
  const allVariants = variantsData?.variants ?? [];
  const modifications = modsData?.modifications ?? [];

  // Unified substitution groups (literature + structural merged by path)
  const allSubs = allVariants.filter(v => v.type === 'substitution');
  const subPathGroups = groupSubstitutionsByPath(allSubs);

  // Group modifications by type
  const modsByType: Record<string, ModificationAnnotation[]> = {};
  for (const m of modifications) {
    if (!modsByType[m.modification_type]) modsByType[m.modification_type] = [];
    modsByType[m.modification_type].push(m);
  }

  // Aux annotation tracks: surface any track whose family matches and whose
  // resolved positions include this masterIndex. The popup shows ALL such
  // tracks regardless of the row's eye-toggle state -- this is an inspection
  // panel, not a paint panel.
  const allTracks = useAppSelector(selectAllTracks);
  const trackHits = useMemo(() => {
    type Hit = { entry: TrackEntry; position: NonNullable<TrackEntry['resolved']>[number]; color: string };
    const hits: Hit[] = [];
    for (const entry of allTracks) {
      if (entry.spec.family !== target.family) continue;
      if (!entry.resolved) continue;
      const position = entry.resolved.find(p => p.master_index === target.masterIndex);
      if (!position) continue;
      // Inline color resolve (bypasses the visibility gate in computeTrackCells:
      // popup is for inspection, not paint).
      let color = '#9ca3af';
      const paint = entry.spec.paint;
      if (paint.kind === 'flat') {
        color = paint.color;
      } else if (paint.kind === 'byField') {
        const rec = position.matched_records[0];
        const val = rec ? rec[paint.field] : null;
        if (val != null && paint.palette[String(val)]) color = paint.palette[String(val)];
      }
      hits.push({ entry, position, color });
    }
    return hits;
  }, [allTracks, target.family, target.masterIndex]);

  // Section-level collapsible state. Tracks start collapsed.
  const [subsOpen, setSubsOpen] = useState(true);
  const [modsOpen, setModsOpen] = useState(true);
  const [tracksOpen, setTracksOpen] = useState(false);

  // Stop drag from being initiated when interacting with header buttons
  const stopDrag = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <>
      {/* Title bar: the whole header is the drag handle (OS-window style) */}
      <div
        className="flex items-center gap-1 px-1.5 py-1 border-b border-gray-200/70 bg-gray-50/60 rounded-t-lg cursor-grab active:cursor-grabbing select-none"
        onMouseDown={onMouseDownHeader}
        title={`${target.label} · col ${target.masterIndex}`}
      >
        <span className="font-mono font-bold text-gray-900 text-xs">
          {target.residueLetter}
          {target.authSeqId !== undefined ? target.authSeqId : target.masterIndex}
        </span>
        <div className="flex-1" />
        <div className="flex items-center gap-0.5" onMouseDown={stopDrag}>
          {onFocus && (
            <button
              onClick={onFocus}
              onMouseDown={stopDrag}
              className="p-0.5 rounded hover:bg-gray-200 text-gray-400 hover:text-blue-500 transition-colors"
              title="Focus residue"
            >
              <Crosshair size={11} />
            </button>
          )}
          {onToggleBallStick && target.authSeqId !== undefined && (
            <button
              onClick={onToggleBallStick}
              onMouseDown={stopDrag}
              className={`p-0.5 rounded transition-colors ${ballStickActive ? 'bg-amber-100 text-amber-600' : 'hover:bg-gray-200 text-gray-400 hover:text-amber-500'}`}
              title={ballStickActive ? 'Hide ball-and-stick' : 'Show ball-and-stick'}
            >
              <img src="/landing/ligand_icon.svg" alt="ligand" className={`w-[11px] h-[11px] ${ballStickActive ? 'opacity-80' : 'opacity-40 hover:opacity-80'}`} />
            </button>
          )}
          <button
            onClick={onClose}
            onMouseDown={stopDrag}
            className="p-0.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={11} />
          </button>
        </div>
      </div>

      <div className="px-1.5 py-0.5 max-h-[340px] overflow-y-auto no-scrollbar" style={{ minWidth: 240 }}>
        {!hasFamily && (
          <div className="text-[9px] text-gray-400 italic">No family data available</div>
        )}

        {isLoading && (
          <div className="flex items-center gap-1.5 py-1.5">
            <div className="animate-spin h-2.5 w-2.5 border border-gray-300 border-t-transparent rounded-full" />
            <span className="text-[9px] text-gray-400">Loading...</span>
          </div>
        )}

        {!isLoading && hasFamily && (
          <>
            {/* Unified substitutions -- all sources merged by path */}
            {subPathGroups.length > 0 && (
              <div className="mb-0.5">
                <SectionHeader
                  label="Substitutions"
                  count={allSubs.length}
                  open={subsOpen}
                  onToggle={() => setSubsOpen(o => !o)}
                />
                {subsOpen && (
                  <div>
                    {subPathGroups.map(({ path, variants: pvs }) => (
                      <SubstitutionPathRow key={path} path={path} variants={pvs} total={allSubs.length} organismMap={organismMap} onAlignChain={onAlignChain} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Modifications grouped by type */}
            {Object.keys(modsByType).length > 0 && (
              <div className="mb-0.5">
                <SectionHeader
                  label="Modifications"
                  count={modifications.length}
                  open={modsOpen}
                  onToggle={() => setModsOpen(o => !o)}
                />
                {modsOpen && (
                  <div>
                    {Object.entries(modsByType)
                      .sort((a, b) => b[1].length - a[1].length)
                      .map(([type, mods]) => (
                        <ModificationTypeRow key={type} type={type} mods={mods} total={modifications.length} />
                      ))}
                  </div>
                )}
              </div>
            )}

            {/* User-added annotation tracks matching this position */}
            {trackHits.length > 0 && (
              <div className="mb-0.5">
                <SectionHeader
                  label="Currently in tracks"
                  count={trackHits.length}
                  open={tracksOpen}
                  onToggle={() => setTracksOpen(o => !o)}
                />
                {tracksOpen && (
                  <div>
                    {trackHits.map(hit => (
                      <TrackHitRow key={hit.entry.spec.id} hit={hit} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Empty state */}
            {subPathGroups.length === 0 && modifications.length === 0 && trackHits.length === 0 && (
              <div className="text-[9px] text-gray-400 py-1">No annotations at this position</div>
            )}
          </>
        )}
      </div>
    </>
  );
}

// ── Collapsible section header (used for Substitutions / Del-Ins / Modifications) ──

function SectionHeader({
  label, count, open, onToggle,
}: {
  label: string;
  count: number;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className="flex items-center gap-1 px-0.5 py-px mb-px cursor-pointer rounded hover:bg-gray-100 select-none"
      onClick={onToggle}
    >
      <span className="text-[8px] text-gray-500 w-2 text-center leading-none">{open ? '▾' : '▸'}</span>
      <span className="text-[8px] font-semibold text-gray-500 uppercase tracking-wider">
        {label} <span className="text-gray-400">({count})</span>
      </span>
    </div>
  );
}

// ── Popup helpers ──

interface SubPathGroup {
  path: string;
  variants: VariantAnnotation[];
}

function groupSubstitutionsByPath(variants: VariantAnnotation[]): SubPathGroup[] {
  const groups: Record<string, VariantAnnotation[]> = {};
  for (const v of variants) {
    if (v.type !== 'substitution' || !v.wild_type || !v.observed) continue;
    const path = `${v.wild_type}\u2192${v.observed}`;
    if (!groups[path]) groups[path] = [];
    groups[path].push(v);
  }
  return Object.entries(groups)
    .map(([path, vs]) => ({ path, variants: vs }))
    .sort((a, b) => b.variants.length - a.variants.length);
}

/** Unified substitution path row: frequency bar + expandable list with literature entries on top */
function SubstitutionPathRow({
  path, variants, total, organismMap, onAlignChain,
}: {
  path: string;
  variants: VariantAnnotation[];
  total: number;
  organismMap: Record<string, string[]> | null;
  onAlignChain?: (pdbId: string, chainId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const fraction = total > 0 ? variants.length / total : 0;
  // Neutral slate fill in the popup so the bars don't compete with the 3D/MSA
  // substitution color (which is orange globally).
  const barColor = '#94a3b8'; // slate-400

  const litEntries = variants.filter(v => v.source !== 'structural');
  const structEntries = variants.filter(v => v.source === 'structural');

  return (
    <div>
      <div
        className="flex items-center gap-1 text-[9px] cursor-pointer hover:bg-gray-50 rounded px-0.5 py-px"
        onClick={() => setExpanded(e => !e)}
      >
        <span className="text-gray-400 w-2 text-center flex-shrink-0">{expanded ? '▾' : '▸'}</span>
        <span className="font-mono font-semibold text-gray-700 w-8 flex-shrink-0">{path}</span>
        <div className="flex-1 h-1.5 bg-gray-100 rounded-sm overflow-hidden" title={`${variants.length} / ${total}`}>
          <div className="h-full rounded-sm" style={{ width: `${Math.max(fraction * 100, 4)}%`, backgroundColor: barColor }} />
        </div>
        <span className="text-[8px] text-gray-500 tabular-nums w-4 text-right">{variants.length}</span>
      </div>
      {expanded && (
        <div className="ml-3 pl-1.5 border-l border-gray-200 mt-0.5 mb-0.5 max-h-44 overflow-y-auto no-scrollbar">
          {/* Literature entries -- amber left border */}
          {litEntries.map((v, i) => {
            const detail = [v.species, v.tubulin_type].filter(Boolean).join(' / ');
            return (
              <div key={`lit-${i}`} className="pl-1.5 py-0.5 my-px border-l-2 border-amber-300 bg-amber-50/40 rounded-r text-[8px]">
                <div className="flex items-center gap-1">
                  <span className="text-amber-800 font-medium">{detail || 'Literature'}</span>
                  {v.reference_link && (
                    <a href={v.reference_link} target="_blank" rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline break-all ml-auto" onClick={e => e.stopPropagation()}>
                      {v.reference_link}
                    </a>
                  )}
                </div>
                {v.phenotype && (
                  <div className="text-[7px] text-amber-600/70 mt-px leading-snug">{v.phenotype}</div>
                )}
                {v.reference && (
                  <div className="text-[7px] text-gray-400 italic mt-px leading-snug">{v.reference}</div>
                )}
              </div>
            );
          })}
          {/* Structural entries -- single line each with species and always-visible Align button */}
          {structEntries.map((v, i) => {
            const org = v.rcsb_id && organismMap ? organismMap[v.rcsb_id]?.[0] ?? null : null;
            return (
              <div key={`str-${i}`} className="flex items-center gap-1 text-[8px] text-gray-500 py-px">
                <span className="font-mono text-gray-600">{v.rcsb_id ?? '?'}:{v.entity_id ?? '?'}</span>
                {org && <span className="text-gray-400 italic flex-1">{org}</span>}
                {onAlignChain && v.rcsb_id && v.entity_id && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onAlignChain(v.rcsb_id!, v.entity_id!); }}
                    className="ml-auto inline-flex items-center gap-0.5 px-1.5 py-0 rounded border border-blue-300 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 hover:border-blue-400 transition-colors text-[8px] font-medium leading-[1.35]"
                    title={`Align ${v.rcsb_id}:${v.entity_id} as a new polymer`}
                  >
                    <Plus size={8} strokeWidth={2.5} />
                    <span>Align</span>
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

// ── Modification type row: collapsed → per-species rollup → per-record table ──

function ModificationTypeRow({
  type, mods, total,
}: {
  type: string;
  mods: ModificationAnnotation[];
  total: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [openSpecies, setOpenSpecies] = useState<Record<string, boolean>>({});

  const color = MODIFICATION_COLORS[type] ?? '#9ca3af';
  const fraction = total > 0 ? mods.length / total : 0;

  // Group records by species (unknown species collapsed under "—")
  const speciesGroups: Record<string, ModificationAnnotation[]> = {};
  for (const m of mods) {
    const key = m.species ?? '—';
    if (!speciesGroups[key]) speciesGroups[key] = [];
    speciesGroups[key].push(m);
  }
  const orderedSpecies = Object.entries(speciesGroups).sort((a, b) => b[1].length - a[1].length);

  return (
    <div>
      <div
        className="flex items-center gap-1 text-[9px] cursor-pointer hover:bg-gray-50 rounded px-0.5 py-px"
        onClick={() => setExpanded(e => !e)}
      >
        <span className="text-gray-400 w-2 text-center flex-shrink-0">{expanded ? '▾' : '▸'}</span>
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
        <span className="text-gray-700 font-medium">
          {type.charAt(0).toUpperCase() + type.slice(1)}
        </span>
        <div className="flex-1 h-1.5 bg-gray-100 rounded-sm overflow-hidden" title={`${mods.length} / ${total}`}>
          <div className="h-full rounded-sm" style={{ width: `${Math.max(fraction * 100, 4)}%`, backgroundColor: color }} />
        </div>
        <span className="text-[8px] text-gray-500 tabular-nums w-4 text-right">{mods.length}</span>
      </div>

      {expanded && (
        <div className="ml-3 pl-1.5 border-l border-gray-200 mt-0.5 mb-0.5">
          {orderedSpecies.map(([species, records]) => {
            const isOpen = !!openSpecies[species];
            return (
              <div key={species}>
                <div
                  className="flex items-center gap-1 text-[9px] cursor-pointer hover:bg-gray-50 rounded px-0.5 py-px"
                  onClick={() => setOpenSpecies(prev => ({ ...prev, [species]: !prev[species] }))}
                >
                  <span className="text-gray-400 w-2 text-center">{isOpen ? '▾' : '▸'}</span>
                  <span className="italic text-gray-700">{species}</span>
                  <span className="text-[8px] text-gray-400 tabular-nums">×{records.length}</span>
                </div>

                {isOpen && (
                  <div className="mt-0.5 mb-0.5 overflow-x-auto no-scrollbar">
                    <table className="text-[8px] border-collapse">
                      <thead>
                        <tr className="text-gray-400">
                          <th className="text-left font-medium px-0.5 py-px border-b border-gray-100 whitespace-nowrap">Isotype</th>
                          <th className="text-left font-medium px-0.5 py-px border-b border-gray-100 whitespace-nowrap">Phenotype</th>
                          <th className="text-left font-medium px-0.5 py-px border-b border-gray-100 whitespace-nowrap">UniProt</th>
                          <th className="text-left font-medium px-0.5 py-px border-b border-gray-100 whitespace-nowrap">Source</th>
                          <th className="text-left font-medium px-0.5 py-px border-b border-gray-100 whitespace-nowrap">Keywords</th>
                          <th className="text-left font-medium px-0.5 py-px border-b border-gray-100 whitespace-nowrap">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {records.map((r, i) => {
                          const sourceLabel = r.database_source || r.database_link;
                          return (
                            <tr key={i} className="text-gray-600 hover:bg-gray-50 align-top">
                              <td className="px-0.5 py-px border-b border-gray-50 font-mono whitespace-nowrap">{r.tubulin_type || <span className="text-gray-300">—</span>}</td>
                              <td className="px-0.5 py-px border-b border-gray-50 whitespace-nowrap">{r.phenotype || <span className="text-gray-300">—</span>}</td>
                              <td className="px-0.5 py-px border-b border-gray-50 font-mono whitespace-nowrap">{r.uniprot_id || <span className="text-gray-300">—</span>}</td>
                              <td className="px-0.5 py-px border-b border-gray-50 whitespace-nowrap">
                                {r.database_link ? (
                                  <a
                                    href={r.database_link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={e => e.stopPropagation()}
                                    className="text-blue-600 hover:text-blue-800 underline inline-flex items-center gap-0.5"
                                  >
                                    <span>{sourceLabel}</span>
                                    <ExternalLink size={7} className="flex-shrink-0" />
                                  </a>
                                ) : (
                                  sourceLabel || <span className="text-gray-300">—</span>
                                )}
                              </td>
                              <td className="px-0.5 py-px border-b border-gray-50 whitespace-nowrap">{r.keywords || <span className="text-gray-300">—</span>}</td>
                              <td className="px-0.5 py-px border-b border-gray-50 whitespace-nowrap">{r.notes || <span className="text-gray-300">—</span>}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Track hit row: surfaces user-added annotation tracks matching this position ──

function TrackHitRow({
  hit,
}: {
  hit: { entry: TrackEntry; position: NonNullable<TrackEntry['resolved']>[number]; color: string };
}) {
  const [expanded, setExpanded] = useState(false);
  const dispatch = useAppDispatch();
  const { entry, position, color } = hit;
  const recordCount = position.matched_records.length;

  // Clear the MSA header emphasis if the popup closes while hovered.
  useEffect(() => () => { dispatch(setHoveredTrack(null)); }, [dispatch]);

  // Pull a few common keys for terse one-line display. matched_records may be
  // variants, modifications, or binding contacts depending on track kind, so
  // we read whichever fields are present rather than assuming a schema.
  const summarize = (rec: Record<string, any>): string => {
    const path = rec.wild_type && rec.observed ? `${rec.wild_type}→${rec.observed}` : null;
    const mod = rec.modification_type;
    const phen = rec.phenotype;
    const src = rec.source;
    const sp = rec.species;
    return [path, mod, sp, phen, src].filter(Boolean).join(' / ') || JSON.stringify(rec).slice(0, 80);
  };

  return (
    <div>
      <div
        className="flex items-center gap-1 text-[9px] cursor-pointer hover:bg-gray-50 rounded px-0.5 py-px"
        onClick={() => setExpanded(e => !e)}
        onMouseEnter={() => dispatch(setHoveredTrack(entry.spec.id))}
        onMouseLeave={() => dispatch(setHoveredTrack(null))}
      >
        <span className="text-gray-400 w-2 text-center flex-shrink-0">{expanded ? '▾' : '▸'}</span>
        <span className="w-1.5 h-1.5 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
        <span className="text-gray-700 font-medium truncate" title={entry.spec.label}>
          {entry.spec.label}
        </span>
        <span className="text-[8px] text-gray-400 tabular-nums ml-auto">×{recordCount}</span>
      </div>
      {expanded && (
        <div className="ml-3 pl-1.5 border-l border-gray-200 mt-0.5 mb-0.5 max-h-32 overflow-y-auto no-scrollbar">
          {position.matched_records.map((rec, i) => (
            <div key={i} className="text-[8px] text-gray-500 py-px leading-snug break-all">
              {summarize(rec)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Anchored popup (3D-tracked with connector line) ──────────

const ANCHOR_OFFSET = { x: 120, y: -80 };
const POPUP_HEIGHT_ESTIMATE = 200; // rough height for collision stacking

function AnchoredPopup({
  target,
  instance,
  onClose,
  onFocusResidue,
  onToggleBallStick,
  ballStickActive,
  onAlignChain,
  onHoverResidue,
  stackIndex = 0,
}: {
  target: ResiduePopupTarget & { anchor: { mode: 'anchored'; position3d: [number, number, number] } };
  instance: MolstarInstance | null;
  onClose: () => void;
  onFocusResidue?: (target: ResiduePopupTarget) => void;
  onToggleBallStick?: () => void;
  ballStickActive?: boolean;
  onAlignChain?: (pdbId: string, chainId: string) => void;
  onHoverResidue?: (target: ResiduePopupTarget, enter: boolean) => void;
  stackIndex?: number;
}) {
  const [screenPos, setScreenPos] = useState<{ x: number; y: number } | null>(null);
  const pos3dRef = useRef(target.anchor.position3d);
  pos3dRef.current = target.anchor.position3d;

  const project = useCallback(() => {
    const pos3d = pos3dRef.current;
    if (!pos3d || !instance?.viewer) return;
    const projected = instance.viewer.projectToScreen(pos3d);
    if (projected) setScreenPos(projected);
  }, [instance]);

  useEffect(() => {
    if (!instance?.viewer) { setScreenPos(null); return; }
    project();
    const unsubscribe = instance.viewer.subscribeToDidDraw(project);
    return unsubscribe;
  }, [instance, project]);

  // Compute initial popup position from projected 3D anchor
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1920;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 900;
  const anchorX = screenPos?.x ?? 0;
  const anchorY = screenPos?.y ?? 0;
  const flipX = anchorX + ANCHOR_OFFSET.x + 220 > vw;
  const autoX = flipX ? anchorX - ANCHOR_OFFSET.x - 220 : anchorX + ANCHOR_OFFSET.x;
  const autoY = Math.max(8, Math.min(anchorY + ANCHOR_OFFSET.y + stackIndex * POPUP_HEIGHT_ESTIMATE, vh - 200));

  const { pos: popupPos, onMouseDown, userDragged } = useDrag({ x: autoX, y: autoY });

  if (!screenPos) return null;

  // Connector line: from 3D anchor to popup edge
  const connectorEnd = {
    x: popupPos.x < anchorX ? popupPos.x + 220 : popupPos.x,
    y: popupPos.y + 20,
  };

  return (
    <>
      <svg className="fixed inset-0 z-[9998] pointer-events-none" style={{ width: '100vw', height: '100vh' }}>
        <line
          x1={anchorX} y1={anchorY}
          x2={connectorEnd.x} y2={connectorEnd.y}
          stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="4 3" opacity={0.7}
        />
        <circle cx={anchorX} cy={anchorY} r={4} fill="#3b82f6" opacity={0.8} />
      </svg>
      <div
        className="fixed z-[9999] bg-white/80 backdrop-blur border border-slate-200/60 rounded-lg shadow-lg min-w-[220px] text-sm"
        style={{ top: popupPos.y, left: popupPos.x }}
        onMouseEnter={() => onHoverResidue?.(target, true)}
        onMouseLeave={() => onHoverResidue?.(target, false)}
      >
        <ResiduePopupContent
          target={target}
          onClose={onClose}
          onFocus={onFocusResidue ? () => onFocusResidue(target) : undefined}
          onToggleBallStick={onToggleBallStick}
          ballStickActive={ballStickActive}
          onAlignChain={onAlignChain}
          onMouseDownHeader={onMouseDown}
        />
      </div>
    </>
  );
}

// ── Static popup (screen-positioned, no 3D tracking) ─────────

export function StaticPopup({
  target,
  onClose,
  onFocusResidue,
  onToggleBallStick,
  ballStickActive,
  onAlignChain,
  onHoverResidue,
  stackIndex = 0,
}: {
  target: ResiduePopupTarget & { anchor: { mode: 'static'; screenX: number; screenY: number } };
  onClose: () => void;
  onFocusResidue?: (target: ResiduePopupTarget) => void;
  onToggleBallStick?: () => void;
  ballStickActive?: boolean;
  onAlignChain?: (pdbId: string, chainId: string) => void;
  onHoverResidue?: (target: ResiduePopupTarget, enter: boolean) => void;
  stackIndex?: number;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  const initX = Math.min(target.anchor.screenX, (typeof window !== 'undefined' ? window.innerWidth : 1920) - 230);
  const initY = Math.min(target.anchor.screenY + stackIndex * POPUP_HEIGHT_ESTIMATE, (typeof window !== 'undefined' ? window.innerHeight : 900) - 200);
  const { pos, onMouseDown } = useDrag({ x: initX, y: initY });

  return (
    <div
      ref={menuRef}
      className="fixed z-[9999] bg-white/80 backdrop-blur border border-slate-200/60 rounded-lg shadow-lg min-w-[220px] text-sm"
      style={{ top: pos.y, left: pos.x }}
      onMouseEnter={() => onHoverResidue?.(target, true)}
      onMouseLeave={() => onHoverResidue?.(target, false)}
    >
      <ResiduePopupContent
        target={target}
        onClose={onClose}
        onFocus={onFocusResidue ? () => onFocusResidue(target) : undefined}
        onToggleBallStick={onToggleBallStick}
        ballStickActive={ballStickActive}
        onAlignChain={onAlignChain}
        onMouseDownHeader={onMouseDown}
      />
    </div>
  );
}

// ── Public component: renders one popup (dispatches by mode) ─

interface ResiduePopupProps {
  target: ResiduePopupTarget;
  instance: MolstarInstance | null;
  onClose: () => void;
  onFocusResidue?: (target: ResiduePopupTarget) => void;
  onAlignChain?: (pdbId: string, chainId: string) => void;
  onHoverResidue?: (target: ResiduePopupTarget, enter: boolean) => void;
  stackIndex?: number;
}

function ResiduePopupSingle({ target, instance, onClose, onFocusResidue, onAlignChain, onHoverResidue, stackIndex = 0 }: ResiduePopupProps) {
  const [ballStickActive, setBallStickActive] = useState(false);
  const cleanupRef = useRef<(() => Promise<void>) | null>(null);

  // Cleanup ball-and-stick on unmount (popup close)
  useEffect(() => {
    return () => { cleanupRef.current?.(); };
  }, []);

  const handleToggleBallStick = useCallback(async () => {
    if (ballStickActive) {
      await cleanupRef.current?.();
      cleanupRef.current = null;
      setBallStickActive(false);
    } else if (instance && target.chainId && target.authSeqId !== undefined) {
      const cleanup = await instance.addTemporaryResidueRepr(target.chainId, target.authSeqId, target.pdbId);
      if (cleanup) {
        cleanupRef.current = cleanup;
        setBallStickActive(true);
      }
    }
  }, [ballStickActive, instance, target.chainId, target.authSeqId]);

  const popupProps = {
    onClose,
    onFocusResidue,
    onToggleBallStick: (instance && target.chainId && target.authSeqId !== undefined) ? handleToggleBallStick : undefined,
    ballStickActive,
    onAlignChain,
    onHoverResidue,
    stackIndex,
  };

  if (target.anchor.mode === 'anchored') {
    return <AnchoredPopup target={target as any} instance={instance} {...popupProps} />;
  }
  return <StaticPopup target={target as any} {...popupProps} />;
}

// ── Multi-popup layer: renders all active popups via portal ──

interface ResiduePopupLayerProps {
  popups: ResiduePopupTarget[];
  instance: MolstarInstance | null;
  onClose: (id: string) => void;
  onCloseAll: () => void;
  onFocusResidue?: (target: ResiduePopupTarget) => void;
  onAlignChain?: (pdbId: string, chainId: string) => void;
  onHoverResidue?: (target: ResiduePopupTarget, enter: boolean) => void;
}

export function ResiduePopupLayer({ popups, instance, onClose, onCloseAll, onFocusResidue, onAlignChain, onHoverResidue }: ResiduePopupLayerProps) {
  useEffect(() => {
    if (popups.length === 0) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseAll();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [popups.length, onCloseAll]);

  if (popups.length === 0) return null;

  return createPortal(
    <>
      {popups.map((target, i) => (
        <ResiduePopupSingle
          key={target.id}
          target={target}
          instance={instance}
          onClose={() => onClose(target.id)}
          onFocusResidue={onFocusResidue}
          onAlignChain={onAlignChain}
          onHoverResidue={onHoverResidue}
          stackIndex={i}
        />
      ))}
    </>,
    document.body
  );
}
