'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { X } from 'lucide-react';
import {
  useAssistantTarget,
  type AssistantConfirmPayload,
} from '@/components/assistant/AssistantTargetContext';

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
    | { kind: 'confirm'; payload: AssistantConfirmPayload }
    | { kind: 'applying' }
  >({ kind: 'idle' });

  const abortRef = useRef<AbortController | null>(null);

  const dismiss = useCallback(() => {
    setStatus(prev => {
      // Outside-click on a confirm panel counts as a Cancel.
      if (prev.kind === 'confirm') prev.payload.onCancel?.();
      return { kind: 'idle' };
    });
  }, []);

  // Dismiss feedback popover on outside click. Skip while loading/applying so
  // we don't tear down a request that's still in flight.
  useEffect(() => {
    if (status.kind === 'idle' || status.kind === 'loading' || status.kind === 'applying') return;
    const onDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) dismiss();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [status.kind, dismiss]);

  // Auto-dismiss the success popover after a short delay.
  useEffect(() => {
    if (status.kind !== 'done') return;
    const t = setTimeout(() => setStatus({ kind: 'idle' }), 1800);
    return () => clearTimeout(t);
  }, [status.kind]);

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
      else if (r.confirm) {
        setStatus({ kind: 'confirm', payload: r.confirm });
        // Keep `text` populated so the user can tweak & resubmit on cancel.
        return;
      }
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

  const handleApply = async () => {
    if (status.kind !== 'confirm') return;
    const payload = status.payload;
    setStatus({ kind: 'applying' });
    try {
      await payload.onApply();
      setStatus({ kind: 'done', summary: payload.summary || 'Filters applied.' });
      setText('');
    } catch (e) {
      setStatus({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  };

  const handleCancel = () => {
    if (status.kind !== 'confirm') return;
    status.payload.onCancel?.();
    setStatus({ kind: 'idle' });
  };

  const loading = status.kind === 'loading' || status.kind === 'applying';
  const showPopover = status.kind === 'done' || status.kind === 'clarify' || status.kind === 'error';
  const showConfirm = status.kind === 'confirm';

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
        className={`w-full h-7 rounded-full bg-white/90
                   px-3 pr-9 text-[11px]
                   text-slate-700 placeholder:text-slate-400
                   outline-none focus:bg-white
                   transition-colors
                   ${loading
                     ? 'border border-indigo-300 bg-indigo-50/40'
                     : 'border border-slate-200/60 focus:border-indigo-400'}`}
      />
      {loading && (
        <span
          className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-end gap-[3px] pointer-events-none"
          aria-label={status.kind === 'applying' ? 'Applying' : 'Thinking'}
        >
          <span
            className="w-[3px] h-[3px] rounded-full bg-indigo-500 animate-bounce"
            style={{ animationDelay: '0ms', animationDuration: '0.9s' }}
          />
          <span
            className="w-[3px] h-[3px] rounded-full bg-indigo-500 animate-bounce"
            style={{ animationDelay: '140ms', animationDuration: '0.9s' }}
          />
          <span
            className="w-[3px] h-[3px] rounded-full bg-indigo-500 animate-bounce"
            style={{ animationDelay: '280ms', animationDuration: '0.9s' }}
          />
        </span>
      )}
      {showConfirm && status.kind === 'confirm' && (
        <div
          className="absolute left-0 top-[calc(100%+6px)] z-[100]
                     min-w-full w-[420px] max-w-[calc(100vw-2rem)]
                     rounded-lg border border-slate-200 bg-white shadow-lg
                     text-[11px] text-slate-700"
        >
          <div className="flex items-start justify-between px-3 pt-2.5 pb-1">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Apply these filters?
            </div>
            <button
              type="button"
              onClick={handleCancel}
              className="text-slate-400 hover:text-slate-700 -mr-1 -mt-0.5 p-0.5 rounded"
              title="Cancel"
            >
              <X size={12} />
            </button>
          </div>
          {status.payload.items.length > 0 && (
            <div className="mx-3 mt-1 mb-2 rounded border border-slate-100 bg-slate-50/60 divide-y divide-slate-100">
              {status.payload.items.map((item, i) => (
                <div
                  key={i}
                  className="flex items-baseline gap-2 px-2 py-1.5 text-[11px]"
                >
                  <span className="text-slate-500 shrink-0">{item.label}</span>
                  <span className="text-slate-800 font-medium break-words text-right ml-auto">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center justify-end gap-2 px-3 pb-2.5 pt-1 border-t border-slate-100">
            <button
              type="button"
              onClick={handleCancel}
              className="px-2.5 py-1 rounded text-[11px] text-slate-600 hover:bg-slate-100 transition-colors"
            >
              {status.payload.cancelLabel ?? 'Cancel'}
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-2.5 py-1 rounded text-[11px] text-white bg-indigo-500 hover:bg-indigo-600 transition-colors"
            >
              {status.payload.applyLabel ?? 'Apply'}
            </button>
          </div>
        </div>
      )}
      {showPopover && (
        <div
          className="absolute left-0 top-[calc(100%+4px)] z-[100] min-w-full max-w-[320px]
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
