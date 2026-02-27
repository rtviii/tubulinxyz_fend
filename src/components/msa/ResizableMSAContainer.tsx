'use client';

import { useEffect, useLayoutEffect, useRef, useState, forwardRef, useImperativeHandle, useCallback } from 'react';
import { MSALabels } from './MSALabels';
import { MsaSequence } from '@/store/slices/sequence_registry';

interface ResizableMSAContainerProps {
  sequences: MsaSequence[];
  maxLength: number;
  colorScheme?: string;
  minTileWidth?: number;
  rowHeight?: number;
  navHeight?: number;
  maxMsaHeight?: number;
  showLabels?: boolean;
  onResidueHover?: (seqId: string, position: number) => void;
  onResidueLeave?: () => void;
  onResidueClick?: (seqId: string, position: number) => void;
  onDisplayRangeChange?: (start: number, end: number) => void;

  visibleChainKeys?: Set<string>;
  onToggleChainVisibility?: (chainKey: string) => void;
  onSoloChain?: (chainKey: string) => void;
}

export interface ResizableMSAContainerHandle {
  redraw: () => void;
  jumpToRange: (start: number, end: number) => void;
  setColorScheme: (scheme: string) => void;
  setHighlight: (start: number, end: number) => void;
  clearHighlight: () => void;
  applyPositionColors: (colors: Record<number, string>) => void;
  applyCellColors: (colors: Record<string, string>) => void;
  clearPositionColors: () => void;
}

const DEFAULTS = {
  minTileWidth: 1,
  navHeight: 60,
  rowHeight: 20,
  maxMsaHeight: 800,
};

