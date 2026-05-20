'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Mail } from 'lucide-react';
import { AppPill, PillDivider } from './AppPill';
import { GlobalNav } from './GlobalNav';

const FEEDBACK_EMAIL = 'feedback@tube.xyz'; // <-- replace with your actual email

export function FloatingNav() {
  const pathname = usePathname();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');

  // Hide on pages that render the unified nav inline (landing, catalogue,
  // structure detail).
  if (pathname === '/' || pathname === '/structures' || pathname.match(/^\/structures\/[^/]+$/)) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {/* Feedback form (expandable) */}
      {feedbackOpen && (
        <div className="w-72 rounded-lg border border-slate-200 bg-white shadow-lg p-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-700">Send feedback</span>
            <button
              onClick={() => setFeedbackOpen(false)}
              className="text-slate-400 hover:text-slate-600 text-xs"
            >
              close
            </button>
          </div>
          <textarea
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            placeholder="Bug reports, feature requests, questions..."
            rows={3}
            className="w-full text-sm border border-slate-200 rounded-md p-2 resize-none
                       focus:outline-none focus:border-slate-400 text-slate-700
                       placeholder:text-slate-400"
          />
          <a
            href={`mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(
              'tube.xyz feedback'
            )}&body=${encodeURIComponent(feedbackText)}`}
            onClick={() => {
              setFeedbackOpen(false);
              setFeedbackText('');
            }}
            className="mt-2 block w-full text-center text-xs font-medium py-1.5 rounded-md
                       bg-slate-800 text-white hover:bg-slate-700 transition-colors"
          >
            Open in mail client
          </a>
        </div>
      )}

      {/* Unified nav pill */}
      <AppPill className="shadow-md">
        <GlobalNav />
        <PillDivider />
        <button
          onClick={() => setFeedbackOpen((o) => !o)}
          title="Send feedback"
          type="button"
          className={`flex items-center gap-1 px-1.5 py-1.5 rounded-full transition-colors
            ${feedbackOpen
              ? 'text-slate-700 bg-slate-100/70'
              : 'text-slate-400 hover:text-slate-700'
            }`}
        >
          <Mail size={13} />
          <span className="font-medium pr-1">Feedback</span>
        </button>
      </AppPill>
    </div>
  );
}
