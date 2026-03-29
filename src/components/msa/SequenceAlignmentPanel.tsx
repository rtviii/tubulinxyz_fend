// src/components/msa/SequenceAlignmentPanel.tsx
'use client';

import {
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { X } from 'lucide-react';
import { useAppSelector, useAppDispatch } from '@/store/store';
import { useGetMasterProfileQuery } from '@/store/tubxz_api';
import { useAutoAlignFromProfile } from '@/hooks/useChainAlignment';
import { useNightingaleComponents } from '@/hooks/useNightingaleComponents';
import { selectPositionMapping } from '@/store/slices/sequence_registry';
import { setHoveredChain } from '@/store/slices/chainFocusSlice';
import type { MsaSequence, PositionMapping } from '@/store/slices/sequence_registry';
import { getFamilyForChain, StructureProfile } from '@/lib/profile_utils';
import { formatFamilyShort } from '@/lib/formatters';
import { makeChainKey, authAsymIdFromChainKey } from '@/lib/chain_key';
import { ResizableMSAContainer, type ResizableMSAContainerHandle } from './ResizableMSAContainer';
import { MSAToolbar } from './MSAToolbar';
import type { MSAHandle } from './types';
import type { MolstarInstance } from '@/components/molstar/services/MolstarInstance';
import type { PolymerComponent, AlignedStructure } from '@/components/molstar/core/types';
import type { TubulinStructure, PolypeptideEntity, TubulinFamily } from '@/store/tubxz_api';

// ────────────────────────────────────────────
// Types
// ────────────────────────────────────────────

export interface ChainOption {
  chainId: string;
  family: string | undefined;
  familyLabel: string | undefined;
  organism: string | undefined;
  seqLength: number;
  uniprotId: string | undefined;
}

interface SelectedResidue {
  seqId: string;
  column: number;
  residueLetter: string;
  chainLabel: string;
  authSeqId: number;
}

interface SequenceAlignmentPanelProps {
  chainId: string;
  onChainChange: (chainId: string) => void;
  profile: StructureProfile | null;
  instance: MolstarInstance | null;
  polymerComponents: PolymerComponent[];
  pdbId: string | null;
  onClose: () => void;

  // Monomer-mode extras (optional)
  alignedStructures?: AlignedStructure[];
  onResidueHover?: (seqId: string, position: number) => void;
  onResidueLeave?: () => void;
  onChainRowMapChange?: (map: Record<string, { chainKey: string; displayRow: number }>) => void;
  onClearColors?: () => void;
  onWindowMaskChange?: (masterStart: number, masterEnd: number) => void;
  onWindowMaskClear?: () => void;
}

// ────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────

function buildChainOptions(
  profile: StructureProfile | null,
  polymerComponents: PolymerComponent[]
): ChainOption[] {
  if (!profile) return [];

  return polymerComponents.map(pc => {
    const poly = profile.polypeptides.find(p => p.auth_asym_id === pc.chainId);
    const entity = poly ? profile.entities[poly.entity_id] as PolypeptideEntity | undefined : undefined;
    const family = entity && 'family' in entity ? (entity.family ?? undefined) : undefined;

    return {
      chainId: pc.chainId,
      family,
      familyLabel: family ? formatFamilyShort(family) : undefined,
      organism: entity?.src_organism_names?.[0],
      seqLength: entity?.sequence_length ?? 0,
      uniprotId: entity?.uniprot_accessions?.[0],
    };
  });
}

// ────────────────────────────────────────────
// Component
// ────────────────────────────────────────────

export const SequenceAlignmentPanel = forwardRef<MSAHandle, SequenceAlignmentPanelProps>(
  function SequenceAlignmentPanel(props, ref) {
    const {
      chainId,
      onChainChange,
      profile,
      instance,
      polymerComponents,
      pdbId,
      onClose,
      alignedStructures = [],
      onResidueHover,
      onResidueLeave,
      onChainRowMapChange,
      onClearColors,
      onWindowMaskChange,
      onWindowMaskClear,
    } = props;

    const msaRef = useRef<ResizableMSAContainerHandle>(null);

    const dispatch = useAppDispatch();

    // Nightingale web components must be loaded before rendering
    const { areLoaded: nglLoaded } = useNightingaleComponents();

    // Ref to avoid stale closure in imperative handle
    const selectResidueImplRef = useRef<(chainKey: string, masterIdx: number, authSeqId: number) => void>(() => {});

    // Expose MSAHandle to parent
    useImperativeHandle(ref, () => ({
      redraw: () => msaRef.current?.redraw(),
      jumpToRange: (s, e) => msaRef.current?.jumpToRange(s, e),
      setColorScheme: (s) => msaRef.current?.setColorScheme(s),
      setHighlight: (s, e) => msaRef.current?.setHighlight(s, e),
      setCellHighlight: (r, c) => msaRef.current?.setCellHighlight(r, c),
      setCrosshairHighlight: (r, c) => msaRef.current?.setCrosshairHighlight(r, c),
      clearHighlight: () => msaRef.current?.clearHighlight(),
      setSelectionHighlight: (r, c) => msaRef.current?.setSelectionHighlight(r, c),
      clearSelectionHighlight: () => msaRef.current?.clearSelectionHighlight(),
      applyPositionColors: (c) => msaRef.current?.applyPositionColors(c),
      applyCellColors: (c) => msaRef.current?.applyCellColors(c),
      clearPositionColors: () => msaRef.current?.clearPositionColors(),
      selectResidueByChainKey: (ck, mi, as) => selectResidueImplRef.current(ck, mi, as),
    }));

    // ── Derived family from chainId ──
    const family = useMemo(
      () => getFamilyForChain(profile, chainId),
      [profile, chainId]
    );

    // ── Chain dropdown options ──
    const chainOptions = useMemo(
      () => buildChainOptions(profile, polymerComponents),
      [profile, polymerComponents]
    );

    // ── Flash animation state ──
    const [flash, setFlash] = useState(false);
    const prevChainRef = useRef(chainId);
    useEffect(() => {
      if (prevChainRef.current !== chainId) {
        prevChainRef.current = chainId;
        setFlash(true);
        const timer = setTimeout(() => setFlash(false), 600);
        return () => clearTimeout(timer);
      }
    }, [chainId]);

    // ── Master data (local only -- never touches Redux) ──
    const fam = (family ?? 'tubulin_alpha') as TubulinFamily;
    const { data: masterData } = useGetMasterProfileQuery(
      { family: fam },
      { skip: !family }
    );
    const maxLength = masterData?.alignment_length ?? 0;

    // Master sequences are computed locally from the RTK Query response.
    // They never enter Redux, so there's no possibility of family mislabeling
    // when switching between chains of different families.
    const masterSequences: MsaSequence[] = useMemo(() => {
      if (!masterData?.sequences || !family) return [];
      return masterData.sequences.map((seq: any, i: number) => ({
        id: `master__${family}__${seq.id}`,
        name: seq.id,
        sequence: seq.sequence,
        rowIndex: i,
        originType: 'master' as const,
        family,
      }));
    }, [masterData, family]);

    // ── Auto-align current chain (PDB sequences still go to Redux for useViewerSync) ──
    const { isAligned } = useAutoAlignFromProfile(
      profile as TubulinStructure | undefined,
      chainId,
      maxLength
    );

    // PDB sequences come from Redux (registered by useAutoAlignFromProfile)
    const allSequences = useAppSelector(state => state.sequenceRegistry.sequences);
    const pdbSequences = useMemo(() => {
      if (!family) return [];
      return Object.values(allSequences)
        .filter(s => s.family === family && s.originType === 'pdb')
        .sort((a, b) => a.rowIndex - b.rowIndex);
    }, [allSequences, family]);

    // ── Local UI state ──
    const [colorScheme, setColorScheme] = useState('substitution');
    const [showMasters, setShowMasters] = useState(true);
    const [inRangeOnly, setInRangeOnly] = useState(false);
    const currentRangeRef = useRef<[number, number] | null>(null);

    const displaySequences = useMemo(
      () => showMasters
        ? [...masterSequences, ...pdbSequences]
        : [...pdbSequences],
      [masterSequences, pdbSequences, showMasters]
    );

    // Emit chain-to-row mapping for Molstar hover crosshair
    useEffect(() => {
      if (!onChainRowMapChange) return;
      const map: Record<string, { chainKey: string; displayRow: number }> = {};
      displaySequences.forEach((seq, idx) => {
        if (seq.originType === 'pdb' && seq.chainRef) {
          const ck = makeChainKey(seq.chainRef.pdbId, seq.chainRef.chainId);
          map[seq.chainRef.chainId] = { chainKey: ck, displayRow: idx };
        }
      });
      onChainRowMapChange(map);
    }, [displaySequences]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Visibility for aligned structures ──
    const visibleChainKeys = useMemo(() => {
      const set = new Set<string>();
      if (pdbId && chainId) set.add(makeChainKey(pdbId, chainId));
      for (const a of alignedStructures) {
        if (a.visible) set.add(makeChainKey(a.sourcePdbId, a.sourceChainId));
      }
      return set;
    }, [pdbId, chainId, alignedStructures]);

    const handleToggleChainVisibility = useCallback((chainKey: string) => {
      if (!instance) return;
      for (const a of alignedStructures) {
        if (makeChainKey(a.sourcePdbId, a.sourceChainId) === chainKey) {
          instance.setAlignedStructureVisible(a.targetChainId, a.id, !a.visible);
          return;
        }
      }
    }, [instance, alignedStructures]);

    const handleSoloChain = useCallback((soloChainKey: string) => {
      if (!instance) return;
      for (const a of alignedStructures) {
        const ck = makeChainKey(a.sourcePdbId, a.sourceChainId);
        instance.setAlignedStructureVisible(a.targetChainId, a.id, ck === soloChainKey);
      }
    }, [instance, alignedStructures]);

    // ── Range mask ──
    const handleDisplayRangeChange = useCallback((start: number, end: number) => {
      currentRangeRef.current = [start, end];
      if (inRangeOnly) onWindowMaskChange?.(start, end);
    }, [inRangeOnly, onWindowMaskChange]);

    const handleInRangeToggle = useCallback((checked: boolean) => {
      setInRangeOnly(checked);
      if (!checked) {
        onWindowMaskClear?.();
      } else if (currentRangeRef.current) {
        onWindowMaskChange?.(currentRangeRef.current[0], currentRangeRef.current[1]);
      }
    }, [onWindowMaskChange, onWindowMaskClear]);

    // ── Toolbar callbacks ──
    const handleSchemeChange = useCallback((scheme: string) => {
      setColorScheme(scheme);
      onClearColors?.();
      msaRef.current?.setColorScheme(scheme);
    }, [onClearColors]);

    const handleJumpToRange = useCallback(
      (start: number, end: number) => msaRef.current?.jumpToRange(start, end),
      []
    );

    const handleReset = useCallback(() => {
      onClearColors?.();
      setColorScheme('substitution');
      msaRef.current?.setColorScheme('substitution');
    }, [onClearColors]);

    // ── MSA interaction callbacks ──
    // Position mapping (master_index -> auth_seq_id) for MSA click -> Molstar focus
    const sequenceKey = pdbId && chainId ? makeChainKey(pdbId, chainId) : '';
    const positionMapping = useAppSelector(state =>
      sequenceKey ? selectPositionMapping(state, sequenceKey) : null
    );
    const allPositionMappings = useAppSelector(state => state.sequenceRegistry.positionMappings);

    // ── Persistent residue selection ──
    const [selectedResidue, setSelectedResidue] = useState<SelectedResidue | null>(null);

    // Clear selection on chain or family change
    useEffect(() => {
      setSelectedResidue(null);
      msaRef.current?.clearSelectionHighlight();
      instance?.viewer.clearSelection();
    }, [chainId, family]); // eslint-disable-line react-hooks/exhaustive-deps

    // Recompute selection highlight row when displaySequences changes (e.g. Reference toggle)
    useEffect(() => {
      if (!selectedResidue) return;
      const idx = displaySequences.findIndex(s => s.id === selectedResidue.seqId);
      if (idx >= 0) {
        msaRef.current?.setSelectionHighlight(idx, selectedResidue.column);
      } else {
        msaRef.current?.clearSelectionHighlight();
      }
    }, [displaySequences]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleResidueHover = useCallback(
      (seqId: string, position: number) => {
        // Highlight in the MSA itself
        const seq = displaySequences.find(s => s.id === seqId);
        if (seq && seq.originType === 'pdb') {
          // Structural sequence: crosshair (dim column + bold cell)
          const rowIdx = displaySequences.indexOf(seq);
          if (rowIdx >= 0) msaRef.current?.setCrosshairHighlight(rowIdx, position);
          // Highlight label row
          if (seq.chainRef) {
            dispatch(setHoveredChain(makeChainKey(seq.chainRef.pdbId, seq.chainRef.chainId)));
          }
        } else {
          // Non-structural (master/custom): highlight whole column
          msaRef.current?.setHighlight(position + 1, position + 1);
          dispatch(setHoveredChain(null));
        }
        // Forward to Molstar highlight
        onResidueHover?.(seqId, position);
      },
      [onResidueHover, displaySequences, dispatch]
    );

    const handleResidueLeave = useCallback(
      () => {
        msaRef.current?.clearHighlight();
        dispatch(setHoveredChain(null));
        onResidueLeave?.();
      },
      [onResidueLeave, dispatch]
    );

    // MSA click -> select residue in MSA + Molstar; double-click -> focus camera
    const lastMSAClickRef = useRef<{ seqId: string; position: number; time: number } | null>(null);
    const DOUBLE_CLICK_MS = 300;

    const handleResidueClick = useCallback(
      (seqId: string, position: number) => {
        const seq = displaySequences.find(s => s.id === seqId);
        if (!seq || seq.originType !== 'pdb' || !seq.chainRef) return;

        const ck = makeChainKey(seq.chainRef.pdbId, seq.chainRef.chainId);
        const mapping: PositionMapping | null = ck === sequenceKey
          ? positionMapping
          : allPositionMappings[ck] ?? null;
        if (!mapping) return;

        const authSeqId = mapping[position + 1];
        if (authSeqId === undefined) return;
        const authAsymId = authAsymIdFromChainKey(ck);

        // Double-click detection -> focus camera + MSA range adjustment
        const now = Date.now();
        const last = lastMSAClickRef.current;
        if (last && last.seqId === seqId && last.position === position && now - last.time < DOUBLE_CLICK_MS) {
          lastMSAClickRef.current = null;
          if (instance) instance.focusResidue(authAsymId, authSeqId);
          const WINDOW = 15;
          const masterIdx = position + 1;
          msaRef.current?.jumpToRange(Math.max(1, masterIdx - WINDOW), masterIdx + WINDOW);
          return;
        }
        lastMSAClickRef.current = { seqId, position, time: now };

        // Toggle: clicking the same cell deselects
        if (selectedResidue && selectedResidue.seqId === seqId && selectedResidue.column === position) {
          setSelectedResidue(null);
          msaRef.current?.clearSelectionHighlight();
          instance?.viewer.clearSelection();
        } else {
          const residueLetter = seq.sequence[position] ?? '?';
          const seqIdx = displaySequences.findIndex(s => s.id === seqId);
          setSelectedResidue({
            seqId,
            column: position,
            residueLetter,
            chainLabel: `${seq.chainRef.pdbId}:${seq.chainRef.chainId}`,
            authSeqId,
          });
          // Highlight selection in MSA
          if (seqIdx >= 0) msaRef.current?.setSelectionHighlight(seqIdx, position);

          // Select in Molstar (clear everything first to ensure single selection across all chains)
          if (instance) {
            instance.viewer.clearSelection();
            if (ck === sequenceKey) {
              instance.selectResidue(authAsymId, authSeqId);
            } else {
              const aligned = alignedStructures.find(
                a => makeChainKey(a.sourcePdbId, a.sourceChainId) === ck
              );
              if (aligned) {
                instance.selectAlignedResidue(aligned.targetChainId, aligned.id, aligned.sourceChainId, authSeqId);
              }
            }
          }
        }
      },
      [displaySequences, instance, positionMapping, sequenceKey, allPositionMappings, selectedResidue, alignedStructures]
    );

    // Imperative select from Molstar click
    selectResidueImplRef.current = (ck: string, masterIdx: number, authSeqId: number) => {
      const column = masterIdx - 1; // convert 1-based master to 0-based column
      const seq = displaySequences.find(s => s.id === ck);
      if (!seq || seq.originType !== 'pdb' || !seq.chainRef) return;
      const seqIdx = displaySequences.indexOf(seq);

      // Toggle if same residue
      if (selectedResidue && selectedResidue.seqId === ck && selectedResidue.column === column) {
        setSelectedResidue(null);
        msaRef.current?.clearSelectionHighlight();
        instance?.viewer.clearSelection();
        return;
      }

      const residueLetter = seq.sequence[column] ?? '?';
      setSelectedResidue({
        seqId: ck,
        column,
        residueLetter,
        chainLabel: `${seq.chainRef.pdbId}:${seq.chainRef.chainId}`,
        authSeqId,
      });
      if (seqIdx >= 0) msaRef.current?.setSelectionHighlight(seqIdx, column);

      // Select in Molstar
      if (instance) {
        instance.viewer.clearSelection();
        const authAsymId = authAsymIdFromChainKey(ck);
        if (ck === sequenceKey) {
          instance.selectResidue(authAsymId, authSeqId);
        } else {
          const aligned = alignedStructures.find(
            a => makeChainKey(a.sourcePdbId, a.sourceChainId) === ck
          );
          if (aligned) {
            instance.selectAlignedResidue(aligned.targetChainId, aligned.id, aligned.sourceChainId, authSeqId);
          }
        }
      }
    };

    // ── Loading state ──
    if (!nglLoaded || !family || maxLength === 0 || !isAligned) {
      return (
        <div className="h-full flex flex-col bg-white overflow-hidden">
          {/* Header with dropdown even while loading */}
          <ChainDropdownHeader
            chainId={chainId}
            chainOptions={chainOptions}
            onChainChange={onChainChange}
            onClose={onClose}
            flash={flash}
          />
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2" />
              <p className="text-sm text-gray-500">
                {!family ? 'Unknown chain family' : 'Loading...'}
              </p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="h-full flex flex-col bg-white overflow-hidden">
        {/* Header: chain dropdown + toolbar */}
        <div className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 border-b border-gray-100 bg-gray-50/40">
          <ChainDropdownHeader
            chainId={chainId}
            chainOptions={chainOptions}
            onChainChange={onChainChange}
            onClose={onClose}
            flash={flash}
            inline
          />
          {selectedResidue && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-green-50 border border-green-200 rounded text-[10px] flex-shrink-0">
              <span className="font-mono font-bold text-green-800">{selectedResidue.residueLetter}</span>
              <span className="text-green-700">{selectedResidue.chainLabel}</span>
              <span className="text-green-500">#{selectedResidue.authSeqId}</span>
              <button
                onClick={() => { setSelectedResidue(null); msaRef.current?.clearSelectionHighlight(); instance?.viewer.clearSelection(); }}
                className="text-green-400 hover:text-green-600"
              >
                <X size={10} />
              </button>
            </div>
          )}
          <div className="flex-1 min-w-0 overflow-x-auto">
            <MSAToolbar
              currentScheme={colorScheme}
              maxLength={maxLength}
              onSchemeChange={handleSchemeChange}
              onJumpToRange={handleJumpToRange}
              onReset={handleReset}
              compact
              showMasters={showMasters}
              masterCount={masterSequences.length}
              onShowMastersChange={setShowMasters}
              inRangeOnly={inRangeOnly}
              onInRangeOnlyChange={handleInRangeToggle}
            />
          </div>
        </div>

        {/* MSA content */}
        <div className="flex-1 min-h-0 p-2">
          <ResizableMSAContainer
            key={`msa-${family}`}
            ref={msaRef}
            sequences={displaySequences}
            conservationSequences={masterSequences}
            maxLength={maxLength}
            colorScheme={colorScheme}
            onResidueHover={handleResidueHover}
            onResidueLeave={handleResidueLeave}
            onResidueClick={handleResidueClick}
            onDisplayRangeChange={handleDisplayRangeChange}
            visibleChainKeys={visibleChainKeys}
            onToggleChainVisibility={handleToggleChainVisibility}
            onSoloChain={handleSoloChain}
          />
        </div>
      </div>
    );
  }
);

// ────────────────────────────────────────────
// Chain Dropdown Header
// ────────────────────────────────────────────

function ChainDropdownHeader({
  chainId,
  chainOptions,
  onChainChange,
  onClose,
  flash,
  inline = false,
}: {
  chainId: string;
  chainOptions: ChainOption[];
  onChainChange: (chainId: string) => void;
  onClose: () => void;
  flash: boolean;
  inline?: boolean;
}) {
  const current = chainOptions.find(o => o.chainId === chainId);

  const wrapperClass = inline
    ? 'flex items-center gap-2 flex-shrink-0'
    : 'flex items-center justify-between px-3 py-1.5 border-b border-gray-100 bg-gray-50/40';

  return (
    <div className={wrapperClass}>
      <div
        className={`flex items-center gap-2 transition-colors duration-500 rounded px-1.5 py-0.5 ${
          flash ? 'bg-blue-100' : 'bg-transparent'
        }`}
      >
        <select
          value={chainId}
          onChange={e => onChainChange(e.target.value)}
          className="text-xs font-medium bg-transparent border border-gray-200 rounded px-1.5 py-0.5 cursor-pointer hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-300"
        >
          {chainOptions.map(opt => (
            <option key={opt.chainId} value={opt.chainId}>
              {opt.chainId}
              {opt.familyLabel ? ` -- ${opt.familyLabel}` : ''}
              {opt.organism ? ` -- ${opt.organism}` : ''}
              {opt.seqLength ? ` -- ${opt.seqLength} aa` : ''}
            </option>
          ))}
        </select>
        {current?.uniprotId && (
          <a
            href={`https://www.uniprot.org/uniprot/${current.uniprotId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-blue-400 hover:text-blue-600"
          >
            {current.uniprotId}
          </a>
        )}
      </div>
      <button
        onClick={onClose}
        className="p-0.5 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
        title="Close sequence panel"
      >
        <X size={14} />
      </button>
    </div>
  );
}
