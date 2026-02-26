import { useState, useCallback } from 'react';
import { ChevronRight, Eye, EyeOff, X } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/store';
import { useAnnotationVisibility } from '@/hooks/useAnnotationVisibility';
import { selectPositionMapping } from '@/store/slices/sequence_registry';
import { clearChain } from '@/store/slices/annotationsSlice';
import { VariantsPanel } from '@/components/annotations/VariantsPanel';
import { LigandsPanel } from '@/components/annotations/LigandsPanel';
import type { MolstarInstance } from '@/components/molstar/services/MolstarInstance';
import type { MSAHandle } from '@/components/msa/types';
import type { VariantType } from '@/store/slices/annotationsSlice';

interface AlignedInfo {
  id: string;
  targetChainId: string;
  rmsd: number | null;
  visible: boolean;
}

interface ChainRowProps {
  chainKey: string;
  pdbId: string;
  chainId: string;
  isPrimary: boolean;
  family?: string;
  aligned?: AlignedInfo;
  instance: MolstarInstance | null;
  msaRef: React.RefObject<MSAHandle>;
}

const FAMILY_SHORT: Record<string, string> = {
  tubulin_alpha: '\u03B1',
  tubulin_beta: '\u03B2',
  tubulin_gamma: '\u03B3',
  tubulin_delta: '\u03B4',
  tubulin_epsilon: '\u03B5',
};

export function ChainRow({
  chainKey,
  pdbId,
  chainId,
  isPrimary,
  family,
  aligned,
  instance,
  msaRef,
}: ChainRowProps) {
  const dispatch = useAppDispatch();
  const [expanded, setExpanded] = useState(isPrimary);

  const {
    ligandSites,
    variants,
    showVariants,
    visibleLigandIds,
    setShowVariants,
    toggleLigand,
    showAll,
    hideAll,
    clearAll,
  } = useAnnotationVisibility(chainKey);

  const positionMapping = useAppSelector(state =>
    selectPositionMapping(state, chainKey)
  );

  // Variant type counts for the summary
  const variantCounts = variants.reduce((acc, v) => {
    acc[v.type] = (acc[v.type] || 0) + 1;
    return acc;
  }, {} as Record<VariantType, number>);

  const familyLabel = family ? (FAMILY_SHORT[family] ?? family.replace('tubulin_', '').replace('map_', '')) : null;

  // ── Focus handlers ──

  const handleFocusVariant = useCallback((masterIndex: number) => {
    msaRef.current?.jumpToRange(masterIndex, masterIndex);
    if (isPrimary && instance && positionMapping) {
      const authSeqId = positionMapping[masterIndex];
      if (authSeqId !== undefined) instance.focusResidue(chainId, authSeqId);
    }
  }, [msaRef, isPrimary, instance, positionMapping, chainId]);

  const handleFocusLigand = useCallback((siteId: string) => {
    const site = ligandSites.find(s => s.id === siteId);
    if (!site || site.masterIndices.length === 0) return;
    const start = Math.min(...site.masterIndices);
    const end = Math.max(...site.masterIndices);
    msaRef.current?.jumpToRange(start, end);
    if (isPrimary && instance && site.authSeqIds.length > 0) {
      instance.focusResidueRange(chainId, Math.min(...site.authSeqIds), Math.max(...site.authSeqIds));
    }
  }, [msaRef, isPrimary, instance, ligandSites, chainId]);

  // ── Aligned chain actions ──

  const handleToggleVisibility = useCallback(() => {
    if (!aligned || !instance) return;
    instance.setAlignedStructureVisible(aligned.targetChainId, aligned.id, !aligned.visible);
  }, [aligned, instance]);

  const handleRemove = useCallback(() => {
    if (!aligned || !instance) return;
    instance.removeAlignedStructureById(aligned.targetChainId, aligned.id);
    dispatch(clearChain(chainKey));
  }, [aligned, instance, chainKey, dispatch]);

  const handleMouseEnter = useCallback(() => {
    if (aligned && instance) instance.highlightAlignedChain(aligned.targetChainId, aligned.id, true);
  }, [aligned, instance]);

  const handleMouseLeave = useCallback(() => {
    if (aligned && instance) instance.highlightAlignedChain(aligned.targetChainId, aligned.id, false);
  }, [aligned, instance]);

  return (
    <div
      className={`border-b border-gray-100 ${!isPrimary ? 'bg-gray-50/30' : ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* ── Summary row ── */}
      <div
        onClick={() => setExpanded(e => !e)}
        className="flex items-center gap-1.5 px-3 py-1.5 cursor-pointer hover:bg-gray-50 select-none"
      >
        <ChevronRight
          size={12}
          className={`text-gray-300 flex-shrink-0 transition-transform duration-100 ${expanded ? 'rotate-90' : ''}`}
        />

        {/* Identity */}
        <span className="font-mono text-[11px] font-medium text-gray-800 flex-shrink-0">
          {pdbId}:{chainId}
        </span>

        {familyLabel && (
          <span className="text-[10px] text-gray-400 flex-shrink-0">{familyLabel}</span>
        )}

        {isPrimary && (
          <span className="text-[9px] px-1 py-px bg-blue-100 text-blue-600 rounded flex-shrink-0">
            pri
          </span>
        )}

        {aligned?.rmsd != null && (
          <span className="text-[9px] text-gray-400 flex-shrink-0">
            {aligned.rmsd.toFixed(2)}A
          </span>
        )}

        {/* Annotation summary -- right side */}
        <div className="ml-auto flex items-center gap-1.5 text-[9px] text-gray-400 flex-shrink-0">
          {variantCounts.deletion && (
            <span className="text-red-400">{variantCounts.deletion}del</span>
          )}
          {variantCounts.substitution && (
            <span className="text-orange-400">{variantCounts.substitution}sub</span>
          )}
          {variantCounts.insertion && (
            <span className="text-green-400">{variantCounts.insertion}ins</span>
          )}
          {ligandSites.length > 0 && (
            <span className="text-blue-400">{ligandSites.length}lig</span>
          )}
        </div>

        {/* Aligned chain controls -- stop propagation so they don't toggle expand */}
        {aligned && (
          <div className="flex items-center gap-0.5 ml-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
            <button
              onClick={handleToggleVisibility}
              className="p-0.5 text-gray-300 hover:text-gray-600"
              title={aligned.visible ? 'Hide' : 'Show'}
            >
              {aligned.visible ? <Eye size={11} /> : <EyeOff size={11} />}
            </button>
            <button
              onClick={handleRemove}
              className="p-0.5 text-gray-300 hover:text-red-500"
              title="Remove"
            >
              <X size={11} />
            </button>
          </div>
        )}
      </div>

      {/* ── Expanded content ── */}
      {expanded && (
        <div className="px-3 pb-2 space-y-1.5">
          {variants.length === 0 && ligandSites.length === 0 ? (
            <p className="text-[10px] text-gray-300 py-1">No annotations</p>
          ) : (
            <>
              <VariantsPanel
                variants={variants}
                showVariants={showVariants}
                onToggleVariants={setShowVariants}
                onFocusVariant={handleFocusVariant}
              />
              <LigandsPanel
                ligandSites={ligandSites}
                visibleLigandIds={visibleLigandIds}
                onToggleLigand={toggleLigand}
                onFocusLigand={handleFocusLigand}
                onShowAll={showAll}
                onHideAll={hideAll}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}