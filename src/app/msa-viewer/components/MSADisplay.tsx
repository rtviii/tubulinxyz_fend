// src/app/msa-viewer/components/MSADisplay.tsx
import { useEffect, useRef, useState } from 'react';
import { 
  SequenceData, 
  AddedSequenceGroup, 
  LabelClickHandler, 
  ResidueClickHandler, 
  ResidueHoverHandler, 
  ResidueLeaveHandler,
  MsaHighlight,
  MsaHover 
} from './msa-types';
import { annotationData } from './msa-data';
import { SingleSequenceTrack } from './tracks/SingleSequenceTrack';
import { AnnotationTrack } from './tracks/AnnotationTrack';

interface MSADisplayProps {
  masterSequences    : SequenceData[];
  addedSequenceGroups: AddedSequenceGroup[];
  maxLength          : number;
  onLabelClick       : LabelClickHandler;
  onResidueClick     : ResidueClickHandler;
  onResidueHover     : ResidueHoverHandler;
  onResidueLeave     : ResidueLeaveHandler;
  activeAnnotations  : Set<string>;
  onZoomToPosition?: (position: number) => void;
}

export function MSADisplay({
  masterSequences,
  addedSequenceGroups,
  maxLength,
  onLabelClick,
  onResidueClick,
  onResidueHover,
  onResidueLeave,
  activeAnnotations,
onZoomToPosition
}: MSADisplayProps) {

  const [activeSeq, setActiveSeq] = useState<MsaHighlight | null>(null);
  const [hoveredCell, setHoveredCell] = useState<MsaHover | null>(null);
  const [isReady, setIsReady] = useState(false);

  const [expandedRegions, setExpandedRegions] = useState<Set<string>>(new Set());
  const [enabledRegions, setEnabledRegions] = useState<Map<string, Set<string>>>(new Map());

  const trackRefs = useRef<{ [key: string]: any }>({});
  const msaTrackRefs = useRef<{ [key: string]: any }>({});
  const navigationRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const labelWidthPx = 120;

  // Force refresh after mount
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

 useEffect(() => {
    if (onZoomToPosition && navigationRef.current) {
      // Expose zoom function
      (window as any).__msaZoomToPosition = (position: number) => {
        const windowSize = 20;
        const start = Math.max(1, position - Math.floor(windowSize / 2));
        const end = start + windowSize - 1;
        
        if (navigationRef.current) {
          navigationRef.current.setAttribute('display-start', String(start));
          navigationRef.current.setAttribute('display-end', String(end));
        }
      };
    }
  }, [onZoomToPosition]);
  // Refresh all nightingale components
  const refreshAllComponents = () => {
    // Refresh navigation
    if (navigationRef.current?.refresh) {
      navigationRef.current.refresh();
    }

    // Refresh all MSA tracks
    Object.values(msaTrackRefs.current).forEach(track => {
      if (track?.refresh) {
        track.refresh();
      }
    });

    // Refresh all annotation tracks
    Object.values(trackRefs.current).forEach(track => {
      if (track?.refresh) {
        track.refresh();
      }
    });
  };

  // Watch for container resize
  useEffect(() => {
    if (!containerRef.current || !isReady) return;

    const resizeObserver = new ResizeObserver(() => {
      // Debounce the refresh
      const timer = setTimeout(() => {
        refreshAllComponents();
      }, 50);
      
      return () => clearTimeout(timer);
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [isReady]);

  // Force refresh when sequences change
  useEffect(() => {
    if (isReady) {
      const timer = setTimeout(() => {
        refreshAllComponents();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [masterSequences.length, addedSequenceGroups.length, isReady]);

  const handleLabelClick = (label: string, seqId: string) => {
    onLabelClick(label, seqId);
    setActiveSeq({ seqId });
  };

  const handleInternalResidueClick = (seqId: string, rawPosition: number) => {
    if (typeof rawPosition === 'number') {
      onResidueClick(seqId, rawPosition);
      setActiveSeq({ seqId });
    }
  };

  const handleInternalResidueHover = (seqId: string, rawPosition: number) => {
    if (typeof rawPosition === 'number') {
      const pos0 = rawPosition;
      onResidueHover(seqId, pos0);
      setHoveredCell({ seqId, position0: pos0 });
    }
  };

  const handleInternalResidueLeave = () => {
    onResidueLeave();
    setHoveredCell(null);
  };

  const toggleRegionsExpanded = (seqId: string) => {
    setExpandedRegions(prev => {
      const next = new Set(prev);
      if (next.has(seqId)) {
        next.delete(seqId);
      } else {
        next.add(seqId);
      }
      return next;
    });
  };

  const toggleRegion = (seqId: string, regionId: string) => {
    setEnabledRegions(prev => {
      const next = new Map(prev);
      const seqRegions = next.get(seqId) || new Set();
      const newSeqRegions = new Set(seqRegions);

      if (newSeqRegions.has(regionId)) {
        newSeqRegions.delete(regionId);
      } else {
        newSeqRegions.add(regionId);
      }

      next.set(seqId, newSeqRegions);
      return next;
    });
  };

  useEffect(() => {
    Object.keys(trackRefs.current).forEach(annotationId => {
      const track = trackRefs.current[annotationId];
      if (track && annotationData[annotationId as keyof typeof annotationData]) {
        if (activeAnnotations.has(annotationId)) {
          track.data = annotationData[annotationId as keyof typeof annotationData].features;
        } else {
          track.data = [];
        }
      }
    });
  }, [activeAnnotations]);

  if (!isReady) {
    return (
      <div className="flex items-center justify-center p-8 text-gray-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ width: "100%", minWidth: 0 }}>
      <nightingale-manager 
        style={{ 
          width: "100%", 
          display: "block"
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>

          {/* Navigation */}
          <div style={{
            display: "flex",
            width: "100%",
            marginBottom: "8px"
          }}>
            <div style={{ width: `${labelWidthPx}px`, minWidth: `${labelWidthPx}px` }} />
            <div style={{ flex: 1, lineHeight: 0, minWidth: 0 }}>
              <nightingale-navigation
                ref={navigationRef}
                height="35"
                length={maxLength}
                display-start="1"
                display-end={maxLength}
                highlight-color="#EB3BFF22"
                style={{ width: "100%", display: "block" }}
              />
            </div>
          </div>

          {/* Annotation Tracks */}
          {Array.from(activeAnnotations).map(annotationId => {
            const annotation = annotationData[annotationId as keyof typeof annotationData];
            if (!annotation) return null;

            return (
              <div key={annotationId} style={{ marginBottom: '2px' }}>
                <AnnotationTrack
                  trackId={annotationId}
                  title={annotation.name}
                  color={annotation.color}
                  shape={annotation.shape}
                  features={annotation.features}
                  maxLength={maxLength}
                  labelWidthPx={labelWidthPx}
                  trackRefs={trackRefs}
                />
              </div>
            );
          })}

          {/* Master Sequences */}
          {masterSequences.map((seq) => (
            <div key={seq.id} style={{ marginBottom: '1px' }}>
              <SingleSequenceTrack
                sequence={seq}
                maxLength={maxLength}
                labelWidthPx={labelWidthPx}
                activeSeq={activeSeq}
                hoveredCell={hoveredCell}
                onLabelClick={handleLabelClick}
                onResidueClick={handleInternalResidueClick}
                onResidueHover={handleInternalResidueHover}
                onResidueLeave={handleInternalResidueLeave}
                isMaster={true}
                isRegionsExpanded={false}
                onToggleRegions={() => { }}
                enabledRegions={new Set()}
                onToggleRegion={() => { }}
                msaTrackRefs={msaTrackRefs}
              />
            </div>
          ))}

          {/* Added Sequences with Region Support */}
          {addedSequenceGroups.flatMap(group =>
            group.sequences.map(seq => (
              <div key={seq.id} style={{ marginBottom: '1px' }}>
                <SingleSequenceTrack
                  sequence={seq}
                  maxLength={maxLength}
                  labelWidthPx={labelWidthPx}
                  activeSeq={activeSeq}
                  hoveredCell={hoveredCell}
                  onLabelClick={handleLabelClick}
                  onResidueClick={handleInternalResidueClick}
                  onResidueHover={handleInternalResidueHover}
                  onResidueLeave={handleInternalResidueLeave}
                  isMaster={false}
                  isRegionsExpanded={expandedRegions.has(seq.id)}
                  onToggleRegions={() => toggleRegionsExpanded(seq.id)}
                  enabledRegions={enabledRegions.get(seq.id) || new Set()}
                  onToggleRegion={(regionId) => toggleRegion(seq.id, regionId)}
                  msaTrackRefs={msaTrackRefs}
                />
              </div>
            ))
          )}
        </div>
      </nightingale-manager>
    </div>
  );
}
