// components/MSADisplay.tsx
import { useEffect, useRef, useState } from 'react';

// Data structures
interface SequenceData {
  id: string;
  name: string;
  sequence: string;
}

interface AddedSequenceGroup {
  title: string;
  sequences: SequenceData[];
}

// Event handler types
type LabelClickHandler = (label: string, seqId: string) => void;
type ResidueClickHandler = (seqId: string, position: number) => void;
type ResidueHoverHandler = (seqId: string, position: number) => void;
type ResidueLeaveHandler = () => void;

// Prop types for the main component
interface MSADisplayProps {
  masterSequences: SequenceData[];
  addedSequenceGroups: AddedSequenceGroup[];
  maxLength: number;
  onLabelClick: LabelClickHandler;
  onResidueClick: ResidueClickHandler;
  onResidueHover: ResidueHoverHandler;
  onResidueLeave: ResidueLeaveHandler;
  activeAnnotations: Set<string>;
}

// State types for highlighting
interface MsaHighlight {
  seqId: string;
}
interface MsaHover extends MsaHighlight {
  position: number;
}

// Annotation data matching the library
const annotationData = {
  phosphorylation: {
    name: 'Phosphorylation',
    color: '#3B82F6',
    shape: 'circle' as const,
    features: [
      { accession: 'phos1', start: 15, end: 15, color: '#3B82F6', shape: 'circle' },
      { accession: 'phos2', start: 45, end: 45, color: '#3B82F6', shape: 'circle' },
      { accession: 'phos3', start: 89, end: 89, color: '#3B82F6', shape: 'circle' }
    ]
  },
  acetylation: {
    name: 'Acetylation',
    color: '#10B981',
    shape: 'diamond' as const,
    features: [
      { accession: 'ac1', start: 23, end: 23, color: '#10B981', shape: 'diamond' },
      { accession: 'ac2', start: 67, end: 67, color: '#10B981', shape: 'diamond' }
    ]
  },
  atp_binding: {
    name: 'ATP Binding',
    color: '#EF4444',
    shape: 'rectangle' as const,
    features: [
      { accession: 'atp1', start: 50, end: 65, color: '#EF4444', shape: 'rectangle' }
    ]
  },
  metal_binding: {
    name: 'Metal Binding',
    color: '#F59E0B',
    shape: 'hexagon' as const,
    features: [
      { accession: 'metal1', start: 30, end: 32, color: '#F59E0B', shape: 'hexagon' },
      { accession: 'metal2', start: 75, end: 77, color: '#F59E0B', shape: 'hexagon' }
    ]
  },
  glycosylation: {
    name: 'Glycosylation',
    color: '#8B5CF6',
    shape: 'triangle' as const,
    features: [
      { accession: 'glyco1', start: 102, end: 102, color: '#8B5CF6', shape: 'triangle' },
      { accession: 'glyco2', start: 156, end: 156, color: '#8B5CF6', shape: 'triangle' }
    ]
  }
};

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

  const trackRefs = useRef<{ [key: string]: any }>({});

  const handleLabelClick = (label: string, seqId: string) => {
    onLabelClick(label, seqId);
    setActiveSeq({ seqId });
  };

  const handleResidueClick = (seqId: string, position: number) => {
    onResidueClick(seqId, position);
    setActiveSeq({ seqId });
  };

  const handleResidueHover = (seqId: string, position: number) => {
    onResidueHover(seqId, position);
    setHoveredCell({ seqId, position });
  };

  const handleResidueLeave = () => {
    onResidueLeave();
    setHoveredCell(null);
  };

  const labelWidthPx = 120;
  const navigationPadding = `${labelWidthPx}px`;

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
                onResidueClick={handleResidueClick}
                onResidueHover={handleResidueHover}
                onResidueLeave={handleResidueLeave}
                isMaster={true}
              />
            </div>
          ))}

          {/* Added Sequences */}
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
                  onResidueClick={handleResidueClick}
                  onResidueHover={handleResidueHover}
                  onResidueLeave={handleResidueLeave}
                  isMaster={false}
                />
              </div>
            ))
          )}
        </div>
      </nightingale-manager>
    </div>
  );
}

// Annotation Track Component
interface AnnotationTrackProps {
  trackId: string;
  title: string;
  color: string;
  shape: string;
  features: any[];
  maxLength: number;
  labelWidthPx: number;
  trackRefs: React.MutableRefObject<{ [key: string]: any }>;
}

