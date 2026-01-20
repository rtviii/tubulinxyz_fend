// src/app/msalite/components/ResizableMSAContainer.tsx
'use client';

import { useEffect, useLayoutEffect, useRef, useState, forwardRef, useImperativeHandle, useCallback } from 'react';

interface SequenceData {
  id: string;
  name: string;
  sequence: string;
}

interface ResizableMSAContainerProps {
  sequences: SequenceData[];
  maxLength: number;
  colorScheme?: string;
  minTileWidth?: number;
  rowHeight?: number;
  navHeight?: number;
  maxMsaHeight?: number;
  onResidueHover?: (seqId: string, position: number) => void;
  onResidueLeave?: () => void;
  onResidueClick?: (seqId: string, position: number) => void;
}

export interface ResizableMSAContainerHandle {
  redraw: () => void;
  jumpToRange: (start: number, end: number) => void;
  setColorScheme: (scheme: string) => void;
}

const DEFAULTS = {
  minTileWidth: 1,
  navHeight: 60,
  rowHeight: 20,
  maxMsaHeight: 800,
};

// Estimate label width from longest name
function calculateLabelWidth(sequences: SequenceData[]): number {
  if (sequences.length === 0) return 80;
  const longest = Math.max(...sequences.map(s => s.name.length));
  // ~7px per char + padding
  return Math.max(80, Math.min(200, longest * 7 + 16));
}

