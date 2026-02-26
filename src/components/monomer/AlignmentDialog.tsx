import { useEffect, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { AlignStructureForm } from './AlignStructureForm';
import { PolymerBrowser } from './PolymerBrowser';
import { useChainAlignment } from '@/hooks/useChainAlignment';
import { useGetStructureProfileQuery } from '@/store/tubxz_api';
import { useAppSelector } from '@/store/store';
import { selectLoadedChainKeys } from '@/store/slices/annotationsSlice';
import { makeChainKey } from '@/lib/chain_key';
import type { MolstarInstance } from '@/components/molstar/services/MolstarInstance';
import type { AlignedStructure } from '@/components/molstar/core/types';

interface AlignmentDialogProps {
  targetChainId: string;
  targetFamily?: string;
  instance: MolstarInstance | null;
  masterLength: number;
  alignedStructures: AlignedStructure[];
  primaryPdbId: string | null;
  onClose: () => void;
}

type Tab = 'browse' | 'direct';

export function AlignmentDialog({
  targetChainId,
  targetFamily,
  instance,
  masterLength,
  alignedStructures,
  primaryPdbId,
  onClose,
}: AlignmentDialogProps) {
  const [tab, setTab] = useState<Tab>('browse');

  // Build set of already-aligned chain keys (including primary)
  const alignedChainKeys = useMemo(() => {
    const keys = new Set<string>();
    if (primaryPdbId && targetChainId) {
      keys.add(makeChainKey(primaryPdbId, targetChainId));
    }
    for (const a of alignedStructures) {
      keys.add(makeChainKey(a.sourcePdbId, a.sourceChainId));
    }
    return keys;
  }, [primaryPdbId, targetChainId, alignedStructures]);

  // ── Browse-mode alignment ──
  const [pendingAlign, setPendingAlign] = useState<{
    pdbId: string; chainId: string; family?: string;
  } | null>(null);
  const [alignError, setAlignError] = useState<string | null>(null);

  const { alignChainFromProfile } = useChainAlignment();

  const {
    data: sourceProfile,
    error: profileError,
  } = useGetStructureProfileQuery(
    { rcsbId: pendingAlign?.pdbId ?? '' },
    { skip: !pendingAlign }
  );

  useEffect(() => {
    if (!pendingAlign) return;

    if (profileError) {
      setAlignError(`Could not fetch profile for ${pendingAlign.pdbId}`);
      setPendingAlign(null);
      return;
    }

    if (!sourceProfile) return;

    const doAlign = async () => {
      if (!instance) return;

      const ok = await instance.loadAlignedStructure(
        targetChainId, pendingAlign.pdbId, pendingAlign.chainId, pendingAlign.family
      );

      if (!ok) {
        setAlignError(`Failed to superpose ${pendingAlign.pdbId}:${pendingAlign.chainId}`);
        setPendingAlign(null);
        return;
      }

      const result = alignChainFromProfile(sourceProfile, pendingAlign.chainId, masterLength);

      if (!result) {
        setAlignError(`No alignment mapping for chain ${pendingAlign.chainId}`);
      } else {
        if (pendingAlign.family) {
          const alignedId = `${pendingAlign.pdbId}_${pendingAlign.chainId}_on_${targetChainId}`;
          instance.styleAlignedChainAsGhost(targetChainId, alignedId, pendingAlign.family);
        }
        setAlignError(null);
      }

      setPendingAlign(null);
    };

    doAlign();
  }, [sourceProfile, profileError, pendingAlign, instance, targetChainId, masterLength, alignChainFromProfile]);

  const handleBrowseSelect = useCallback((pdbId: string, chainId: string, family?: string) => {
    setAlignError(null);
    setPendingAlign({ pdbId: pdbId.toUpperCase(), chainId: chainId.toUpperCase(), family });
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

  <div className="relative bg-white rounded-lg shadow-xl w-[900px] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-gray-800">Add Alignment</h2>
            <span className="text-[10px] text-gray-400">
              target: {targetChainId}
              {targetFamily && ` (${targetFamily.replace('tubulin_', '')})`}
            </span>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <X size={14} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-4 flex-shrink-0">
          <button
            onClick={() => setTab('browse')}
            className={`px-3 py-2 text-[11px] font-medium border-b-2 transition-colors ${
              tab === 'browse' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            Browse Database
          </button>
          <button
            onClick={() => setTab('direct')}
            className={`px-3 py-2 text-[11px] font-medium border-b-2 transition-colors ${
              tab === 'direct' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            Direct PDB + Chain
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {tab === 'browse' ? (
            <div className="p-4 h-full flex flex-col">
              {pendingAlign && (
                <div className="mb-2 px-2 py-1 bg-blue-50 rounded text-[10px] text-blue-600 flex-shrink-0">
                  Aligning {pendingAlign.pdbId}:{pendingAlign.chainId}...
                </div>
              )}
              {alignError && (
                <div className="mb-2 px-2 py-1 bg-red-50 rounded text-[10px] text-red-500 flex-shrink-0">
                  {alignError}
                </div>
              )}
              <PolymerBrowser
                defaultFamily={targetFamily}
                alignedChainKeys={alignedChainKeys}
                onSelectChain={handleBrowseSelect}
              />
            </div>
          ) : (
            <div className="p-4">
              <AlignStructureForm
                targetChainId={targetChainId}
                instance={instance}
                targetFamily={targetFamily}
                masterLength={masterLength}
                onClose={onClose}
              />
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}