function AnnotationTrack({
  trackId,
  title,
  color,
  shape,
  features,
  maxLength,
  labelWidthPx,
  trackRefs
}: AnnotationTrackProps) {
  return (
    <div style={{ display: 'flex', width: '100%', height: '20px' }}>
      <div
        style={{
          width: `${labelWidthPx}px`,
          minWidth: `${labelWidthPx}px`,
          height: '20px',
          padding: '2px 6px',
          display: 'flex',
          alignItems: 'center',
          fontSize: '10px',
          fontWeight: '500',
          color: '#374151',
          backgroundColor: '#f9fafb',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            width: '6px',
            height: '6px',
            backgroundColor: color,
            borderRadius: shape === 'circle' ? '50%' : '2px',
            marginRight: '4px',
            flexShrink: 0
          }}
        />
        <div style={{ 
          // overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {title}
        </div>
      </div>

      <div style={{ flex: 1, height: '20px', lineHeight: 0 }}>
        <nightingale-track
          ref={el => trackRefs.current[trackId] = el}
          height="20"
          length={maxLength}
          display-start="1"
          display-end={maxLength}
          layout="non-overlapping"
          style={{ width: '100%' }}
          data={features}
        />
      </div>
    </div>
  );
}

// Single Sequence Track Component
interface SingleSequenceTrackProps {
  sequence: SequenceData;
  maxLength: number;
  labelWidthPx: number;
  activeSeq: MsaHighlight | null;
  hoveredCell: MsaHover | null;
  onLabelClick: (label: string, seqId: string) => void;
  onResidueClick: (seqId: string, position: number) => void;
  onResidueHover: (seqId: string, position: number) => void;
  onResidueLeave: () => void;
  isMaster: boolean;
}

function SingleSequenceTrack({
  sequence,
  maxLength,
  labelWidthPx,
  activeSeq,
  hoveredCell,
  onLabelClick,
  onResidueClick,
  onResidueHover,
  onResidueLeave,
  isMaster
}: SingleSequenceTrackProps) {

  const msaRef = useRef<any>(null);
  const rowHeight = 18;

  useEffect(() => {
    const msaComponent = msaRef.current;
    if (!msaComponent) return;

    msaComponent.data = [sequence];

    const handleLabelClick = () => {
      onLabelClick(sequence.name, sequence.id);
    };

    const handleResidueClick = (event: any) => {
      const { position } = event.detail;
      onResidueClick(sequence.id, position);
    };

    const handleResidueMouseEnter = (event: any) => {
      const { position } = event.detail;
      if (position >= 0) {
        onResidueHover(sequence.id, position);
      }
    };

    const handleResidueMouseLeave = () => {
      onResidueLeave();
    };

    msaComponent.addEventListener("msa-active-label", handleLabelClick);
    msaComponent.addEventListener("onResidueClick", handleResidueClick);
    msaComponent.addEventListener("onResidueMouseEnter", handleResidueMouseEnter);
    msaComponent.addEventListener("onResidueMouseLeave", handleResidueMouseLeave);

    return () => {
      msaComponent.removeEventListener("msa-active-label", handleLabelClick);
      msaComponent.removeEventListener("onResidueClick", handleResidueClick);
      msaComponent.removeEventListener("onResidueMouseEnter", handleResidueMouseEnter);
      msaComponent.removeEventListener("onResidueMouseLeave", handleResidueMouseLeave);
    };
  }, [sequence, onLabelClick, onResidueClick, onResidueHover, onResidueLeave]);

  useEffect(() => {
    const msaComponent = msaRef.current;
    if (!msaComponent) return;

    const features = [];

    if (activeSeq && activeSeq.seqId === sequence.id) {
      features.push({
        id: 'active-seq-highlight',
        sequences: { from: 0, to: 0 },
        residues: { from: 1, to: maxLength },
        fillColor: isMaster ? "rgba(59, 130, 246, 0.15)" : "rgba(34, 197, 94, 0.15)",
        borderColor: isMaster ? "#3B82F6" : "#22C55E",
      });
    }

    if (hoveredCell && hoveredCell.seqId === sequence.id) {
      features.push({
        id: 'hover-cell-highlight',
        sequences: { from: 0, to: 0 },
        residues: { from: hoveredCell.position + 1, to: hoveredCell.position + 1 },
        fillColor: '#00FF0066',
        borderColor: '#00FF00',
      });
    }

    msaComponent.features = features;
  }, [msaRef, activeSeq, hoveredCell, sequence.id, maxLength, isMaster]);

  return (
    <div style={{ display: 'flex', width: '100%', height: `${rowHeight}px` }}>
      <div
        onClick={() => onLabelClick(sequence.name, sequence.id)}
        style={{
          width: `${labelWidthPx}px`,
          minWidth: `${labelWidthPx}px`,
          height: `${rowHeight}px`,
          padding: '2px 6px',
          display: 'flex',
          alignItems: 'center',
          fontSize: '10px',
          fontWeight: '500',
          color: isMaster ? '#1E40AF' : '#059669',
          backgroundColor: isMaster ? '#EFF6FF' : '#ECFDF5',
          cursor: 'pointer',
          boxSizing: 'border-box',
          borderLeft: `3px solid ${isMaster ? '#3B82F6' : '#10B981'}`,
        }}
      >
        <div style={{ 
          // overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          width: '100%'
        }}>
          {sequence.name}
        </div>
      </div>

      <div style={{ flex: 1, height: `${rowHeight}px`, lineHeight: 0 }}>
        <nightingale-msa
          ref={msaRef}
          height={rowHeight}
          length={maxLength}
          display-start="1"
          display-end={maxLength}
          color-scheme="clustal2"
          label-width="0"
          highlight-event="onmouseover"
          highlight-color="#00FF0044"
          overlay-conservation={false}
        />
      </div>
    </div>
  );
}
