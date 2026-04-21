'use client';

import React from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

/**
 * Shared floating-pill shell used across landing, catalogue, and structure pages.
 * Contents are supplied as children; callers typically interleave sections with
 * <PillDivider/>. Outer layout (inline / floating / stretched row) is the caller's
 * responsibility — AppPill only owns the visual shell.
 */
export function AppPill({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center gap-0 px-1 py-0.5
                  rounded-full bg-white/80 backdrop-blur border border-slate-200/60
                  shadow-sm text-[11px] ${className}`}
    >
      {children}
    </div>
  );
}

export function PillDivider() {
  return <div className="w-px h-4 bg-slate-200 mx-0.5" />;
}

/**
 * Section wrapper for logical groupings inside a pill (left / center / right clusters).
 * `stretch` lets the section expand to fill available space (used for wide search inputs).
 */
export function PillSection({
  children,
  className = '',
  stretch = false,
}: {
  children: React.ReactNode;
  className?: string;
  stretch?: boolean;
}) {
  return (
    <div
      className={`flex items-center ${stretch ? 'flex-1 min-w-0' : ''} ${className}`}
    >
      {children}
    </div>
  );
}

export function PillIconButton({
  icon: Icon,
  onClick,
  active = false,
  title,
  size = 13,
  activeClassName = 'text-blue-500',
  inactiveClassName = 'text-slate-400 hover:text-slate-700',
}: {
  icon: LucideIcon;
  onClick?: () => void;
  active?: boolean;
  title?: string;
  size?: number;
  activeClassName?: string;
  inactiveClassName?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`p-1.5 rounded-full transition-colors ${
        active ? activeClassName : inactiveClassName
      }`}
      title={title}
      type="button"
    >
      <Icon size={size} />
    </button>
  );
}

export function PillNavLink({
  href,
  icon: Icon,
  label,
  title,
  active = false,
  size = 13,
}: {
  href: string;
  icon: LucideIcon;
  label?: string;
  title?: string;
  active?: boolean;
  size?: number;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-1 px-1.5 py-1.5 rounded-full transition-colors ${
        active
          ? 'text-slate-700 bg-slate-100/70'
          : 'text-slate-400 hover:text-slate-700'
      }`}
      title={title}
    >
      <Icon size={size} />
      {label && <span className="font-medium pr-1">{label}</span>}
    </Link>
  );
}

/**
 * Non-link breadcrumb/current-page element — matches the "active" styling of
 * PillNavLink (gray bg) but doesn't navigate. Used for the current-page entry
 * in the implicit hierarchy (e.g. structure slug on structure pages).
 */
export function PillCrumb({
  children,
  onClick,
  title,
  highlighted = true,
  className = '',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  title?: string;
  highlighted?: boolean;
  className?: string;
}) {
  const base = 'flex items-center gap-1 px-2 py-1 rounded-full transition-colors';
  const tone = highlighted
    ? 'text-slate-700 bg-slate-100/70'
    : 'text-slate-500 hover:text-slate-700';
  if (onClick) {
    return (
      <button type="button" onClick={onClick} title={title} className={`${base} ${tone} ${className}`}>
        {children}
      </button>
    );
  }
  return (
    <div title={title} className={`${base} ${tone} ${className}`}>
      {children}
    </div>
  );
}

/**
 * Short disabled chat input styled to live inside AppPill.
 * Used on landing, catalogue, and structure pages as an AI-assistant placeholder.
 */
export function PillChatInput({
  placeholder = 'Ask...',
  widthClass = 'w-40',
}: {
  placeholder?: string;
  widthClass?: string;
}) {
  return (
    <div className={`relative ${widthClass} min-w-0`}>
      <input
        disabled
        placeholder={placeholder}
        className="w-full h-7 rounded-full border border-slate-200/60 bg-white/60
                   px-3 pr-14 text-[11px]
                   text-slate-400 placeholder:text-slate-400"
      />
      <span
        className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-slate-300
                   tracking-wider font-medium uppercase pointer-events-none"
      >
        soon
      </span>
    </div>
  );
}

/**
 * Anchor variant (for mailto:, external links, etc.) matching PillNavLink styling.
 */
export function PillAnchor({
  href,
  icon: Icon,
  label,
  title,
  size = 13,
  external = false,
}: {
  href: string;
  icon: LucideIcon;
  label?: string;
  title?: string;
  size?: number;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className="flex items-center gap-1 px-1.5 py-1.5 rounded-full text-slate-400 hover:text-slate-700 transition-colors"
      title={title}
    >
      <Icon size={size} />
      {label && <span className="font-medium pr-1">{label}</span>}
    </a>
  );
}
