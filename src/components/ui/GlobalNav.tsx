'use client';

import type { LucideIcon } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { Home, LayoutGrid, Eye, Microscope } from 'lucide-react';
import { PillNavLink, PillDivider } from './AppPill';
import { buildStructureUrl } from '@/lib/url_state';

// Structure the landing / chrome Easy & Expert buttons open directly. The
// tubulin heterodimer shown on the landing page. Change here if a different
// showcase structure is preferred (must exist in the catalogue).
const FEATURED = { rcsbId: '9MLF', chain: 'A' };

const EASY_HREF = buildStructureUrl(FEATURED.rcsbId, { mode: 'structure' });
const EXPERT_HREF = buildStructureUrl(FEATURED.rcsbId, { mode: 'monomer', chain: FEATURED.chain });

/**
 * Contextual mode control. When supplied (e.g. on a structure-detail page),
 * Easy/Expert become buttons that switch the *current* structure's view
 * instead of links to the featured showcase structure.
 */
export interface GlobalNavMode {
  active: 'easy' | 'expert';
  onEasy: () => void;
  onExpert: () => void;
  // Expert view needs a target chain; disable when none is available.
  expertDisabled?: boolean;
  // Tooltip for the Expert button — used to disclaim *why* it's disabled
  // (e.g. no alpha/beta chain with an alignment in this structure).
  expertTitle?: string;
  // Draw attention to Expert (e.g. while hovering chain-row entry points).
  expertHint?: boolean;
}

interface GlobalNavProps {
  mode?: GlobalNavMode;
}

// Button styled to match PillNavLink, used for the contextual Easy/Expert
// mode toggles.
function PillModeButton({
  icon: Icon,
  label,
  title,
  active,
  hint = false,
  disabled = false,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  title?: string;
  active: boolean;
  hint?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`flex items-center gap-1 px-1.5 py-1.5 rounded-full transition-colors
        disabled:opacity-40 disabled:cursor-not-allowed
        ${active
          ? 'text-slate-700 bg-slate-100/70'
          : hint
            ? 'bg-blue-50 text-blue-600'
            : 'text-slate-400 hover:text-slate-700'
        }`}
    >
      <Icon size={13} />
      <span className="font-medium pr-1">{label}</span>
    </button>
  );
}

/**
 * Unified site-navigation cluster — the same hierarchical menu used across
 * pages: Home · Structures catalogue | Easy mode · Expert mode. Returns a
 * fragment of pill items, so wrap it in <AppPill> at the call site.
 *
 * Pass `mode` on structure-detail pages to make Easy/Expert toggle the current
 * structure's view; omit it elsewhere to link to the featured structure.
 */
export function GlobalNav({ mode }: GlobalNavProps) {
  const pathname = usePathname();
  return (
    <>
      <PillNavLink href="/" icon={Home} label="Home" title="Home" active={pathname === '/'} />
      <PillNavLink
        href="/structures"
        icon={LayoutGrid}
        label="Structures catalogue"
        title="Browse the tubulin structure catalogue"
        active={pathname === '/structures'}
      />
      <PillDivider />
      {mode ? (
        <>
          <PillModeButton
            icon={Eye}
            label="Easy mode"
            title="Whole-structure (easy) view"
            active={mode.active === 'easy'}
            onClick={mode.onEasy}
          />
          <PillModeButton
            icon={Microscope}
            label="Expert mode"
            title={mode.expertTitle ?? 'Chain-level (expert) view'}
            active={mode.active === 'expert'}
            hint={mode.expertHint}
            disabled={mode.expertDisabled}
            onClick={mode.onExpert}
          />
        </>
      ) : (
        <>
          <PillNavLink
            href={EASY_HREF}
            icon={Eye}
            label="Easy mode"
            title="Open a featured structure in easy mode"
          />
          <PillNavLink
            href={EXPERT_HREF}
            icon={Microscope}
            label="Expert mode"
            title="Open a featured structure in expert (chain) mode"
          />
        </>
      )}
    </>
  );
}