export const ResizableMSAContainer = forwardRef<ResizableMSAContainerHandle, ResizableMSAContainerProps>(
  function ResizableMSAContainer(props, ref) {
    const {
      sequences,
      maxLength,
      colorScheme = 'clustal2',
      minTileWidth = DEFAULTS.minTileWidth,
      rowHeight = DEFAULTS.rowHeight,
      navHeight = DEFAULTS.navHeight,
      maxMsaHeight = DEFAULTS.maxMsaHeight,
      onResidueHover,
      onResidueLeave,
      onResidueClick,
    } = props;

    const outerRef = useRef<HTMLDivElement>(null);
    const labelsRef = useRef<HTMLDivElement>(null);
    const msaRef = useRef<any>(null);
    const navRef = useRef<any>(null);

    const [availableWidth, setAvailableWidth] = useState(0);
    const [isInitialized, setIsInitialized] = useState(false);

    const labelWidth = calculateLabelWidth(sequences);

    useEffect(() => {
      const el = outerRef.current;
      if (!el) return;

      const observer = new ResizeObserver((entries) => {
        const width = entries[0]?.contentRect.width;
        if (width > 0) setAvailableWidth(width);
      });

      observer.observe(el);
      return () => observer.disconnect();
    }, []);

    // Width available for MSA (excluding labels)
    const msaAvailableWidth = Math.max(0, availableWidth - labelWidth);
    const minContentWidth = maxLength * minTileWidth;
    const contentWidth = Math.max(msaAvailableWidth, minContentWidth);
    const needsScroll = msaAvailableWidth > 0 && contentWidth > msaAvailableWidth;
    const msaHeight = Math.min(sequences.length * rowHeight, maxMsaHeight);

    // Get the inner sequence viewer component
    const getSequenceViewer = useCallback((): any | null => {
      const msa = msaRef.current;
      if (!msa) return null;
      return msa.renderRoot?.querySelector('msa-sequence-viewer') ?? null;
    }, []);

    const triggerRedraw = useCallback(() => {
      const seqViewer = getSequenceViewer();
      if (seqViewer && typeof seqViewer.invalidateAndRedraw === 'function') {
        seqViewer.invalidateAndRedraw();
      }
    }, [getSequenceViewer]);

    const syncWidths = useCallback(() => {
      const nav = navRef.current;
      const msa = msaRef.current;

      if (nav) {
        nav.setAttribute('width', String(contentWidth));
        nav.width = contentWidth;
        nav.style.width = `${contentWidth}px`;
        nav.style.minWidth = `${contentWidth}px`;
        nav.style.maxWidth = `${contentWidth}px`;

        const svg = nav.renderRoot?.querySelector('svg');
        if (svg) {
          svg.setAttribute('width', String(contentWidth));
          svg.style.width = `${contentWidth}px`;
          svg.style.minWidth = `${contentWidth}px`;
        }

        if (typeof nav.onDimensionsChange === 'function') {
          nav.onDimensionsChange();
        }
        if (typeof nav.renderD3 === 'function') {
          nav.renderD3();
        }
      }

      if (msa) {
        msa.setAttribute('width', String(contentWidth));
        msa.width = contentWidth;
        msa.style.width = `${contentWidth}px`;
        msa.style.minWidth = `${contentWidth}px`;
        msa.style.maxWidth = `${contentWidth}px`;

        if (typeof msa.onDimensionsChange === 'function') {
          msa.onDimensionsChange();
        }

        const seqViewer = getSequenceViewer();
        if (seqViewer) {
          seqViewer.setAttribute('width', String(contentWidth));
          seqViewer.width = contentWidth;
          seqViewer.style.width = `${contentWidth}px`;
          seqViewer.style.minWidth = `${contentWidth}px`;

          if (typeof seqViewer.invalidateAndRedraw === 'function') {
            seqViewer.invalidateAndRedraw();
          }
        }
      }
    }, [contentWidth, getSequenceViewer]);

    const jumpToRange = useCallback((start: number, end: number) => {
      const nav = navRef.current;
      if (nav && typeof nav.locate === 'function') {
        nav.locate(start, end);
      }
    }, []);

    const setColorScheme = useCallback((scheme: string) => {
      const msa = msaRef.current;
      if (!msa) return;

      msa.setAttribute('color-scheme', scheme);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const seqViewer = getSequenceViewer();
          if (seqViewer && typeof seqViewer.invalidateAndRedraw === 'function') {
            seqViewer.invalidateAndRedraw();
          }
        });
      });
    }, [getSequenceViewer]);

    useImperativeHandle(ref, () => ({
      redraw: triggerRedraw,
      jumpToRange,
      setColorScheme,
    }), [triggerRedraw, jumpToRange, setColorScheme]);

    useLayoutEffect(() => {
      if (contentWidth === 0) return;
      requestAnimationFrame(() => syncWidths());
    }, [contentWidth, syncWidths]);

    // Load data into MSA
    useEffect(() => {
      if (!msaRef.current || sequences.length === 0 || contentWidth === 0) return;

      const timer = setTimeout(() => {
        msaRef.current.data = sequences.map((s) => ({
          name: s.name,
          sequence: s.sequence,
        }));

        requestAnimationFrame(() => {
          syncWidths();
          setIsInitialized(true);
        });
      }, 100);

      return () => clearTimeout(timer);
    }, [sequences, contentWidth, syncWidths]);

    // Handle color scheme prop changes
    useEffect(() => {
      if (!msaRef.current || !isInitialized) return;
      msaRef.current.setAttribute('color-scheme', colorScheme);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => triggerRedraw());
      });
    }, [colorScheme, isInitialized, triggerRedraw]);

    // Sync vertical scroll between labels and MSA
    useEffect(() => {
      const msa = msaRef.current;
      const labels = labelsRef.current;
      if (!msa || !labels || !isInitialized) return;

      // Find the scrollable element inside MSA
      const findScrollContainer = (): HTMLElement | null => {
        // Try common patterns for the scroll container
        const seqViewer = msa.renderRoot?.querySelector('msa-sequence-viewer');
        if (seqViewer?.renderRoot) {
          const scrollable = seqViewer.renderRoot.querySelector('[style*="overflow"]')
            || seqViewer.renderRoot.querySelector('.scroll-container')
            || seqViewer.renderRoot.firstElementChild;
          if (scrollable) return scrollable as HTMLElement;
        }
        return msa.renderRoot?.querySelector('[style*="overflow"]') as HTMLElement;
      };

      let scrollContainer = findScrollContainer();

      // Retry after a delay if not found
      if (!scrollContainer) {
        const retryTimer = setTimeout(() => {
          scrollContainer = findScrollContainer();
          if (scrollContainer) attachListener(scrollContainer);
        }, 500);
        return () => clearTimeout(retryTimer);
      }

      const attachListener = (container: HTMLElement) => {
        const handleScroll = () => {
          labels.scrollTop = container.scrollTop;
        };
        container.addEventListener('scroll', handleScroll);
        return () => container.removeEventListener('scroll', handleScroll);
      };

      return attachListener(scrollContainer);
    }, [isInitialized]);

    // Event handlers
    useEffect(() => {
      const msa = msaRef.current;
      if (!msa || !isInitialized) return;

      const handleClick = (e: CustomEvent) => {
        const { position, i } = e.detail || {};
        if (typeof position === 'number' && sequences[i] && onResidueClick) {
          onResidueClick(sequences[i].id, position);
        }
      };

      const handleMouseEnter = (e: CustomEvent) => {
        const { position, i } = e.detail || {};
        if (typeof position === 'number' && sequences[i] && onResidueHover) {
          onResidueHover(sequences[i].id, position);
        }
      };

      const handleMouseLeave = () => onResidueLeave?.();

      msa.addEventListener('onResidueClick', handleClick);
      msa.addEventListener('onResidueMouseEnter', handleMouseEnter);
      msa.addEventListener('onResidueMouseLeave', handleMouseLeave);

      return () => {
        msa.removeEventListener('onResidueClick', handleClick);
        msa.removeEventListener('onResidueMouseEnter', handleMouseEnter);
        msa.removeEventListener('onResidueMouseLeave', handleMouseLeave);
      };
    }, [sequences, isInitialized, onResidueClick, onResidueHover, onResidueLeave]);

    if (sequences.length === 0) {
      return (
        <div ref={outerRef} className="w-full h-full flex items-center justify-center">
          <span className="text-gray-500 text-sm">Waiting for sequences...</span>
        </div>
      );
    }

    if (availableWidth === 0) {
      return (
        <div ref={outerRef} className="w-full h-full flex items-center justify-center">
          <span className="text-gray-500 text-sm">Measuring...</span>
        </div>
      );
    }

    return (
      <div ref={outerRef} className="w-full h-full flex">
        {/* Labels column */}
        <div
          className="flex-shrink-0 flex flex-col"
          style={{ width: labelWidth }}
        >
          {/* Spacer for nav height */}
          <div style={{ height: navHeight, flexShrink: 0 }} />

          {/* Labels container - syncs with MSA scroll */}
          <div
            ref={labelsRef}
            className="overflow-hidden"
            style={{ height: msaHeight }}
          >
            {sequences.map((seq, idx) => (
              <div
                key={seq.id}
                className="truncate text-xs font-mono px-1 flex items-center"
                style={{ height: rowHeight }}
                title={seq.name}
              >
                {seq.name}
              </div>
            ))}
          </div>
        </div>

        {/* MSA column */}
        <div
          className="flex-1 min-w-0"
          style={{
            overflowX: needsScroll ? 'auto' : 'hidden',
            overflowY: 'hidden',
          }}
        >
          <div style={{ width: contentWidth, minWidth: contentWidth }}>
            <nightingale-manager style={{ display: 'block', width: contentWidth, minWidth: contentWidth }}>
              <nightingale-navigation
                ref={navRef}
                height={navHeight}
                length={maxLength}
                display-start="1"
                display-end={maxLength}
                highlight-color="#EB3BFF22"
                style={{ display: 'block' }}
              />
              <nightingale-msa
                ref={msaRef}
                height={msaHeight}
                length={maxLength}
                display-start="1"
                display-end={maxLength}
                color-scheme={colorScheme}
                label-width="0"
                highlight-event="onmouseover"
                highlight-color="#00FF0044"
                style={{ display: 'block' }}
              />
            </nightingale-manager>
          </div>
        </div>
      </div>
    );
  }
);