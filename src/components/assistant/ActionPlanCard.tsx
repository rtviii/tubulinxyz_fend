'use client';

// A roomy "here's what I can do for you" offer: a short title + optional
// subtitle, then a VISIBLE list of the concrete steps that will run, then one
// primary call-to-action. Replaces the cramped CardChip on the landing page,
// where a single opaque chip hid the fact that one click is really a chain
// ("open expert mode → align bovine → focus the taxol site"). Multiple offers
// stack vertically. The whole card is the click target (steps are descriptive,
// not interactive), dimmed + non-clickable when `disabled`.

import type { ReactNode } from 'react';
import { ArrowRight, type LucideIcon } from 'lucide-react';
import { API_BASE_URL } from '@/config';

export interface PlanStep {
  icon: LucideIcon;
  label: string;
  detail?: string;
  tone?: string; // optional tailwind text color for the icon, e.g. 'text-emerald-500'
}

export interface ActionPlanCardProps {
  title: string;
  subtitle?: string;
  steps: PlanStep[];
  cta: string;
  disabled?: boolean;
  reason?: string;
  onRun: () => void;
  // Structure thumbnail shown at a real, legible size (not the old 20px corner).
  thumbnailRcsbId?: string;
  // Small uppercase tag + its tone, e.g. { label: 'Expert mode', tone: '...' }.
  tag?: { label: string; tone: string; Icon?: LucideIcon };
  // Optional extra content under the steps (e.g. a live catalogue count).
  extra?: ReactNode;
}

export function ActionPlanCard({
  title,
  subtitle,
  steps,
  cta,
  disabled = false,
  reason,
  onRun,
  thumbnailRcsbId,
  tag,
  extra,
}: ActionPlanCardProps) {
  const multi = steps.length > 1;

  return (
    <button
      type="button"
      onClick={onRun}
      disabled={disabled}
      title={disabled ? reason : undefined}
      className={`
        group w-full text-left rounded-xl border bg-white overflow-hidden transition-all
        ${disabled
          ? 'border-slate-100 opacity-60 cursor-not-allowed'
          : 'border-slate-200 hover:border-slate-400 hover:shadow-md cursor-pointer'
        }
      `}
    >
      <div className="p-3 flex gap-3">
        {thumbnailRcsbId && (
          <div className="relative flex-shrink-0 w-16 h-16 rounded-lg bg-gradient-to-br from-slate-50 to-slate-100 overflow-hidden border border-slate-200/70">
            <img
              src={`${API_BASE_URL}/structures/${thumbnailRcsbId}/thumbnail`}
              alt={thumbnailRcsbId}
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            <div className="absolute bottom-0 inset-x-0 bg-black/65 text-white text-[8px] font-mono font-bold px-1 py-px text-center tracking-wider">
              {thumbnailRcsbId}
            </div>
          </div>
        )}

        <div className="flex-1 min-w-0">
          {/* Header: tag + title + subtitle (no clamp — wraps freely) */}
          <div className="flex items-center gap-1.5 mb-0.5">
            {tag && (
              <span className={`inline-flex items-center gap-0.5 px-1 py-px text-[8px] uppercase tracking-wider font-medium rounded border flex-shrink-0 ${tag.tone}`}>
                {tag.Icon && <tag.Icon size={8} />}
                {tag.label}
              </span>
            )}
            {disabled && reason && (
              <span className="text-[9px] text-amber-500 italic truncate" title={reason}>{reason}</span>
            )}
          </div>
          <div className="text-[13px] font-semibold text-slate-800 leading-snug">{title}</div>
          {subtitle && <div className="text-[11px] text-slate-500 leading-snug mt-0.5">{subtitle}</div>}

          {/* Steps — the visible chain */}
          {steps.length > 0 && (
            <ul className="mt-2 space-y-1">
              {steps.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-[11px] text-slate-600">
                  <span className="flex-shrink-0 flex items-center gap-1 mt-px">
                    {multi && (
                      <span className="inline-grid place-items-center w-3.5 h-3.5 rounded-full bg-slate-100 text-slate-500 text-[8px] font-mono font-semibold">
                        {i + 1}
                      </span>
                    )}
                    <s.icon size={12} className={s.tone ?? 'text-slate-400'} />
                  </span>
                  <span className="min-w-0">
                    <span className="font-medium text-slate-700">{s.label}</span>
                    {s.detail && <span className="text-slate-400 font-mono"> {s.detail}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {extra && <div className="mt-2">{extra}</div>}
        </div>
      </div>

      {/* CTA footer */}
      {!disabled && (
        <div className="px-3 py-1.5 border-t border-slate-100 bg-slate-50/60 flex items-center justify-end gap-1 text-[11px] font-medium text-slate-500 group-hover:text-slate-800 transition-colors">
          {cta}
          <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
        </div>
      )}
    </button>
  );
}
