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
import { useAppSelector } from '@/store/store';
import { useGetMasterProfileQuery } from '@/store/tubxz_api';
import { useAutoAlignFromProfile } from '@/hooks/useChainAlignment';
import { useNightingaleComponents } from '@/hooks/useNightingaleComponents';
import { selectPositionMapping } from '@/store/slices/sequence_registry';
import type { MsaSequence } from '@/store/slices/sequence_registry';
import { getFamilyForChain, StructureProfile } from '@/lib/profile_utils';
import { formatFamilyShort } from '@/lib/formatters';
import { makeChainKey } from '@/lib/chain_key';
import { ResizableMSAContainer } from './ResizableMSAContainer';
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
  onResidueHover?: (position: number) => void;
  onResidueLeave?: () => void;
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
      onClearColors,
      onWindowMaskChange,
      onWindowMaskClear,
    } = props;

    const msaRef = useRef<MSAHandle>(null);

    // Nightingale web components must be loaded before rendering
    const { areLoaded: nglLoaded } = useNightingaleComponents();

    // Expose MSAHandle to parent
    useImperativeHandle(ref, () => ({
      redraw: () => msaRef.current?.redraw(),
      jumpToRange: (s, e) => msaRef.current?.jumpToRange(s, e),
      setColorScheme: (s) => msaRef.current?.setColorScheme(s),
      setHighlight: (s, e) => msaRef.current?.setHighlight(s, e),
      clearHighlight: () => msaRef.current?.clearHighlight(),
      applyPositionColors: (c) => msaRef.current?.applyPositionColors(c),
      applyCellColors: (c) => msaRef.current?.applyCellColors(c),
      clearPositionColors: () => msaRef.current?.clearPositionColors(),
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
    const [colorScheme, setColorScheme] = useState('clustal2');
    const [showMasters, setShowMasters] = useState(true);
    const [inRangeOnly, setInRangeOnly] = useState(false);
    const currentRangeRef = useRef<[number, number] | null>(null);

    const displaySequences = useMemo(
      () => showMasters
        ? [...masterSequences, ...pdbSequences]
        : [...pdbSequences],
      [masterSequences, pdbSequences, showMasters]
    );

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
      setColorScheme('clustal2');
      msaRef.current?.setColorScheme('clustal2');
    }, [onClearColors]);

    // ── MSA interaction callbacks ──
    // Position mapping (master_index -> auth_seq_id) for MSA click -> Molstar focus
    const sequenceKey = pdbId && chainId ? makeChainKey(pdbId, chainId) : '';
    const positionMapping = useAppSelector(state =>
      sequenceKey ? selectPositionMapping(state, sequenceKey) : null
    );

    const handleResidueHover = useCallback(
      (_seqId: string, position: number) => onResidueHover?.(position),
      [onResidueHover]
    );

    const handleResidueLeave = useCallback(
      () => onResidueLeave?.(),
      [onResidueLeave]
    );

    // MSA click -> focus residue in Molstar 3D
    const handleResidueClick = useCallback(
      (_seqId: string, position: number) => {
        if (!instance || !positionMapping) return;
        const authSeqId = positionMapping[position + 1];
        if (authSeqId !== undefined) {
          instance.focusResidue(chainId, authSeqId);
        }
      },
      [instance, positionMapping, chainId]
    );

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
            key={`msa-${family}-${showMasters ? 'wm' : 'nm'}`}
            ref={msaRef}
            sequences={displaySequences}
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
