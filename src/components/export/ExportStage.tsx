'use client';

import React, { forwardRef, ReactNode } from 'react';

export interface ExportAction {
  label: string;
  onClick: () => void | Promise<void>;
}

const CHECKER = 'repeating-conic-gradient(#e5e7eb 0% 25%, #ffffff 0% 50%) 50% / 22px 22px';

interface ExportStageProps {
  actions: ExportAction[];
  /** explicit capture-region size in px; omit to fit content */
  width?: number;
  height?: number;
  /** backdrop behind the (transparent) capture region */
  backdrop?: 'checker' | 'white' | 'dark';
  /** padding inside the capture region */
  pad?: number;
  children: ReactNode;
}

/** Chromeless stage for rendering one component in isolation for asset export.
 *  The floating toolbar sits OUTSIDE the captured region (the forwarded ref), so
 *  html-to-image captures only the component. The capture region is transparent;
 *  the backdrop sits behind it to visualize transparency and give contrast. */
export const ExportStage = forwardRef<HTMLDivElement, ExportStageProps>(
  function ExportStage({ actions, width, height, backdrop = 'checker', pad = 0, children }, ref) {
    const bg = backdrop === 'checker' ? CHECKER : backdrop === 'dark' ? '#0b0b0c' : '#ffffff';
    return (
      <div className="min-h-screen w-full flex items-center justify-center" style={{ background: bg }}>
        {/* Toolbar — not part of the captured node */}
        <div className="fixed top-3 left-3 z-50 flex flex-wrap gap-2">
          {actions.map((a) => (
            <button
              key={a.label}
              onClick={a.onClick}
              className="px-3 py-1.5 rounded-md bg-black/80 text-white text-xs font-medium shadow hover:bg-black"
            >
              {a.label}
            </button>
          ))}
        </div>

        {/* Capture region — transparent; this is what the helpers grab */}
        <div
          ref={ref}
          style={{
            width: width ? `${width}px` : undefined,
            height: height ? `${height}px` : undefined,
            padding: pad ? `${pad}px` : undefined,
            background: 'transparent',
          }}
        >
          {children}
        </div>
      </div>
    );
  },
);
