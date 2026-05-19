'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, GripHorizontal } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/store';
import {
  selectChainEntry,
  toggleModificationType,
  setSpeciesForChain,
} from '@/store/slices/annotationsSlice';
import { resolveModificationColor } from '@/lib/colors/annotationPaletteResolve';
import { selectModificationOverrides } from '@/store/slices/colorOverridesSlice';

interface Props {
  chainKey: string;
}

// Preconfigured species groups (NCBI species-level taxids).
const SPECIES_GROUPS: Record<string, { label: string; taxIds: number[] }> = {
  mammals: {
    label: 'Mammals',
    taxIds: [9606, 10090, 10116, 9913, 10029, 9823],     // Hs, Mm, Rn, Bt, Cg, Ss
  },
  protists: {
    label: 'Protists / Parasites',
    taxIds: [5811, 5691, 5664, 5833, 5741, 44689],       // Tg, Tb, Lm, Pf, Gi, Dd
  },
};

const PANEL_W = 480;
const PANEL_VIEWPORT_PAD = 8;

export function PerChainPtmDropdown({ chainKey }: Props) {
  const dispatch = useAppDispatch();
  const entry = useAppSelector(s => selectChainEntry(s, chainKey));
  const modOverrides = useAppSelector(selectModificationOverrides);

  const [open, setOpen] = useState(false);
  // Position of the panel (viewport coords). Set on open, then can be moved by drag.
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  // Drag state -- live in refs to avoid re-rendering during mousemove.
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  const data = entry?.data ?? null;
  const visibility = entry?.visibility ?? null;
  const chainTaxId = data?.taxId ?? null;
  const includedTaxIds = useMemo(
    () => visibility?.includedSpeciesTaxIds ?? [],
    [visibility?.includedSpeciesTaxIds],
  );
  const includedSet = useMemo(() => new Set(includedTaxIds), [includedTaxIds]);

  // Order pills so the chain's own species is always first, followed by the rest
  // in insertion order (keeps the visual anchor while letting the user manage the rest).
  const orderedIncluded = useMemo(() => {
    if (chainTaxId == null || !includedSet.has(chainTaxId)) return includedTaxIds;
    return [chainTaxId, ...includedTaxIds.filter(t => t !== chainTaxId)];
  }, [includedTaxIds, includedSet, chainTaxId]);

  const speciesPool = useMemo(() => {
    if (!data) return [] as Array<{ taxId: number; name: string }>;
    const seen = new Map<number, string>();
    for (const m of data.modifications) {
      if (m.taxId == null) continue;
      if (!seen.has(m.taxId)) {
        seen.set(m.taxId, m.speciesFullName ?? m.species ?? `taxid ${m.taxId}`);
      }
    }
    return Array.from(seen.entries())
      .map(([taxId, name]) => ({ taxId, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  const taxIdToName = useMemo(() => {
    const m = new Map<number, string>();
    for (const s of speciesPool) m.set(s.taxId, s.name);
    if (chainTaxId != null && !m.has(chainTaxId) && data?.speciesFullName) {
      m.set(chainTaxId, data.speciesFullName);
    }
    return m;
  }, [speciesPool, chainTaxId, data?.speciesFullName]);

  const typeGroups = useMemo(() => {
    if (!data || includedSet.size === 0) return [] as Array<[string, number]>;
    const counts: Record<string, number> = {};
    for (const m of data.modifications) {
      if (m.taxId == null || !includedSet.has(m.taxId)) continue;
      counts[m.modificationType] = (counts[m.modificationType] ?? 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [data, includedSet]);

  const visibleSet = useMemo(
    () => new Set(visibility?.visibleModificationTypes ?? []),
    [visibility?.visibleModificationTypes],
  );
  const enabledCount = typeGroups.filter(([t]) => visibleSet.has(t)).length;

  const availableSpecies = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return speciesPool.filter(s => {
      if (includedSet.has(s.taxId)) return false;
      if (!q) return true;
      return s.name.toLowerCase().includes(q);
    });
  }, [speciesPool, includedSet, searchQuery]);

  const speciesLabel = chainTaxId != null
    ? (data?.speciesFullName ?? `taxid ${chainTaxId}`)
    : 'this chain';

  // Split type list across two columns for the wider layout.
  const typeColumns = useMemo(() => {
    const left: Array<[string, number]> = [];
    const right: Array<[string, number]> = [];
    typeGroups.forEach((t, i) => (i % 2 === 0 ? left : right).push(t));
    return { left, right };
  }, [typeGroups]);

  // ── Mutations ──
  const setSpecies = (next: number[]) =>
    dispatch(setSpeciesForChain({ chainKey, taxIds: next }));
  const removeSpecies = (taxId: number) =>
    setSpecies(includedTaxIds.filter(t => t !== taxId));
  const addSpecies = (taxId: number) => {
    if (includedSet.has(taxId)) return;
    setSpecies([...includedTaxIds, taxId]);
  };
  const toggleGroup = (groupKey: keyof typeof SPECIES_GROUPS) => {
    const groupIds = SPECIES_GROUPS[groupKey].taxIds;
    const allIn = groupIds.every(t => includedSet.has(t));
    if (allIn) {
      setSpecies(includedTaxIds.filter(t => !groupIds.includes(t)));
    } else {
      const merged = [...includedTaxIds];
      for (const t of groupIds) if (!includedSet.has(t)) merged.push(t);
      setSpecies(merged);
    }
  };

  // ── Position + viewport clamping ──
  const clamp = (top: number, left: number, height = 0): { top: number; left: number } => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const maxLeft = vw - PANEL_W - PANEL_VIEWPORT_PAD;
    const maxTop = vh - (height || 240) - PANEL_VIEWPORT_PAD;
    return {
      top: Math.max(PANEL_VIEWPORT_PAD, Math.min(top, maxTop)),
      left: Math.max(PANEL_VIEWPORT_PAD, Math.min(left, maxLeft)),
    };
  };

  const handleOpen = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (open) { setOpen(false); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    // Initial position: just below the trigger, clamped to viewport.
    // Use a generous height estimate so the panel doesn't open clipped.
    setPos(clamp(rect.bottom + 4, rect.left, 280));
    setOpen(true);
    setSearchQuery('');
  };

  // Dismiss on outside click / ESC.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t)) return;
      if (triggerRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // ── Drag handle ──
  useEffect(() => {
    if (!open) return;
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      e.preventDefault();
      const height = panelRef.current?.offsetHeight ?? 240;
      setPos(clamp(e.clientY - d.dy, e.clientX - d.dx, height));
    };
    const onUp = () => { dragRef.current = null; };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [open]);

  const startDrag = (e: React.MouseEvent) => {
    if (!pos) return;
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { dx: e.clientX - pos.left, dy: e.clientY - pos.top };
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onMouseDown={e => e.stopPropagation()}
        onClick={handleOpen}
        title={`PTMs for ${speciesLabel}${enabledCount > 0 ? ` (${enabledCount} on)` : ''}`}
        style={{ position: 'relative', zIndex: 5 }}
        className={`
          flex-shrink-0 h-4 px-1 inline-flex items-center gap-0.5
          text-[9px] leading-none rounded transition-colors cursor-pointer
          ${enabledCount > 0
            ? 'bg-green-100 text-green-700 hover:bg-green-200'
            : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'}
        `}
      >
        <span>PTMs</span>
        <span className="font-mono text-[11px] leading-none">+</span>
      </button>

      {open && pos && typeof document !== 'undefined' && createPortal(
        <div
          ref={panelRef}
          onClick={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}
          style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999, width: PANEL_W }}
          className="bg-white border border-gray-200 rounded shadow-lg text-[10px] select-none"
        >
          {/* Drag handle + header pills + close */}
          <div
            onMouseDown={startDrag}
            className="flex items-center gap-1.5 px-1.5 py-1 border-b border-gray-100 bg-gray-50 cursor-grab active:cursor-grabbing"
          >
            <GripHorizontal size={11} className="text-gray-300 flex-shrink-0" />
            <span className="text-[9px] uppercase tracking-wider text-gray-400 flex-shrink-0">PTMs for</span>
            <div className="flex flex-wrap gap-1 flex-1 min-w-0">
              {orderedIncluded.length === 0 ? (
                <span className="italic text-gray-400 text-[10px]">No species selected</span>
              ) : (
                orderedIncluded.map(tid => {
                  const isOwn = tid === chainTaxId;
                  return (
                    <span
                      key={tid}
                      className={`
                        inline-flex items-center gap-0.5 px-1 py-px rounded
                        border text-[9px] leading-none
                        ${isOwn
                          ? 'border-green-300 bg-green-50 text-green-700'
                          : 'border-gray-200 bg-white text-gray-700'}
                      `}
                      title={isOwn ? "This chain's source organism" : undefined}
                    >
                      {taxIdToName.get(tid) ?? `taxid ${tid}`}
                      <button
                        type="button"
                        onClick={() => removeSpecies(tid)}
                        className="ml-0.5 text-gray-300 hover:text-red-500"
                        title="Remove species"
                      >
                        <X size={9} />
                      </button>
                    </span>
                  );
                })
              )}
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex-shrink-0 w-4 h-4 inline-flex items-center justify-center rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100"
              title="Close"
            >
              <X size={10} />
            </button>
          </div>

          {/* Groups + search */}
          <div className="px-1.5 py-1 border-b border-gray-100 flex items-center gap-1.5">
            <div className="flex flex-wrap gap-1 flex-shrink-0">
              {(Object.keys(SPECIES_GROUPS) as Array<keyof typeof SPECIES_GROUPS>).map(key => {
                const g = SPECIES_GROUPS[key];
                const memberCount = g.taxIds.filter(t => includedSet.has(t)).length;
                const allIn = memberCount === g.taxIds.length;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleGroup(key)}
                    title={allIn ? `Remove all ${g.label.toLowerCase()}` : `Add all ${g.label.toLowerCase()}`}
                    className={`
                      px-1.5 py-px rounded border text-[9px] leading-tight transition-colors
                      ${allIn
                        ? 'bg-blue-100 border-blue-300 text-blue-700 hover:bg-blue-200'
                        : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'}
                    `}
                  >
                    {g.label}{memCountLabel(memberCount, g.taxIds.length)}
                  </button>
                );
              })}
            </div>
            <div className="flex-1 min-w-0 relative">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onMouseDown={e => e.stopPropagation()}
                placeholder="Add species…"
                className="w-full px-1.5 py-0.5 border border-gray-200 rounded text-[10px] focus:outline-none focus:border-gray-400"
              />
              {searchQuery.trim() !== '' && (
                <div className="absolute left-0 right-0 top-full mt-px max-h-[140px] overflow-y-auto bg-white border border-gray-200 rounded shadow-sm z-10">
                  {availableSpecies.length === 0 ? (
                    <div className="px-1.5 py-1 text-[9px] text-gray-400 italic">No matches</div>
                  ) : (
                    availableSpecies.slice(0, 50).map(s => (
                      <button
                        key={s.taxId}
                        type="button"
                        onClick={() => { addSpecies(s.taxId); setSearchQuery(''); }}
                        className="block w-full text-left px-1.5 py-0.5 text-[10px] text-gray-700 hover:bg-gray-50"
                      >
                        {s.name}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Aggregated PTM type list (two columns) */}
          {typeGroups.length > 0 ? (
            <div className="grid grid-cols-2 gap-x-2 px-1 py-1 max-h-[220px] overflow-y-auto">
              {[typeColumns.left, typeColumns.right].map((col, ci) => (
                <div key={ci} className="flex flex-col">
                  {col.map(([modType, count]) => {
                    const color = resolveModificationColor(modOverrides, modType);
                    const isVisible = visibleSet.has(modType);
                    return (
                      <label
                        key={modType}
                        className="flex items-center gap-1.5 px-1 py-0.5 hover:bg-gray-50 cursor-pointer rounded"
                      >
                        <input
                          type="checkbox"
                          checked={isVisible}
                          onChange={() => dispatch(toggleModificationType({ chainKey, modType }))}
                          className="w-3 h-3 rounded"
                          style={{ accentColor: color }}
                        />
                        <span
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-[10px] text-gray-700 flex-1 truncate">
                          {modType.charAt(0).toUpperCase() + modType.slice(1)}
                        </span>
                        <span className="text-[9px] text-gray-400 tabular-nums">{count}</span>
                      </label>
                    );
                  })}
                </div>
              ))}
            </div>
          ) : (
            <div className="px-1.5 py-2 text-[9px] text-gray-400 italic leading-snug">
              {!data
                ? 'Loading annotations…'
                : includedTaxIds.length === 0
                  ? 'Pick a species above (or a group) to surface PTMs.'
                  : `No PTMs reported for ${speciesLabel} in the Morisette dataset. Try selecting adjacent species above.`}
            </div>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}

function memCountLabel(n: number, total: number): string {
  if (n === 0) return '';
  return n === total ? ' ✓' : ` (${n}/${total})`;
}
