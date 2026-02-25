import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useAppSelector } from '@/store/store';
import { selectIsChainAligned } from '@/store/slices/sequence_registry';
import { useChainAlignment } from '@/hooks/useChainAlignment';
import { ResizableMSAContainer } from '@/components/msa/ResizableMSAContainer';
import { MSAToolbar } from '@/components/msa/MSAToolbar';
import type { MolstarInstance } from '@/components/molstar/services/MolstarInstance';
import type { MsaSequence } from '@/store/slices/sequence_registry';
import type { MSAHandle } from '@/components/msa/types';

interface MonomerMSAPanelProps {
  pdbId: string | null;
  chainId: string;
  family?: string;
  instance: MolstarInstance | null;
  masterSequences: MsaSequence[];
  pdbSequences: MsaSequence[];
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
  pdbId,
  chainId,
  family,
  instance,
  masterSequences,
  pdbSequences,
  maxLength,
  nglLoaded,
  msaRef,
  onResidueHover,
  onResidueLeave,
  onClearColors,
  onWindowMaskChange,
  onWindowMaskClear,
}: MonomerMSAPanelProps) {
  const { alignChain, isAligning } = useChainAlignment();
  const [colorScheme, setColorScheme] = useState('custom-position');
  const [inRangeOnly, setInRangeOnly] = useState(false);

  // Track the current nightingale display range so we can apply the mask
  // immediately when the checkbox is toggled on, even if no drag has happened.
  const currentRangeRef = useRef<[number, number] | null>(null);

  const isAligned = useAppSelector(state =>
    pdbId ? selectIsChainAligned(state, pdbId, chainId) : false
  );

  const alignmentAttemptedRef = useRef<Set<string>>(new Set());

  // Auto-align on mount
  useEffect(() => {
    const key = pdbId && chainId ? `${pdbId}_${chainId}` : null;
    if (!instance || !pdbId || !chainId) return;
    if (isAligned || isAligning) return;
    if (key && alignmentAttemptedRef.current.has(key)) return;

    if (key) alignmentAttemptedRef.current.add(key);

    alignChain(pdbId, chainId, instance, family).catch(err => {
      console.error('Auto-align failed:', err);
      if (key) alignmentAttemptedRef.current.delete(key);
    });
  }, [instance, pdbId, chainId, family, isAligned, isAligning, alignChain]);

  const allSequences = useMemo(
    () => [...masterSequences, ...pdbSequences],
    [masterSequences, pdbSequences]
  );

  // ----------------------------------------------------------------
  // Range mask handlers
  // ----------------------------------------------------------------

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

  // ----------------------------------------------------------------
  // Toolbar handlers
  // ----------------------------------------------------------------

  const handleSchemeChange = useCallback(
    (scheme: string) => {
      setColorScheme(scheme);
      onClearColors();
      msaRef.current?.setColorScheme(scheme);
    },
    [msaRef, onClearColors]
  );

  const handleJumpToRange = useCallback(
    (start: number, end: number) => {
      msaRef.current?.jumpToRange(start, end);
    },
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

  // ----------------------------------------------------------------
  // Loading state
  // ----------------------------------------------------------------

  if (!nglLoaded || maxLength === 0 || isAligning) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2" />
          <p className="text-sm text-gray-500">
            {isAligning ? `Aligning ${pdbId}:${chainId}...` : 'Loading...'}
          </p>
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
          key={`msa-${family ?? 'none'}`}
          ref={msaRef}
          sequences={allSequences}
          maxLength={maxLength}
          colorScheme={colorScheme}
          onResidueHover={handleResidueHover}
          onResidueLeave={onResidueLeave}
          onDisplayRangeChange={handleDisplayRangeChange}
        />
      </div>
    </div>
  );
}