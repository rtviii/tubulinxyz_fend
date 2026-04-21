'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { useAssistantTarget } from '@/components/assistant/AssistantTargetContext';

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
 * Cross-page chat input styled to live inside AppPill.
 *
 * When wrapped in an `AssistantTargetProvider` (see
 * `@/components/assistant/AssistantTargetContext`) the input is live: typing
 * and pressing Enter calls the provider's `handle(text)`. Without a
 * provider, it renders a disabled "soon" placeholder — same look as before.
 *
 * Feedback (summary / clarification / error) appears in a small popover
 * below the input.
 */
export function PillChatInput({
  placeholder,
  widthClass = 'w-40',
}: {
  placeholder?: string;
  widthClass?: string;
}) {
  const target = useAssistantTarget();
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [text, setText] = useState('');
  const [status, setStatus] = useState<
    | { kind: 'idle' }
    | { kind: 'loading' }
    | { kind: 'done'; summary: string }
    | { kind: 'clarify'; message: string }
    | { kind: 'error'; message: string }
  >({ kind: 'idle' });

  const abortRef = useRef<AbortController | null>(null);

  const dismiss = useCallback(() => {
    setStatus({ kind: 'idle' });
  }, []);

  // Dismiss feedback popover on outside click.
  useEffect(() => {
    if (status.kind === 'idle' || status.kind === 'loading') return;
    const onDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) dismiss();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [status.kind, dismiss]);

  useEffect(() => () => abortRef.current?.abort(), []);

  // Disabled fallback when no provider is attached on the current page.
  if (!target) {
    return (
      <div className={`relative ${widthClass} min-w-0`}>
        <input
          disabled
          placeholder={placeholder ?? 'Ask...'}
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

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed || status.kind === 'loading') return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus({ kind: 'loading' });
    try {
      const r = await target.handle(trimmed, controller.signal);
      if (controller.signal.aborted) return;
      if (r.error) setStatus({ kind: 'error', message: r.error });
      else if (r.clarification) setStatus({ kind: 'clarify', message: r.clarification });
      else setStatus({ kind: 'done', summary: r.summary ?? '' });
      setText('');
    } catch (e) {
      if (controller.signal.aborted) return;
      setStatus({
        kind: 'error',
        message: e instanceof Error ? e.message : String(e),
      });
    }
  };

  const loading = status.kind === 'loading';
  const showPopover = status.kind === 'done' || status.kind === 'clarify' || status.kind === 'error';

  return (
    <div ref={wrapperRef} className={`relative ${widthClass} min-w-0`}>
      <input
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder={placeholder ?? target.placeholder ?? 'Ask...'}
        disabled={loading}
        className="w-full h-7 rounded-full border border-slate-200/60 bg-white/90
                   px-3 pr-8 text-[11px]
                   text-slate-700 placeholder:text-slate-400
                   outline-none focus:border-indigo-400 focus:bg-white
                   disabled:opacity-60"
      />
      {loading && (
        <Loader2
          size={12}
          className="absolute right-2 top-1/2 -translate-y-1/2 animate-spin text-indigo-500 pointer-events-none"
        />
      )}
      {showPopover && (
        <div
          className="absolute left-0 top-[calc(100%+4px)] z-50 min-w-full max-w-[320px]
                     rounded-md border shadow-md px-2.5 py-1.5 text-[11px]
                     bg-white"
          style={{
            borderColor:
              status.kind === 'error'
                ? 'rgb(254 202 202)'
                : status.kind === 'clarify'
                  ? 'rgb(253 230 138)'
                  : 'rgb(199 210 254)',
            color:
              status.kind === 'error'
                ? 'rgb(185 28 28)'
                : status.kind === 'clarify'
                  ? 'rgb(146 64 14)'
                  : 'rgb(55 65 81)',
            backgroundColor:
              status.kind === 'error'
                ? 'rgb(254 242 242)'
                : status.kind === 'clarify'
                  ? 'rgb(255 251 235)'
                  : 'rgb(238 242 255 / 0.6)',
          }}
        >
          {status.kind === 'error' && <span>Error: {status.message}</span>}
          {status.kind === 'clarify' && <span>{status.message}</span>}
          {status.kind === 'done' && (
            <span>{status.summary || 'Done.'}</span>
          )}
        </div>
      )}
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
