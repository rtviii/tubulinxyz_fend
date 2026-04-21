'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, ExternalLink, Crosshair, Plus } from 'lucide-react';
import { useGetVariantsAtPositionQuery, useGetModificationsAtPositionQuery } from '@/store/tubxz_api';
import type { VariantAnnotation, ModificationAnnotation } from '@/store/tubxz_api';
import { MODIFICATION_COLORS, VARIANT_COLORS } from '@/lib/colors/annotationPalette';
import { useOrganismMap } from '@/services/organism_map';
import type { MolstarInstance } from '@/components/molstar/services/MolstarInstance';
import type { ResiduePopupTarget } from './types';

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

function ResiduePopupContent({ target, onClose, onFocus, onToggleBallStick, ballStickActive, onAlignChain, onMouseDownHeader }: {
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
  const nonSubs = allVariants.filter(v => v.type !== 'substitution');

  // Group modifications by type
  const modsByType: Record<string, ModificationAnnotation[]> = {};
  for (const m of modifications) {
    if (!modsByType[m.modification_type]) modsByType[m.modification_type] = [];
    modsByType[m.modification_type].push(m);
  }

  // Section-level collapsible state — default: all expanded
  const [subsOpen, setSubsOpen] = useState(true);
  const [delInsOpen, setDelInsOpen] = useState(true);
  const [modsOpen, setModsOpen] = useState(true);

  // Stop drag from being initiated when interacting with header buttons
  const stopDrag = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <>
      {/* Title bar: the whole header is the drag handle (OS-window style) */}
      <div
        className="flex items-center gap-1.5 px-2 py-1.5 border-b border-gray-200 bg-gray-50/80 rounded-t-lg cursor-grab active:cursor-grabbing select-none"
        onMouseDown={onMouseDownHeader}
      >
        <span className="font-mono font-bold text-gray-900 text-sm">
          {target.residueLetter}
          {target.authSeqId !== undefined ? target.authSeqId : ''}
        </span>
        <span className="text-[10px] text-gray-500">{target.label}</span>
        <span className="text-[9px] text-gray-400">col {target.masterIndex}</span>
        <div className="flex-1" />
        <div className="flex items-center gap-0.5" onMouseDown={stopDrag}>
          {onFocus && (
            <button
              onClick={onFocus}
              onMouseDown={stopDrag}
              className="p-0.5 rounded hover:bg-gray-200 text-gray-400 hover:text-blue-500 transition-colors"
              title="Focus residue"
            >
              <Crosshair size={13} />
            </button>
          )}
          {onToggleBallStick && target.authSeqId !== undefined && (
            <button
              onClick={onToggleBallStick}
              onMouseDown={stopDrag}
              className={`p-0.5 rounded transition-colors ${ballStickActive ? 'bg-amber-100 text-amber-600' : 'hover:bg-gray-200 text-gray-400 hover:text-amber-500'}`}
              title={ballStickActive ? 'Hide ball-and-stick' : 'Show ball-and-stick'}
            >
              <img src="/landing/ligand_icon.svg" alt="ligand" className={`w-[13px] h-[13px] ${ballStickActive ? 'opacity-80' : 'opacity-40 hover:opacity-80'}`} />
            </button>
          )}
          <button
            onClick={onClose}
            onMouseDown={stopDrag}
            className="p-0.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      <div className="px-2 py-1 max-h-[400px] overflow-y-auto" style={{ minWidth: 280 }}>
        {!hasFamily && (
          <div className="text-[10px] text-gray-400 italic">No family data available</div>
        )}

        {isLoading && (
          <div className="flex items-center gap-2 py-2">
            <div className="animate-spin h-3 w-3 border border-gray-300 border-t-transparent rounded-full" />
            <span className="text-[10px] text-gray-400">Loading...</span>
          </div>
        )}

        {!isLoading && hasFamily && (
          <>
            {/* Unified substitutions -- all sources merged by path */}
            {subPathGroups.length > 0 && (
              <div className="mb-1">
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

            {/* Non-substitution variants (del/ins) */}
            {nonSubs.length > 0 && (
              <div className="mb-1">
                <SectionHeader
                  label="Del/Ins"
                  count={nonSubs.length}
                  open={delInsOpen}
                  onToggle={() => setDelInsOpen(o => !o)}
                />
                {delInsOpen && (
                  <div className="border border-gray-100 rounded bg-gray-50/50">
                    {nonSubs.map((v, i) => {
                      const color = VARIANT_COLORS[v.type as keyof typeof VARIANT_COLORS] ?? '#9ca3af';
                      const org = v.source === 'structural' && v.rcsb_id && organismMap
                        ? organismMap[v.rcsb_id]?.[0] : v.species;
                      return (
                        <div key={i} className="flex items-center gap-1.5 px-1.5 py-0.5 text-[10px] border-b border-gray-50 last:border-b-0">
                          <span className="text-[8px] px-1 py-px rounded font-semibold text-white" style={{ backgroundColor: color }}>
                            {v.type.slice(0, 3).toUpperCase()}
                          </span>
                          {v.rcsb_id && <span className="font-mono text-gray-600">{v.rcsb_id}:{v.entity_id ?? '?'}</span>}
                          {org && <span className="text-gray-400">{org}</span>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Modifications grouped by type */}
            {Object.keys(modsByType).length > 0 && (
              <div className="mb-1">
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

            {/* Empty state */}
            {allVariants.length === 0 && modifications.length === 0 && (
              <div className="text-[10px] text-gray-400 py-1">No annotations at this position</div>
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
      className="flex items-center gap-1 px-0.5 py-0.5 mb-0.5 cursor-pointer rounded hover:bg-gray-100 select-none"
      onClick={onToggle}
    >
      <span className="text-[9px] text-gray-500 w-2 text-center leading-none">{open ? '▾' : '▸'}</span>
      <span className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider">
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
        className="flex items-center gap-1 text-[10px] cursor-pointer hover:bg-gray-50 rounded px-0.5 py-0.5"
        onClick={() => setExpanded(e => !e)}
      >
        <span className="text-gray-400 w-2 text-center flex-shrink-0">{expanded ? '▾' : '▸'}</span>
        <span className="font-mono font-semibold text-gray-700 w-9 flex-shrink-0">{path}</span>
        <div className="flex-1 h-2 bg-gray-100 rounded-sm overflow-hidden" title={`${variants.length} / ${total}`}>
          <div className="h-full rounded-sm" style={{ width: `${Math.max(fraction * 100, 4)}%`, backgroundColor: barColor }} />
        </div>
        <span className="text-[9px] text-gray-500 tabular-nums w-5 text-right">{variants.length}</span>
      </div>
      {expanded && (
        <div className="ml-3 pl-2 border-l border-gray-200 mt-0.5 mb-1 max-h-52 overflow-y-auto">
          {/* Literature entries -- amber left border, breathing room */}
          {litEntries.map((v, i) => {
            const detail = [v.species, v.tubulin_type].filter(Boolean).join(' / ');
            return (
              <div key={`lit-${i}`} className="pl-2 py-1 my-0.5 border-l-2 border-amber-300 bg-amber-50/40 rounded-r text-[9px]">
                <div className="flex items-center gap-1.5">
                  <span className="text-amber-800 font-medium">{detail || 'Literature'}</span>
                  {v.reference_link && (
                    <a href={v.reference_link} target="_blank" rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline break-all ml-auto" onClick={e => e.stopPropagation()}>
                      {v.reference_link}
                    </a>
                  )}
                </div>
                {v.phenotype && (
                  <div className="text-[8px] text-amber-600/70 mt-0.5 leading-snug">{v.phenotype}</div>
                )}
                {v.reference && (
                  <div className="text-[8px] text-gray-400 italic mt-0.5 leading-snug">{v.reference}</div>
                )}
              </div>
            );
          })}
          {/* Structural entries -- single line each with species and always-visible Align button */}
          {structEntries.map((v, i) => {
            const org = v.rcsb_id && organismMap ? organismMap[v.rcsb_id]?.[0] ?? null : null;
            return (
              <div key={`str-${i}`} className="flex items-center gap-1.5 text-[9px] text-gray-500 py-0.5">
                <span className="font-mono text-gray-600">{v.rcsb_id ?? '?'}:{v.entity_id ?? '?'}</span>
                {org && <span className="text-gray-400 italic flex-1">{org}</span>}
                {onAlignChain && v.rcsb_id && v.entity_id && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onAlignChain(v.rcsb_id!, v.entity_id!); }}
                    className="ml-auto inline-flex items-center gap-0.5 px-2 py-0 rounded border border-blue-300 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 hover:border-blue-400 transition-colors text-[9px] font-medium leading-[1.35]"
                    title={`Align ${v.rcsb_id}:${v.entity_id} as a new polymer`}
                  >
                    <Plus size={9} strokeWidth={2.5} />
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
        className="flex items-center gap-1 text-[10px] cursor-pointer hover:bg-gray-50 rounded px-0.5 py-0.5"
        onClick={() => setExpanded(e => !e)}
      >
        <span className="text-gray-400 w-2 text-center flex-shrink-0">{expanded ? '▾' : '▸'}</span>
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
        <span className="text-gray-700 font-medium">
          {type.charAt(0).toUpperCase() + type.slice(1)}
        </span>
        <div className="flex-1 h-2 bg-gray-100 rounded-sm overflow-hidden" title={`${mods.length} / ${total}`}>
          <div className="h-full rounded-sm" style={{ width: `${Math.max(fraction * 100, 4)}%`, backgroundColor: color }} />
        </div>
        <span className="text-[9px] text-gray-500 tabular-nums w-5 text-right">{mods.length}</span>
      </div>

      {expanded && (
        <div className="ml-3 pl-2 border-l border-gray-200 mt-0.5 mb-1">
          {orderedSpecies.map(([species, records]) => {
            const isOpen = !!openSpecies[species];
            return (
              <div key={species}>
                <div
                  className="flex items-center gap-1 text-[10px] cursor-pointer hover:bg-gray-50 rounded px-0.5 py-0.5"
                  onClick={() => setOpenSpecies(prev => ({ ...prev, [species]: !prev[species] }))}
                >
                  <span className="text-gray-400 w-2 text-center">{isOpen ? '▾' : '▸'}</span>
                  <span className="italic text-gray-700">{species}</span>
                  <span className="text-[9px] text-gray-400 tabular-nums">×{records.length}</span>
                </div>

                {isOpen && (
                  <div className="mt-0.5 mb-1 overflow-x-auto">
                    <table className="text-[9px] border-collapse">
                      <thead>
                        <tr className="text-gray-400">
                          <th className="text-left font-medium px-1 py-0.5 border-b border-gray-100 whitespace-nowrap">Isotype</th>
                          <th className="text-left font-medium px-1 py-0.5 border-b border-gray-100 whitespace-nowrap">Phenotype</th>
                          <th className="text-left font-medium px-1 py-0.5 border-b border-gray-100 whitespace-nowrap">UniProt</th>
                          <th className="text-left font-medium px-1 py-0.5 border-b border-gray-100 whitespace-nowrap">Source</th>
                          <th className="text-left font-medium px-1 py-0.5 border-b border-gray-100 whitespace-nowrap">Keywords</th>
                          <th className="text-left font-medium px-1 py-0.5 border-b border-gray-100 whitespace-nowrap">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {records.map((r, i) => {
                          const sourceLabel = r.database_source || r.database_link;
                          return (
                            <tr key={i} className="text-gray-600 hover:bg-gray-50 align-top">
                              <td className="px-1 py-0.5 border-b border-gray-50 font-mono whitespace-nowrap">{r.tubulin_type || <span className="text-gray-300">—</span>}</td>
                              <td className="px-1 py-0.5 border-b border-gray-50 whitespace-nowrap">{r.phenotype || <span className="text-gray-300">—</span>}</td>
                              <td className="px-1 py-0.5 border-b border-gray-50 font-mono whitespace-nowrap">{r.uniprot_id || <span className="text-gray-300">—</span>}</td>
                              <td className="px-1 py-0.5 border-b border-gray-50 whitespace-nowrap">
                                {r.database_link ? (
                                  <a
                                    href={r.database_link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={e => e.stopPropagation()}
                                    className="text-blue-600 hover:text-blue-800 underline inline-flex items-center gap-0.5"
                                  >
                                    <span>{sourceLabel}</span>
                                    <ExternalLink size={8} className="flex-shrink-0" />
                                  </a>
                                ) : (
                                  sourceLabel || <span className="text-gray-300">—</span>
                                )}
                              </td>
                              <td className="px-1 py-0.5 border-b border-gray-50 whitespace-nowrap">{r.keywords || <span className="text-gray-300">—</span>}</td>
                              <td className="px-1 py-0.5 border-b border-gray-50 whitespace-nowrap">{r.notes || <span className="text-gray-300">—</span>}</td>
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
  stackIndex = 0,
}: {
  target: ResiduePopupTarget & { anchor: { mode: 'anchored'; position3d: [number, number, number] } };
  instance: MolstarInstance | null;
  onClose: () => void;
  onFocusResidue?: (target: ResiduePopupTarget) => void;
  onToggleBallStick?: () => void;
  ballStickActive?: boolean;
  onAlignChain?: (pdbId: string, chainId: string) => void;
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
        className="fixed z-[9999] bg-white/95 backdrop-blur-sm border border-gray-200 rounded-lg shadow-lg min-w-[220px] text-sm"
        style={{ top: popupPos.y, left: popupPos.x }}
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

function StaticPopup({
  target,
  onClose,
  onFocusResidue,
  onToggleBallStick,
  ballStickActive,
  onAlignChain,
  stackIndex = 0,
}: {
  target: ResiduePopupTarget & { anchor: { mode: 'static'; screenX: number; screenY: number } };
  onClose: () => void;
  onFocusResidue?: (target: ResiduePopupTarget) => void;
  onToggleBallStick?: () => void;
  ballStickActive?: boolean;
  onAlignChain?: (pdbId: string, chainId: string) => void;
  stackIndex?: number;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  const initX = Math.min(target.anchor.screenX, (typeof window !== 'undefined' ? window.innerWidth : 1920) - 230);
  const initY = Math.min(target.anchor.screenY + stackIndex * POPUP_HEIGHT_ESTIMATE, (typeof window !== 'undefined' ? window.innerHeight : 900) - 200);
  const { pos, onMouseDown } = useDrag({ x: initX, y: initY });

  return (
    <div
      ref={menuRef}
      className="fixed z-[9999] bg-white/95 backdrop-blur-sm border border-gray-200 rounded-lg shadow-lg min-w-[220px] text-sm"
      style={{ top: pos.y, left: pos.x }}
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
  stackIndex?: number;
}

function ResiduePopupSingle({ target, instance, onClose, onFocusResidue, onAlignChain, stackIndex = 0 }: ResiduePopupProps) {
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
}

export function ResiduePopupLayer({ popups, instance, onClose, onCloseAll, onFocusResidue, onAlignChain }: ResiduePopupLayerProps) {
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
          stackIndex={i}
        />
      ))}
    </>,
    document.body
  );
}
