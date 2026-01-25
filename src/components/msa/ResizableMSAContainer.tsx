// src/components/msa/ResizableMSAContainer.tsx
'use client';

import { useEffect, useLayoutEffect, useRef, useState, forwardRef, useImperativeHandle, useCallback } from 'react';
import { MSALabels } from './MSALabels';

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
  showLabels?: boolean;
  onResidueHover?: (seqId: string, position: number) => void;
  onResidueLeave?: () => void;
  onResidueClick?: (seqId: string, position: number) => void;
}

export interface ResizableMSAContainerHandle {
  redraw: () => void;
  jumpToRange: (start: number, end: number) => void;
  setColorScheme: (scheme: string) => void;
  setHighlight: (start: number, end: number) => void;
  clearHighlight: () => void;
  applyPositionColors: (colors: Record<number, string>) => void;
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
      colorScheme = 'clustal2',
      minTileWidth = DEFAULTS.minTileWidth,
      rowHeight = DEFAULTS.rowHeight,
      navHeight = DEFAULTS.navHeight,
      maxMsaHeight = DEFAULTS.maxMsaHeight,
      showLabels = true,
      onResidueHover,
      onResidueLeave,
      onResidueClick,
    } = props;

    const outerRef = useRef<HTMLDivElement>(null);
    const msaRef = useRef<any>(null);
    const navRef = useRef<any>(null);

    const [availableWidth, setAvailableWidth] = useState(0);
    const [labelWidth, setLabelWidth] = useState(0);
    const [scrollTop, setScrollTop] = useState(0);
    const [isInitialized, setIsInitialized] = useState(false);

    // Track the base color scheme (before custom colors are applied)
    const baseColorSchemeRef = useRef(colorScheme);
    // Track whether we have custom colors active
    const hasCustomColorsRef = useRef(false);

    // Track MSA scroll position for label sync
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

    // Calculate widths
    const msaAreaWidth = showLabels ? availableWidth - labelWidth : availableWidth;
    const minContentWidth = maxLength * minTileWidth;
    const contentWidth = Math.max(msaAreaWidth, minContentWidth);
    const needsScroll = msaAreaWidth > 0 && contentWidth > msaAreaWidth;
    const msaHeight = Math.min(sequences.length * rowHeight, maxMsaHeight);

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

      // Update base scheme reference
      baseColorSchemeRef.current = scheme;
      
      // If we have custom colors, don't actually change the scheme
      // (custom colors take precedence)
      if (hasCustomColorsRef.current) return;

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

    // ============================================================
    // Custom Position Colors
    // ============================================================

    const applyPositionColors = useCallback((colors: Record<number, string>) => {
      const msa = msaRef.current;
      if (!msa) return;

      // Store colors globally for the custom color scheme to read
      window.__nightingaleCustomColors = {
        positionColors: colors,
        defaultColor: '#ffffff',
      };

      hasCustomColorsRef.current = true;

      // Switch to custom color scheme
      msa.setAttribute('color-scheme', 'custom-position');

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          triggerRedraw();
        });
      });
    }, [triggerRedraw]);

    const clearPositionColors = useCallback(() => {
      const msa = msaRef.current;
      if (!msa) return;

      // Clear global colors
      delete window.__nightingaleCustomColors;
      hasCustomColorsRef.current = false;

      // Revert to base color scheme
      msa.setAttribute('color-scheme', baseColorSchemeRef.current);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          triggerRedraw();
        });
      });
    }, [triggerRedraw]);

    useImperativeHandle(ref, () => ({
      redraw: triggerRedraw,
      jumpToRange,
      setColorScheme,
      setHighlight,
      clearHighlight,
      applyPositionColors,
      clearPositionColors,
    }), [triggerRedraw, jumpToRange, setColorScheme, setHighlight, clearHighlight, applyPositionColors, clearPositionColors]);

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
      
      // Update base scheme
      baseColorSchemeRef.current = colorScheme;
      
      // Only apply if we don't have custom colors
      if (!hasCustomColorsRef.current) {
        msaRef.current.setAttribute('color-scheme', colorScheme);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => triggerRedraw());
        });
      }
    }, [colorScheme, isInitialized, triggerRedraw]);

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

    const handleLabelWidthCalculated = useCallback((width: number) => {
      setLabelWidth(width);
    }, []);

    // Cleanup on unmount
    useEffect(() => {
      return () => {
        delete window.__nightingaleCustomColors;
      };
    }, []);

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
        {/* Labels column - positioned to align with MSA rows (below nav) */}
        {showLabels && (
          <div className="flex-shrink-0 flex flex-col" style={{ width: labelWidth }}>
            {/* Spacer for navigation height */}
            <div style={{ height: navHeight }} className="flex-shrink-0" />
            {/* Labels that scroll with MSA */}
            <div className="flex-1 overflow-hidden">
              <MSALabels
                rowHeight={rowHeight}
                scrollTop={scrollTop}
                onWidthCalculated={handleLabelWidthCalculated}
              />
            </div>
          </div>
        )}

        {/* MSA area - navigation and MSA inside same manager */}
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