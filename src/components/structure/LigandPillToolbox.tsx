'use client';

import { useCallback, useMemo, useState } from 'react';
import { Eye, EyeOff, Crosshair, Tag, Loader2, XCircle } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/store';
import {
  toggleAllLigandsByChemId,
  toggleLigandSite,
  type DetailedLigandInfo,
} from '@/store/slices/annotationsSlice';
import {
  selectLigandColorOverride,
  setLigandColorOverride,
  clearLigandColorOverride,
} from '@/store/slices/colorOverridesSlice';
import { ColorSwatchPicker } from '@/components/ui/ColorSwatchPicker';
import type { MolstarInstance } from '@/components/molstar/services/MolstarInstance';
import type { MSAHandle } from '@/components/msa/types';
import type { ActiveBindingSite } from './BindingSiteCard';

interface LigandPillToolboxProps {
  /** Detailed ligand bucket — one row per unique chemId in scope. */
  lig: DetailedLigandInfo;
  /** Optional active chain id; if set, the focus button prefers sites on this chain. */
  activeChainId: string | null;
  instance: MolstarInstance | null;
  msaRef: React.RefObject<MSAHandle>;
  /** Lifted binding-site state so the focus button reflects on/off. */
  activeBindingSite: ActiveBindingSite | null;
  onActivateBindingSite: (target: Omit<ActiveBindingSite, 'contacts'>) => Promise<void> | void;
  onDeactivateBindingSite: () => Promise<void> | void;
}

// MSA span padding when jumping the viewport to a binding-site span.
const SPAN_PAD = 5;

