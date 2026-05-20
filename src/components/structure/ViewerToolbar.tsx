// src/components/structure/ViewerToolbar.tsx
'use client';

import type { MolstarInstance } from '@/components/molstar/services/MolstarInstance';
import type { MolstarInstanceId } from '@/components/molstar/core/types';
import { Mail } from 'lucide-react';
import type { StructureProfile } from '@/lib/profile_utils';
import {
  AppPill,
  PillDivider,
  PillAnchor,
  PillChatInput,
} from '@/components/ui/AppPill';
import { GlobalNav } from '@/components/ui/GlobalNav';
import { StructureSlugBlock } from './StructureSlugBlock';
import { PdbQuickPicker } from './PdbQuickPicker';
import { useAppSelector } from '@/store/store';
import { selectExpertHintActive } from '@/store/slices/chainFocusSlice';

interface ViewerToolbarProps {
  instanceId: MolstarInstanceId;
  instance: MolstarInstance | null;
  loadedStructure: string | null;
  profile: StructureProfile | null;
  /** Primary chain id to enter monomer view with when the user clicks "to expert". */
  defaultMonomerChainId?: string | null;
}

/**
 * Easy-mode pill (viewMode === 'structure', whole-structure view).
 *
 * Layout:
 *   [ Home · Structures · ( PDB + species, highlighted = current ) ]
 *   |  Focus(→expert) · PdbQuickPicker · chat · feedback
 */
export function ViewerToolbar({
  instance,
  loadedStructure,
  profile,
  defaultMonomerChainId,
}: ViewerToolbarProps) {
  const enterExpertMode = () => {
    if (defaultMonomerChainId) instance?.enterMonomerView(defaultMonomerChainId);
  };
  const expertHintActive = useAppSelector(selectExpertHintActive);

  return (
    <AppPill>
      {/* ── Left: unified nav (Easy/Expert toggle this structure) + breadcrumb ── */}
      <GlobalNav
        mode={{
          active: 'easy',
          onEasy: () => {},
          onExpert: enterExpertMode,
          expertDisabled: !defaultMonomerChainId,
          expertHint: expertHintActive,
        }}
      />

      <PillDivider />

      <StructureSlugBlock
        loadedStructure={loadedStructure}
        profile={profile}
        highlighted
        title="Currently viewing"
      />
      <PdbQuickPicker currentPdbId={loadedStructure} />

      <PillDivider />

      {/* ── Right: tools ── */}
      <PillChatInput placeholder="Ask about this structure..." widthClass="w-56" />

      <PillDivider />

      <PillAnchor
        href="mailto:feedback@tube.xyz?subject=tube.xyz%20feedback"
        icon={Mail}
        title="Send feedback"
      />
    </AppPill>
  );
}
