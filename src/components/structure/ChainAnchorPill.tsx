'use client';

import { useMemo } from 'react';
import { useAppSelector } from '@/store/store';
import {
  selectAllLigandsDetailed,
  selectLigandsForChain,
  type DetailedLigandInfo,
} from '@/store/slices/annotationsSlice';
import { LIGAND_IGNORE_IDS } from '@/components/molstar/colors/palette';
import { getFamilyForChain, getIsotypeForChain } from '@/lib/profile_utils';
import { formatFamilyShort } from '@/lib/formatters';
import type { StructureProfile } from '@/lib/profile_utils';
import type { MolstarInstance } from '@/components/molstar/services/MolstarInstance';
import type { PolymerComponent } from '@/components/molstar/core/types';
import type { MSAHandle } from '@/components/msa/types';
import { makeChainKey } from '@/lib/chain_key';
import { StructureSlugBlock } from './StructureSlugBlock';
import { PillChatInput } from '@/components/ui/AppPill';
import { LigandPillToolbox } from './LigandPillToolbox';
import { PolymerFamilyToolbox, groupChainsByEntity } from './PolymerFamilyToolbox';
import type { ActiveBindingSite } from './BindingSiteCard';

interface ChainAnchorPillProps {
  loadedStructure: string | null;
  profile: StructureProfile | null;
  polymerComponents: PolymerComponent[];
  instance: MolstarInstance | null;
  activeChainId: string | null;
  isMonomerView: boolean;
  msaRef: React.RefObject<MSAHandle>;
  activeBindingSite: ActiveBindingSite | null;
  onActivateBindingSite: (target: Omit<ActiveBindingSite, 'contacts'>) => Promise<void> | void;
  onDeactivateBindingSite: () => Promise<void> | void;
}

export function ChainAnchorPill({
  loadedStructure,
  profile,
  polymerComponents,
  instance,
  activeChainId,
  isMonomerView,
  msaRef,
  activeBindingSite,
  onActivateBindingSite,
  onDeactivateBindingSite,
}: ChainAnchorPillProps) {
  // Ligand selection scope:
  // - expert mode (monomer): ligands associated with the active chain
  // - easy mode (structure): all ligands across the structure
  const activeChainKey = useMemo(
    () => (isMonomerView && loadedStructure && activeChainId
      ? makeChainKey(loadedStructure, activeChainId)
      : null),
    [isMonomerView, loadedStructure, activeChainId]
  );

  const chainScopedLigands = useAppSelector(state =>
    activeChainKey ? selectLigandsForChain(state, activeChainKey) : []
  );
  const allLigands = useAppSelector(selectAllLigandsDetailed);

  const visibleLigands: DetailedLigandInfo[] = useMemo(() => {
    const source = isMonomerView ? chainScopedLigands : allLigands;
    return source.filter(l => !LIGAND_IGNORE_IDS.has(l.chemId));
  }, [isMonomerView, chainScopedLigands, allLigands]);

  // Polymer entity groups — only surfaced in easy mode (in expert mode the
  // header already carries a chain switcher for the active chain).
  const entityGroups = useMemo(
    () => (isMonomerView ? [] : groupChainsByEntity(polymerComponents, profile)),
    [isMonomerView, polymerComponents, profile]
  );

  const chainBadgeLabel = useMemo(() => {
    if (!isMonomerView || !activeChainId) return null;
    const isotype = getIsotypeForChain(profile, activeChainId);
    if (isotype) return isotype;
    const family = getFamilyForChain(profile, activeChainId);
    return family ? formatFamilyShort(family) : null;
  }, [profile, activeChainId, isMonomerView]);

  const exitToEasy = isMonomerView ? () => instance?.exitMonomerView() : undefined;
  const showChainSwitcher = isMonomerView && polymerComponents.length > 1;
  const showChipTray = entityGroups.length > 0 || visibleLigands.length > 0;
  const chatPlaceholder = isMonomerView
    ? 'Ask about this chain...'
    : 'Ask about this structure...';

  return (
    <div
      className="flex flex-col gap-1 px-2 py-1.5
                 rounded-2xl bg-white/80 backdrop-blur border border-slate-200/60
                 shadow-sm text-[11px] min-w-[14rem] max-w-[22rem]"
    >
      {/* ── Header: slug + chain badge + chain switcher ── */}
      <div className="flex items-center gap-1 min-w-0">
        <StructureSlugBlock
          loadedStructure={loadedStructure}
          profile={profile}
          onClick={exitToEasy}
          title={exitToEasy ? 'Back to structure (easy mode)' : 'Currently viewing'}
          highlighted={!isMonomerView}
        />

        {isMonomerView && activeChainId && (
          <div className="flex items-baseline gap-1 px-1.5 py-1 rounded-full bg-slate-100/70 text-slate-700">
            <span className="text-slate-400">/</span>
            <span className="font-mono font-semibold text-[11px]">{activeChainId}</span>
            {chainBadgeLabel && (
              <span className="text-[9px] px-1 py-px bg-slate-50 text-slate-600 rounded">
                {chainBadgeLabel}
              </span>
            )}
          </div>
        )}

        {showChainSwitcher && (
          <div className="ml-auto flex items-center gap-0.5 flex-shrink-0">
            {polymerComponents.map(chain => (
              <button
                key={chain.chainId}
                onClick={() => {
                  if (chain.chainId !== activeChainId) instance?.switchMonomerChain(chain.chainId);
                }}
                className={`w-5 h-5 text-[10px] font-mono rounded ${
                  chain.chainId === activeChainId
                    ? 'bg-slate-700 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
                title={`Switch to chain ${chain.chainId}`}
              >
                {chain.chainId}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Combined tray: polymer family chips (easy) + ligand chips ── */}
      {showChipTray && (
        <div className="flex flex-wrap gap-1 items-center">
          {entityGroups.map(g => (
            <PolymerFamilyToolbox
              key={g.entityId}
              group={g}
              loadedStructure={loadedStructure}
              instance={instance}
            />
          ))}
          {visibleLigands.map(lig => (
            <LigandPillToolbox
              key={lig.chemId}
              lig={lig}
              activeChainId={isMonomerView ? activeChainId : null}
              instance={instance}
              msaRef={msaRef}
              activeBindingSite={activeBindingSite}
              onActivateBindingSite={onActivateBindingSite}
              onDeactivateBindingSite={onDeactivateBindingSite}
            />
          ))}
        </div>
      )}

      {/* ── Chat input (both modes, structure-wide in easy, chain-scoped in expert) ── */}
      <div className="flex">
        <PillChatInput placeholder={chatPlaceholder} widthClass="w-full" />
      </div>
    </div>
  );
}