export function LigandPillToolbox({
  lig,
  activeChainId,
  instance,
  msaRef,
  activeBindingSite,
  onActivateBindingSite,
  onDeactivateBindingSite,
}: LigandPillToolboxProps) {
  const dispatch = useAppDispatch();
  const [open, setOpen] = useState(false);
  const [focusing, setFocusing] = useState(false);

  // Build the list of uniqueKeys for this ligand's components in 3D so we can
  // bulk-toggle their visibility. uniqueKey format: `compId_chainId_seqId`.
  const uniqueKeys = useMemo(
    () =>
      lig.sites.map(s => `${s.site.ligandId}_${s.site.ligandChain}_${s.site.ligandAuthSeqId}`),
    [lig.sites]
  );

  // Aggregate molecule visibility: visible if any instance is currently shown.
  const moleculeVisible = useAppSelector(state => {
    const componentStates =
      state.molstarInstances.instances['structure']?.componentStates ?? {};
    return uniqueKeys.some(k => componentStates[k]?.visible !== false);
  });

  // True when one of this chemId's sites is the currently active binding site.
  const isActiveBindingSite =
    activeBindingSite != null && uniqueKeys.includes(activeBindingSite.uniqueKey);

  // Color override (shared with the MSA aux-row picker). If the user picked
  // a color anywhere it shows up here too.
  const colorOverride = useAppSelector(state => selectLigandColorOverride(state, lig.chemId));
  const isColorOverridden = Boolean(colorOverride);
  const handleColorChange = useCallback(
    (hex: string) => dispatch(setLigandColorOverride({ key: lig.chemId, color: hex })),
    [dispatch, lig.chemId]
  );
  const handleColorReset = useCallback(
    () => dispatch(clearLigandColorOverride(lig.chemId)),
    [dispatch, lig.chemId]
  );

  // Pick the site to anchor the focus action on:
  // - in monomer mode (activeChainId set), prefer a site whose ligand sits on
  //   that chain (e.g. focus on the alpha-bound GTP when chain A is active);
  // - otherwise fall back to the first site.
  const focusSite = useMemo(() => {
    if (activeChainId) {
      const onActive = lig.sites.find(s => s.site.ligandChain === activeChainId);
      if (onActive) return onActive;
    }
    return lig.sites[0];
  }, [lig.sites, activeChainId]);

  const handleToggleMolecule = useCallback(() => {
    if (!instance) return;
    const next = !moleculeVisible;
    for (const key of uniqueKeys) {
      instance.setLigandVisibility(key, next);
    }
  }, [instance, uniqueKeys, moleculeVisible]);

  const handleToggleAnnotations = useCallback(() => {
    dispatch(toggleAllLigandsByChemId(lig.chemId));
  }, [dispatch, lig.chemId]);

  const handleToggleBindingSite = useCallback(async () => {
    if (!instance || !focusSite) return;
    setFocusing(true);
    try {
      if (isActiveBindingSite) {
        // Toggle off: clear representation + page state.
        await onDeactivateBindingSite();
        return;
      }
      // Toggle on: ensure annotation visibility for the site's chain, then
      // ask the page to activate (which calls focusLigandBindingSite + sets
      // state with the returned contacts).
      if (!focusSite.annotationVisible) {
        dispatch(toggleLigandSite({ chainKey: focusSite.chainKey, siteId: focusSite.site.id }));
      }
      const uniqueKey = `${focusSite.site.ligandId}_${focusSite.site.ligandChain}_${focusSite.site.ligandAuthSeqId}`;
      await onActivateBindingSite({
        uniqueKey,
        chemId: lig.chemId,
        color: lig.color,
        ligandName: lig.ligandName,
        drugbankId: lig.drugbankId,
        chainKey: focusSite.chainKey,
        siteId: focusSite.site.id,
      });

      // MSA: jump the viewport to the contact-residue span.
      const indices = focusSite.site.masterIndices;
      if (indices && indices.length > 0) {
        const min = Math.min(...indices);
        const max = Math.max(...indices);
        msaRef.current?.jumpToRange(Math.max(1, min - SPAN_PAD), max + SPAN_PAD);
      }
    } finally {
      setFocusing(false);
    }
  }, [
    instance, focusSite, isActiveBindingSite, lig,
    dispatch, msaRef, onActivateBindingSite, onDeactivateBindingSite,
  ]);

  // Hover-bridge: keep open while the cursor is anywhere in the chip + popover.
  const closeTimer = useMemo(() => ({ id: 0 as any }), []);
  const handleEnter = () => {
    if (closeTimer.id) clearTimeout(closeTimer.id);
    setOpen(true);
  };
  const handleLeave = () => {
    closeTimer.id = setTimeout(() => setOpen(false), 80);
  };

  return (
    <div
      className="relative"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {/* ── Pill chip. Dot is its own click-target (color picker); the rest
              of the chip stays a no-op (hover is the entry point). ── */}
      <div
        className={`flex items-center gap-1.5 pl-1.5 pr-2 py-0.5 rounded-full border text-[10px] font-mono transition-colors
          ${isActiveBindingSite
            ? 'border-slate-400 bg-slate-50 text-slate-900'
            : 'border-slate-200/80 bg-white hover:bg-slate-50 text-slate-700'}`}
        title={`${lig.chemId} — ${lig.count} site${lig.count > 1 ? 's' : ''}`}
      >
        <ColorSwatchPicker
          color={lig.color}
          isOverridden={isColorOverridden}
          onChange={handleColorChange}
          onReset={handleColorReset}
          title={`Color for ${lig.chemId}`}
        >
          <span
            className="w-2.5 h-2.5 rounded-full border border-slate-200/80"
            style={{ backgroundColor: lig.color }}
          />
        </ColorSwatchPicker>
        <span className="font-semibold">{lig.chemId}</span>
        <span className="text-slate-400 text-[9px]">
          {lig.count}
        </span>
      </div>

      {/* ── Popover toolbox ── */}
      {open && (
        <div
          className="absolute left-0 top-[calc(100%+4px)] z-30
                     min-w-[14rem] rounded-lg border border-slate-200 bg-white shadow-lg
                     text-[11px] text-slate-700"
        >
          {/* Header */}
          <div className="px-2.5 pt-2 pb-1.5 border-b border-slate-100">
            <div className="flex items-baseline gap-2">
              <ColorSwatchPicker
                color={lig.color}
                isOverridden={isColorOverridden}
                onChange={handleColorChange}
                onReset={handleColorReset}
                title={`Color for ${lig.chemId}`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full border border-slate-200/80 flex-shrink-0"
                  style={{ backgroundColor: lig.color }}
                />
              </ColorSwatchPicker>
              <span className="font-mono font-semibold text-slate-800">{lig.chemId}</span>
              <span className="text-slate-400 text-[10px]">
                {lig.count} site{lig.count > 1 ? 's' : ''}
              </span>
            </div>
            {lig.ligandName && (
              <div className="mt-0.5 text-[10px] text-slate-500 leading-snug line-clamp-2">
                {lig.ligandName}
              </div>
            )}
            {lig.drugbankId && (
              <a
                href={`https://go.drugbank.com/drugs/${lig.drugbankId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-0.5 inline-block text-[10px] text-blue-500 hover:text-blue-700"
              >
                DrugBank · {lig.drugbankId}
              </a>
            )}
          </div>

          {/* Actions */}
          <div className="py-0.5">
            <ToolboxRow
              icon={moleculeVisible ? Eye : EyeOff}
              label="Show molecule"
              hint={`${uniqueKeys.length} instance${uniqueKeys.length > 1 ? 's' : ''}`}
              active={moleculeVisible}
              onClick={handleToggleMolecule}
            />
            <ToolboxRow
              icon={focusing ? Loader2 : isActiveBindingSite ? XCircle : Crosshair}
              label={isActiveBindingSite ? 'Hide binding site' : 'Show binding site'}
              hint={focusSite ? `chain ${focusSite.site.ligandChain}` : undefined}
              active={isActiveBindingSite}
              spin={focusing}
              onClick={handleToggleBindingSite}
              disabled={!focusSite || focusing}
            />
            <ToolboxRow
              icon={Tag}
              label="Show annotations"
              hint={lig.anyAnnotationVisible ? 'on' : 'off'}
              active={lig.anyAnnotationVisible}
              onClick={handleToggleAnnotations}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ToolboxRow({
  icon: Icon,
  label,
  hint,
  active = false,
  spin = false,
  disabled = false,
  onClick,
}: {
  icon: typeof Eye;
  label: string;
  hint?: string;
  active?: boolean;
  spin?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-[11px] transition-colors
        ${disabled
          ? 'text-slate-300 cursor-not-allowed'
          : active
            ? 'text-slate-900 font-medium hover:bg-slate-50'
            : 'text-slate-600 hover:bg-slate-50'}`}
    >
      <Icon size={12} className={spin ? 'animate-spin' : undefined} />
      <span className="flex-1 text-left">{label}</span>
      {hint && <span className="text-[9px] text-slate-400">{hint}</span>}
    </button>
  );
}
