// src/components/structure/ViewerToolbar.tsx
'use client';

import type { MolstarInstance } from '@/components/molstar/services/MolstarInstance';
import type { MolstarInstanceId } from '@/components/molstar/core/types';
import { Home, LayoutGrid, Mail, Focus } from 'lucide-react';
import type { StructureProfile } from '@/lib/profile_utils';
import {
  AppPill,
  PillDivider,
  PillIconButton,
  PillNavLink,
  PillAnchor,
  PillChatInput,
} from '@/components/ui/AppPill';
import { StructureSlugBlock } from './StructureSlugBlock';
import { PdbQuickPicker } from './PdbQuickPicker';

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

  return (
    <AppPill>
      {/* ── Left: breadcrumb ── */}
      <PillNavLink href="/" icon={Home} title="Home" />
      <PillNavLink href="/structures" icon={LayoutGrid} title="Structures" />
      <StructureSlugBlock
        loadedStructure={loadedStructure}
        profile={profile}
        highlighted
        title="Currently viewing"
      />

      <PillDivider />

      {/* ── Right: tools ── */}
      <PillIconButton
        icon={Focus}
        onClick={enterExpertMode}
        title={
          defaultMonomerChainId
            ? `Switch to expert mode (chain ${defaultMonomerChainId})`
            : 'Switch to expert mode'
        }
      />
      <PdbQuickPicker currentPdbId={loadedStructure} />
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
