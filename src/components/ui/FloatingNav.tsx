'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const FEEDBACK_EMAIL = 'feedback@tube.xyz'; // <-- replace with your actual email

function NavIcon({ d, label }: { d: string; label: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="w-4 h-4"
      aria-label={label}
    >
      <path d={d} />
    </svg>
  );
}

// Minimal inline SVG paths (heroicons/mini style)
const ICONS = {
  home: 'M9.293 2.293a1 1 0 0 1 1.414 0l7 7A1 1 0 0 1 17 11h-1v6a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-6H3a1 1 0 0 1-.707-1.707l7-7Z',
  grid: 'M2 4.75A2.75 2.75 0 0 1 4.75 2h2.5A2.75 2.75 0 0 1 10 4.75v2.5A2.75 2.75 0 0 1 7.25 10h-2.5A2.75 2.75 0 0 1 2 7.25v-2.5Zm8 0A2.75 2.75 0 0 1 12.75 2h2.5A2.75 2.75 0 0 1 18 4.75v2.5A2.75 2.75 0 0 1 15.25 10h-2.5A2.75 2.75 0 0 1 10 7.25v-2.5ZM2 12.75A2.75 2.75 0 0 1 4.75 10h2.5A2.75 2.75 0 0 1 10 12.75v2.5A2.75 2.75 0 0 1 7.25 18h-2.5A2.75 2.75 0 0 1 2 15.25v-2.5Zm8 0A2.75 2.75 0 0 1 12.75 10h2.5A2.75 2.75 0 0 1 18 12.75v2.5A2.75 2.75 0 0 1 15.25 18h-2.5A2.75 2.75 0 0 1 10 15.25v-2.5Z',
  mail: 'M3 4a2 2 0 0 0-2 2v1.161l8.441 4.221a1.25 1.25 0 0 0 1.118 0L19 7.162V6a2 2 0 0 0-2-2H3Zm16 4.839-7.831 3.916a2.75 2.75 0 0 1-2.338 0L1 8.839V14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.839Z',
};

export function FloatingNav() {
  const pathname = usePathname();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');

  const navItems = [
    { href: '/', icon: ICONS.home, label: 'Home' },
    { href: '/structures', icon: ICONS.grid, label: 'Structures' },
  ];

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

      {/* Nav pill */}
      <div
        className="flex items-center gap-1 rounded-full border border-slate-200 bg-white/90
                    backdrop-blur-sm shadow-md px-1.5 py-1.5"
      >
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
                transition-colors
                ${active
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                }
              `}
            >
              <NavIcon d={item.icon} label={item.label} />
              <span>{item.label}</span>
            </Link>
          );
        })}

        <div className="w-px h-5 bg-slate-200 mx-0.5" />

        <button
          onClick={() => setFeedbackOpen((o) => !o)}
          title="Send feedback"
          className={`
            flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
            transition-colors
            ${feedbackOpen
              ? 'bg-slate-800 text-white'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
            }
          `}
        >
          <NavIcon d={ICONS.mail} label="Feedback" />
          <span>Feedback</span>
        </button>
      </div>
    </div>
  );
}