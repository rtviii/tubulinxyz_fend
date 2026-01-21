// src/app/msalite/components/ResizableMSAContainer.tsx
'use client';

import { useEffect, useLayoutEffect, useRef, useState, forwardRef, useImperativeHandle, useCallback } from 'react';

interface SequenceData {
  id: string;
  name: string;
  sequence: string;
  family?: string;
  originType?: 'master' | 'pdb' | 'custom';
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

function calculateLabelWidth(sequences: SequenceData[]): number {
  if (sequences.length === 0) return 100;
  const longest = Math.max(...sequences.map(s => s.name.length));
  return Math.max(100, Math.min(220, longest * 7 + 24));
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
        // Use contentBoxSize for precise sub-pixel measurements during zoom
        const width = entries[0]?.contentBoxSize?.[0]?.inlineSize ?? entries[0]?.contentRect.width;
        if (width > 0) setAvailableWidth(width);
      });

      observer.observe(el);
      return () => observer.disconnect();
    }, []);

    const msaAvailableWidth = Math.max(0, availableWidth - labelWidth);
    const minContentWidth = maxLength * minTileWidth;
    const contentWidth = Math.max(msaAvailableWidth, minContentWidth);
    const needsScroll = msaAvailableWidth > 0 && contentWidth > msaAvailableWidth;
    const msaHeight = Math.min(sequences.length * rowHeight, maxMsaHeight);

    const getSequenceViewer = useCallback((): any | null => {
      const msa = msaRef.current;
      if (!msa) return null;
      return msa.renderRoot?.querySelector('msa-sequence-viewer') ?? null;
    }, []);

    const triggerRedraw = useCallback(() => {
      const seqViewer = getSequenceViewer();
      if (seqViewer) {
        if (typeof seqViewer.requestUpdate === 'function') seqViewer.requestUpdate();
        if (typeof seqViewer.draw === 'function') seqViewer.draw();
      }
    }, [getSequenceViewer]);

    const syncWidths = useCallback(() => {
      const nav = navRef.current;
      const msa = msaRef.current;

      // Update Nightingale attributes to match calculated contentWidth
      if (nav) {
        nav.setAttribute('width', String(contentWidth));
        if (typeof nav.onDimensionsChange === 'function') nav.onDimensionsChange();
        if (typeof nav.renderD3 === 'function') nav.renderD3();
      }

      if (msa) {
        msa.setAttribute('width', String(contentWidth));
        if (typeof msa.onDimensionsChange === 'function') msa.onDimensionsChange();

        const seqViewer = getSequenceViewer();
        if (seqViewer) {
          seqViewer.setAttribute('width', String(contentWidth));
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

      if (scheme === 'custom-position') {
        const seqViewer = getSequenceViewer();
        if (seqViewer?.residueTileCache) {
          seqViewer.residueTileCache.invalidate();
        }
      }

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
      if (availableWidth === 0) return;
      syncWidths();
    }, [availableWidth, syncWidths]);

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

    useEffect(() => {
      if (!msaRef.current || !isInitialized) return;
      msaRef.current.setAttribute('color-scheme', colorScheme);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => triggerRedraw());
      });
    }, [colorScheme, isInitialized, triggerRedraw]);

    useEffect(() => {
      const msa = msaRef.current;
      const labels = labelsRef.current;
      if (!msa || !labels || !isInitialized) return;

      const findScrollContainer = (): HTMLElement | null => {
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

      const attachListener = (container: HTMLElement) => {
        const handleScroll = () => {
          labels.scrollTop = container.scrollTop;
        };
        container.addEventListener('scroll', handleScroll);
        return () => container.removeEventListener('scroll', handleScroll);
      };

      if (!scrollContainer) {
        const retryTimer = setTimeout(() => {
          scrollContainer = findScrollContainer();
          if (scrollContainer) attachListener(scrollContainer);
        }, 500);
        return () => clearTimeout(retryTimer);
      }

      return attachListener(scrollContainer);
    }, [isInitialized]);

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
      <div ref={outerRef} className="w-full h-full flex overflow-hidden">
        {/* Labels column */}
        <div
          className="flex-shrink-0 flex flex-col border-r border-gray-200 bg-white"
          style={{ width: labelWidth }}
        >
          <div style={{ height: navHeight, flexShrink: 0 }} className="border-b border-gray-100" />
          <div
            ref={labelsRef}
            className="overflow-hidden"
            style={{ height: msaHeight }}
          >
            {sequences.map((seq) => (
              <SequenceLabel key={seq.id} seq={seq} height={rowHeight} />
            ))}
          </div>
        </div>

        {/* MSA column */}
        <div
          className="flex-1 min-w-0 bg-white"
          style={{
            overflowX: needsScroll ? 'auto' : 'hidden',
            overflowY: 'hidden',
          }}
        >
          <div style={{ width: contentWidth }}>
            <nightingale-manager style={{ display: 'block', width: '100%' }}>
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

function SequenceLabel({ seq, height }: { seq: SequenceData; height: number }) {
  const isMaster = seq.originType === 'master';
  const isPdb = seq.originType === 'pdb';

  return (
    <div
      className={`
        flex items-center gap-1.5 px-2 text-xs font-mono
        border-b border-gray-50 cursor-default select-none
        ${isMaster ? 'bg-gray-50 text-gray-600' : 'bg-white text-gray-800'}
        hover:bg-blue-50
      `}
      style={{ height }}
      title={seq.name}
    >
      {isPdb && (
        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
      )}
      <span className="truncate">
        {seq.name}
      </span>
    </div>
  );
}