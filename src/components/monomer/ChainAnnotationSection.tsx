import { useState, useCallback } from 'react';
import { ChevronDown, ChevronRight, Eye, EyeOff, X } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/store';
import { useAnnotationVisibility } from '@/hooks/useAnnotationVisibility';
import { selectPositionMapping } from '@/store/slices/sequence_registry';
import { clearChain } from '@/store/slices/annotationsSlice';
import { VariantsPanel } from '@/components/annotations/VariantsPanel';
import { LigandsPanel } from '@/components/annotations/LigandsPanel';
import { formatFamilyShort } from '@/lib/formatters';
import type { MolstarInstance } from '@/components/molstar/services/MolstarInstance';
import type { MSAHandle } from '@/components/msa/types';

interface AlignedInfo {
  id: string;
  targetChainId: string;
  rmsd: number | null;
  visible: boolean;
}

interface ChainAnnotationSectionProps {
  chainKey: string;
  pdbId: string;
  chainId: string;
  isPrimary: boolean;
  aligned?: AlignedInfo;
  instance: MolstarInstance | null;
  msaRef: React.RefObject<MSAHandle>;
}

export function ChainAnnotationSection({
  chainKey,
  pdbId,
  chainId,
  isPrimary,
  aligned,
  instance,
  msaRef,
}: ChainAnnotationSectionProps) {
  const dispatch = useAppDispatch();
  const [expanded, setExpanded] = useState(isPrimary);

  const {
    ligandSites,
    variants,
    family,
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

  const formattedFamily = family ? formatFamilyShort(family) : null;
  const hasAnnotations = variants.length > 0 || ligandSites.length > 0;

  // ----------------------------------------------------------------
  // Focus handlers
  // ----------------------------------------------------------------

  const handleFocusVariant = useCallback((masterIndex: number) => {
    msaRef.current?.jumpToRange(masterIndex, masterIndex);
    if (isPrimary && instance && positionMapping) {
      const authSeqId = positionMapping[masterIndex];
      if (authSeqId !== undefined) {
        instance.focusResidue(chainId, authSeqId);
      }
    }
  }, [msaRef, isPrimary, instance, positionMapping, chainId]);

  const handleFocusLigand = useCallback((siteId: string) => {
    const site = ligandSites.find(s => s.id === siteId);
    if (!site || site.masterIndices.length === 0) return;

    const start = Math.min(...site.masterIndices);
    const end = Math.max(...site.masterIndices);
    msaRef.current?.jumpToRange(start, end);

    if (isPrimary && instance && site.authSeqIds.length > 0) {
      const first = Math.min(...site.authSeqIds);
      const last = Math.max(...site.authSeqIds);
      instance.focusResidueRange(chainId, first, last);
    }
  }, [msaRef, isPrimary, instance, ligandSites, chainId]);

  // ----------------------------------------------------------------
  // Aligned structure actions
  // ----------------------------------------------------------------

  const handleToggleVisibility = useCallback(() => {
    if (!aligned || !instance) return;
    instance.setAlignedStructureVisible(
      aligned.targetChainId, aligned.id, !aligned.visible
    );
  }, [aligned, instance]);

  const handleRemove = useCallback(() => {
    if (!aligned || !instance) return;
    instance.removeAlignedStructureById(aligned.targetChainId, aligned.id);
    dispatch(clearChain(chainKey));
  }, [aligned, instance, chainKey, dispatch]);


  const handleMouseEnter = useCallback(() => {
    if (aligned && instance) {
      instance.highlightAlignedChain(aligned.targetChainId, aligned.id, true);
    }
  }, [aligned, instance]);

  const handleMouseLeave = useCallback(() => {
    if (aligned && instance) {
      instance.highlightAlignedChain(aligned.targetChainId, aligned.id, false);
    }
  }, [aligned, instance]);
  // ----------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------

  return (
<div
      className={`rounded border ${isPrimary ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200 bg-gray-50/30'}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-100/50 rounded-t"
      >
        {expanded
          ? <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />
          : <ChevronRight size={14} className="text-gray-400 flex-shrink-0" />
        }
        <span className="font-mono text-xs font-medium text-gray-800">
          {pdbId}:{chainId}
        </span>
        {formattedFamily && (
          <span className="text-[10px] text-gray-500">({formattedFamily})</span>
        )}
        {isPrimary && (
          <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">primary</span>
        )}
        {aligned?.rmsd != null && (
          <span className="text-[10px] text-gray-400 ml-auto mr-1">
            RMSD: {aligned.rmsd.toFixed(2)}
          </span>
        )}
      </button>

      {/* Aligned chain action buttons -- outside the toggle so they don't trigger collapse */}
      {aligned && (
        <div className="flex items-center gap-1 px-3 pb-1 -mt-1 justify-end">
          <button
            onClick={handleToggleVisibility}
            className="p-1 text-gray-400 hover:text-gray-700"
            title={aligned.visible ? 'Hide in 3D' : 'Show in 3D'}
          >
            {aligned.visible ? <Eye size={13} /> : <EyeOff size={13} />}
          </button>
          <button
            onClick={handleRemove}
            className="p-1 text-gray-400 hover:text-red-600"
            title="Remove aligned chain"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Body */}
      {expanded && (
        <div className="px-3 pb-3 space-y-3">
          {!hasAnnotations ? (
            <p className="text-xs text-gray-400 text-center py-2">No annotations</p>
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