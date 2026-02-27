import { useState, useMemo, useCallback, useRef } from 'react';
import { useAutoAlignFromProfile } from '@/hooks/useChainAlignment';
import { ResizableMSAContainer } from '@/components/msa/ResizableMSAContainer';
import { MSAToolbar } from '@/components/msa/MSAToolbar';
import { makeChainKey } from '@/lib/chain_key';
import type { MolstarInstance } from '@/components/molstar/services/MolstarInstance';
import type { MsaSequence } from '@/store/slices/sequence_registry';
import type { MSAHandle } from '@/components/msa/types';
import type { TubulinStructure } from '@/store/tubxz_api';
import type { AlignedStructure } from '@/components/molstar/core/types';

interface MonomerMSAPanelProps {
  profile?: TubulinStructure;
  pdbId: string | null;
  chainId: string;
  family?: string;
  instance: MolstarInstance | null;
  masterSequences: MsaSequence[];
  pdbSequences: MsaSequence[];
  alignedStructures: AlignedStructure[];
  maxLength: number;
  nglLoaded: boolean;
  msaRef: React.RefObject<MSAHandle>;
  onResidueHover: (position: number) => void;
  onResidueLeave: () => void;
  onClearColors: () => void;
  onWindowMaskChange?: (masterStart: number, masterEnd: number) => void;
  onWindowMaskClear?: () => void;
}

export function MonomerMSAPanel({
  profile,
  pdbId,
  chainId,
  family,
  instance,
  masterSequences,
  pdbSequences,
  alignedStructures,
  maxLength,
  nglLoaded,
  msaRef,
  onResidueHover,
  onResidueLeave,
  onClearColors,
  onWindowMaskChange,
  onWindowMaskClear,
}: MonomerMSAPanelProps) {
  const [colorScheme, setColorScheme] = useState('custom-position');
  const [inRangeOnly, setInRangeOnly] = useState(false);
  const [showMasters, setShowMasters] = useState(true);
  const currentRangeRef = useRef<[number, number] | null>(null);

  const { isAligned } = useAutoAlignFromProfile(profile, chainId, maxLength);

  const displaySequences = useMemo(
    () => showMasters
      ? [...masterSequences, ...pdbSequences]
      : [...pdbSequences],
    [masterSequences, pdbSequences, showMasters]
  );

  // ── Visibility state for MSA label buttons ──

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

  // ── Toolbar ──

  const handleSchemeChange = useCallback(
    (scheme: string) => {
      setColorScheme(scheme);
      onClearColors();
      msaRef.current?.setColorScheme(scheme);
    },
    [msaRef, onClearColors]
  );

  const handleJumpToRange = useCallback(
    (start: number, end: number) => msaRef.current?.jumpToRange(start, end),
    [msaRef]
  );

  const handleReset = useCallback(() => {
    onClearColors();
    setColorScheme('clustal2');
    msaRef.current?.setColorScheme('clustal2');
  }, [msaRef, onClearColors]);

  const handleResidueHover = useCallback(
    (_seqId: string, position: number) => onResidueHover(position),
    [onResidueHover]
  );

  if (!nglLoaded || maxLength === 0 || !isAligned) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2" />
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden">
      <div className="flex-shrink-0 px-4 py-2 border-b bg-gray-50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-800">Sequence Alignment</span>
          <span className="text-xs text-gray-400 font-mono">{pdbId}:{chainId}</span>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showMasters}
              onChange={e => setShowMasters(e.target.checked)}
              className="rounded"
            />
            Reference
            <span className="text-gray-400">({masterSequences.length})</span>
          </label>
          <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={inRangeOnly}
              onChange={e => handleInRangeToggle(e.target.checked)}
              className="rounded"
            />
            In-range only
          </label>
        </div>
      </div>

      <div className="flex-shrink-0 px-3 py-1.5 border-b bg-white">
        <MSAToolbar
          currentScheme={colorScheme}
          maxLength={maxLength}
          onSchemeChange={handleSchemeChange}
          onJumpToRange={handleJumpToRange}
          onReset={handleReset}
          compact
        />
      </div>

      <div className="flex-1 min-h-0 p-2">
        <ResizableMSAContainer
          key={`msa-${family ?? 'none'}-${showMasters ? 'wm' : 'nm'}`}
          ref={msaRef}
          sequences={displaySequences}
          maxLength={maxLength}
          colorScheme={colorScheme}
          onResidueHover={handleResidueHover}
          onResidueLeave={onResidueLeave}
          onDisplayRangeChange={handleDisplayRangeChange}
          visibleChainKeys={visibleChainKeys}
          onToggleChainVisibility={handleToggleChainVisibility}
          onSoloChain={handleSoloChain}
        />
      </div>
    </div>
  );
}