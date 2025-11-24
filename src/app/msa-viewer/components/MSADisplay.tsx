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
}

// Main Display Component
export function MSADisplay({
  masterSequences,
  addedSequenceGroups,
  maxLength,
  onLabelClick,
  onResidueClick,
  onResidueHover,
  onResidueLeave,
  activeAnnotations
}: MSADisplayProps) {

  const [activeSeq, setActiveSeq] = useState<MsaHighlight | null>(null);
  const [hoveredCell, setHoveredCell] = useState<MsaHover | null>(null);

  // Track which sequences have regions panel expanded
  const [expandedRegions, setExpandedRegions] = useState<Set<string>>(new Set());

  // Track which regions are enabled for each sequence
  const [enabledRegions, setEnabledRegions] = useState<Map<string, Set<string>>>(new Map());

  const trackRefs = useRef<{ [key: string]: any }>({});
  const labelWidthPx = 120;
  const navigationPadding = `${labelWidthPx}px`;

  const handleLabelClick = (label: string, seqId: string) => {
    onLabelClick(label, seqId);
    setActiveSeq({ seqId });
  };

  // --- FIREWALL: TRANSLATION LOGIC START ---
  // FIX: Nightingale emits 0-based indices. We pass them through.
  
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
  // --- FIREWALL: TRANSLATION LOGIC END ---

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

  return (
    <div style={{ width: "100%" }}>
      <nightingale-manager style={{ width: "100%", overflow: "visible" }}>
        <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>

          <div style={{
            lineHeight: 0,
            paddingLeft: navigationPadding,
            paddingRight: "15px",
            boxSizing: "border-box",
            marginBottom: "8px"
          }}>
            <nightingale-navigation
              height="35"
              length={maxLength}
              display-start="1"
              display-end={maxLength}
              highlight-color="#EB3BFF22"
            />
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
                />
              </div>
            ))
          )}
        </div>
      </nightingale-manager>
    </div>
  );
}