export const ResizableMSAContainer = forwardRef<ResizableMSAContainerHandle, ResizableMSAContainerProps>(
  function ResizableMSAContainer(props, ref) {
    const {
      sequences,
      maxLength,
      colorScheme = 'custom-position',
      minTileWidth = DEFAULTS.minTileWidth,
      rowHeight = DEFAULTS.rowHeight,
      navHeight = DEFAULTS.navHeight,
      maxMsaHeight = DEFAULTS.maxMsaHeight,
      showLabels = true,
      onResidueHover,
      onResidueLeave,
      onResidueClick,
      onDisplayRangeChange,

      visibleChainKeys,
      onToggleChainVisibility,
      onSoloChain,
    } = props;

    console.log('[ResizableMSAContainer] received sequences:', {
      count: sequences.length,
      ids: sequences.map(s => s.id),
      families: sequences.map(s => s.family),
    });

    const outerRef = useRef<HTMLDivElement>(null);
    const msaRef = useRef<any>(null);
    const navRef = useRef<any>(null);
    const managerRef = useRef<any>(null);

    const [availableWidth, setAvailableWidth] = useState(0);
    const [labelWidth, setLabelWidth] = useState(0);
    const [scrollTop, setScrollTop] = useState(0);
    const [isInitialized, setIsInitialized] = useState(false);
    const baseColorSchemeRef = useRef(colorScheme);

    // ----------------------------------------------------------------
    // Scroll sync for labels
    // ----------------------------------------------------------------

    useEffect(() => {
      const msaEl = msaRef.current;
      if (!msaEl || !isInitialized) return;

      const handleScroll = () => {
        const seqViewer = msaEl.renderRoot?.querySelector('msa-sequence-viewer');
        if (seqViewer?.position) {
          setScrollTop(seqViewer.position.yPos || 0);
        }
      };

      msaEl.addEventListener('fake-scroll', handleScroll);
      const interval = setInterval(handleScroll, 100);

      return () => {
        msaEl.removeEventListener('fake-scroll', handleScroll);
        clearInterval(interval);
      };
    }, [isInitialized]);

    // ----------------------------------------------------------------
    // Container resize observer
    // ----------------------------------------------------------------

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

    // ----------------------------------------------------------------
    // Manager change event -> display range
    // ----------------------------------------------------------------

    useEffect(() => {
      const manager = managerRef.current;
      if (!manager || !isInitialized || !onDisplayRangeChange) return;

      const handler = (e: Event) => {
        const { 'display-start': rawStart, 'display-end': rawEnd } = (e as CustomEvent).detail ?? {};
        const start = Math.round(typeof rawStart === 'number' ? rawStart : parseFloat(rawStart));
        const end = Math.round(typeof rawEnd === 'number' ? rawEnd : parseFloat(rawEnd));
        if (!Number.isNaN(start) && !Number.isNaN(end)) {
          onDisplayRangeChange(start, end);
        }
      };

      manager.addEventListener('change', handler);
      return () => manager.removeEventListener('change', handler);
    }, [isInitialized, onDisplayRangeChange]);

    useEffect(() => {
      if (!isInitialized) return;

      const manager = managerRef.current;
      const nav = navRef.current;

      const logAny = (label: string) => (e: Event) => {
        console.log(`[MSA event] ${label}`, e.type, (e as CustomEvent).detail);
      };

      // Cast the net wide - listen on both elements for any likely event name
      ['change', 'display-start-change', 'position-change', 'updated'].forEach(name => {
        manager?.addEventListener(name, logAny(`manager:${name}`));
        nav?.addEventListener(name, logAny(`nav:${name}`));
      });

      return () => {
        ['change', 'display-start-change', 'position-change', 'updated'].forEach(name => {
          manager?.removeEventListener(name, logAny(`manager:${name}`));
          nav?.removeEventListener(name, logAny(`nav:${name}`));
        });
      };
    }, [isInitialized]);
    // ----------------------------------------------------------------
    // Derived layout
    // ----------------------------------------------------------------

    const msaAreaWidth = showLabels ? availableWidth - labelWidth : availableWidth;
    const minContentWidth = maxLength * minTileWidth;
    const contentWidth = Math.max(msaAreaWidth, minContentWidth);
    const needsScroll = msaAreaWidth > 0 && contentWidth > msaAreaWidth;
    const msaHeight = Math.min(sequences.length * rowHeight, maxMsaHeight);

    // ----------------------------------------------------------------
    // Imperative helpers
    // ----------------------------------------------------------------

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

        if (typeof nav.onDimensionsChange === 'function') nav.onDimensionsChange();
        if (typeof nav.renderD3 === 'function') nav.renderD3();
      }

      if (msa) {
        msa.setAttribute('width', String(contentWidth));
        msa.width = contentWidth;
        msa.style.width = `${contentWidth}px`;
        msa.style.minWidth = `${contentWidth}px`;
        msa.style.maxWidth = `${contentWidth}px`;

        if (typeof msa.onDimensionsChange === 'function') msa.onDimensionsChange();

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

      baseColorSchemeRef.current = scheme;
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

    const setHighlight = useCallback((start: number, end: number) => {
      const msa = msaRef.current;
      if (!msa) return;
      msa.setAttribute('highlight', `${start}:${end}`);
    }, []);

    const clearHighlight = useCallback(() => {
      const msa = msaRef.current;
      if (!msa) return;
      msa.removeAttribute('highlight');
    }, []);

    const applyCellColors = useCallback((colors: Record<string, string>) => {
      const msa = msaRef.current;
      if (!msa) return;
      msa.setAttribute('color-scheme', 'custom-position');
      (msa as any).cellColors = colors;
    }, []);

    const applyPositionColors = useCallback((colors: Record<number, string>) => {
      const cellColors: Record<string, string> = {};
      for (const [position, color] of Object.entries(colors)) {
        for (let row = 0; row < sequences.length; row++) {
          cellColors[`${row}-${position}`] = color;
        }
      }
      applyCellColors(cellColors);
    }, [sequences.length, applyCellColors]);

    const clearPositionColors = useCallback(() => {
      const msa = msaRef.current;
      if (!msa) return;
      (msa as any).cellColors = {};
      msa.setAttribute('color-scheme', baseColorSchemeRef.current);
    }, []);

    useImperativeHandle(ref, () => ({
      redraw: triggerRedraw,
      jumpToRange,
      setColorScheme,
      setHighlight,
      clearHighlight,
      applyPositionColors,
      applyCellColors,
      clearPositionColors,
    }), [triggerRedraw, jumpToRange, setColorScheme, setHighlight, clearHighlight, applyPositionColors, applyCellColors, clearPositionColors]);

    // ----------------------------------------------------------------
    // Width sync
    // ----------------------------------------------------------------

    useLayoutEffect(() => {
      if (contentWidth === 0) return;
      requestAnimationFrame(() => syncWidths());
    }, [contentWidth, syncWidths]);

    // ----------------------------------------------------------------
    // Data init
    // ----------------------------------------------------------------

    useEffect(() => {
      if (!msaRef.current || sequences.length === 0 || contentWidth === 0) return;

      const freshData = sequences.map(s => ({
        name: s.name,
        sequence: s.sequence,
      }));

      console.log('[MSA Init] Setting data:', {
        count: freshData.length,
        names: freshData.map(d => d.name),
      });

      const timer = setTimeout(() => {
        msaRef.current.data = freshData;
        msaRef.current.setAttribute('color-scheme', 'custom-position');

        requestAnimationFrame(() => {
          syncWidths();
          setIsInitialized(true);
        });
      }, 100);

      return () => clearTimeout(timer);
    }, [sequences, contentWidth, syncWidths]);

    // ----------------------------------------------------------------
    // Color scheme changes after init
    // ----------------------------------------------------------------

    useEffect(() => {
      if (!msaRef.current || !isInitialized) return;
      baseColorSchemeRef.current = colorScheme;
      msaRef.current.setAttribute('color-scheme', colorScheme);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => triggerRedraw());
      });
    }, [colorScheme, isInitialized, triggerRedraw]);

    // ----------------------------------------------------------------
    // Residue interaction events
    // ----------------------------------------------------------------

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

    // ----------------------------------------------------------------
    // Label width callback
    // ----------------------------------------------------------------

    const handleLabelWidthCalculated = useCallback((width: number) => {
      setLabelWidth(width);
    }, []);

    // ----------------------------------------------------------------
    // Early returns
    // ----------------------------------------------------------------

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

    // ----------------------------------------------------------------
    // Render
    // ----------------------------------------------------------------

    return (
      <div ref={outerRef} className="w-full h-full flex">
        {showLabels && (
          <div className="flex-shrink-0 flex flex-col" style={{ width: labelWidth }}>
            <div style={{ height: navHeight }} className="flex-shrink-0" />
            <div className="flex-1 overflow-hidden">
              <MSALabels
                sequences={sequences}
                rowHeight={rowHeight}
                scrollTop={scrollTop}
                onWidthCalculated={handleLabelWidthCalculated}
                visibleChainKeys={visibleChainKeys}
                onToggleChainVisibility={onToggleChainVisibility}
                onSoloChain={onSoloChain}
              />
            </div>
          </div>
        )}

        <div
          className="flex-1 min-w-0"
          style={{
            overflowX: needsScroll ? 'auto' : 'hidden',
            overflowY: 'hidden',
          }}
        >
          <div style={{ width: contentWidth, minWidth: contentWidth }}>
            <nightingale-manager
              ref={managerRef}
              style={{ display: 'block', width: contentWidth, minWidth: contentWidth }}
            >
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
                color-scheme="custom-position"
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