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
  msaKey: string;
  rowIndex: number;
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

  const [activeRow, setActiveRow] = useState<MsaHighlight | null>(null);
  const [hoveredCell, setHoveredCell] = useState<MsaHover | null>(null);

  // Track refs for setting data
  const trackRefs = useRef<{ [key: string]: any }>({});

  // Event handlers to be passed to MsaInstance
  const handleLabelClick = (label: string, seqId: string, msaKey: string, rowIndex: number) => {
    onLabelClick(label, seqId);
    setActiveRow({ msaKey, rowIndex });
  };

  const handleResidueClick = (seqId: string, position: number, msaKey: string, rowIndex: number) => {
    onResidueClick(seqId, position);
    setActiveRow({ msaKey, rowIndex });
  };

  const handleResidueHover = (seqId: string, position: number, msaKey: string, rowIndex: number) => {
    onResidueHover(seqId, position);
    setHoveredCell({ msaKey, rowIndex, position });
  };

  const handleResidueLeave = () => {
    onResidueLeave();
    setHoveredCell(null);
  };

  // Define label width once
  const labelWidthPx = 120;
  const labelWidthStr = `${labelWidthPx}`;
  const navigationPadding = `${labelWidthPx}px`;

  // Set track data when annotations change
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
    <div style={{ width: "100%", }}>
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

          {/* Master MSA Track */}
          {masterSequences.length > 0 && (
            <div style={{ marginBottom: '4px' }}>
              <MsaTrack
                trackId="master-msa"
                title={`Master (${masterSequences.length})`}
                sequences={masterSequences}
                maxLength={maxLength}
                labelWidthPx={labelWidthPx}
                labelWidthStr={labelWidthStr}
                activeRow={activeRow}
                hoveredCell={hoveredCell}
                onLabelClick={handleLabelClick}
                onResidueClick={handleResidueClick}
                onResidueHover={handleResidueHover}
                onResidueLeave={handleResidueLeave}
                isMaster={true}
              />
            </div>
          )}

          {/* Active Annotation Tracks */}
          {Array.from(activeAnnotations).map(annotationId => {
            const annotation = annotationData[annotationId as keyof typeof annotationData];
            if (!annotation) return null;

            return (
              <div key={annotationId} style={{ marginBottom: '4px' }}>
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

          {/* Added Sequence Tracks */}
          {addedSequenceGroups.map((group, groupIndex) => (
            <div key={groupIndex} style={{ marginBottom: '4px' }}>
              <MsaTrack
                trackId={`added-${groupIndex}`}
                title={`${group.title} (${group.sequences.length})`}
                sequences={group.sequences}
                maxLength={maxLength}
                labelWidthPx={labelWidthPx}
                labelWidthStr={labelWidthStr}
                activeRow={activeRow}
                hoveredCell={hoveredCell}
                onLabelClick={handleLabelClick}
                onResidueClick={handleResidueClick}
                onResidueHover={handleResidueHover}
                onResidueLeave={handleResidueLeave}
                isMaster={false}
              />
            </div>
          ))}
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
    <div style={{ display: 'flex', alignItems: 'stretch', width: '100%' }}>
      {/* Label */}
      <div
        style={{
          width: `${labelWidthPx}px`,
          padding: '6px 8px', // Consistent padding
          display: 'flex',
          alignItems: 'center',
          fontSize: '11px',
          fontWeight: '500',
          color: '#374151',
          userSelect: 'none',
          flexShrink: 0,
          backgroundColor: '#f9fafb',
        }}
      >
        <div
          style={{
            width: '8px',
            height: '8px',
            backgroundColor: color,
            borderRadius: shape === 'circle' ? '50%' : '2px',
            marginRight: '6px',
            flexShrink: 0
          }}
        />
        <span style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
          {title}
        </span>
      </div>

      {/* Track */}
      <div style={{ flex: 1, lineHeight: 0 }}>
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

// MSA Track Component
interface MsaTrackProps {
  trackId: string;
  title: string;
  sequences: SequenceData[];
  maxLength: number;
  labelWidthPx: number;
  labelWidthStr: string;
  activeRow: MsaHighlight | null;
  hoveredCell: MsaHover | null;
  onLabelClick: (label: string, seqId: string, trackId: string, rowIndex: number) => void;
  onResidueClick: (seqId: string, position: number, trackId: string, rowIndex: number) => void;
  onResidueHover: (seqId: string, position: number, trackId: string, rowIndex: number) => void;
  onResidueLeave: () => void;
  isMaster: boolean;
}

function MsaTrack({
  trackId,
  title,
  sequences,
  maxLength,
  labelWidthPx,
  labelWidthStr,
  activeRow,
  hoveredCell,
  onLabelClick,
  onResidueClick,
  onResidueHover,
  onResidueLeave,
  isMaster
}: MsaTrackProps) {

  const msaRef = useRef<any>(null);

  // Setup event listeners
  useEffect(() => {
    const msaComponent = msaRef.current;
    if (!msaComponent || sequences.length === 0) return;

    msaComponent.data = sequences;

    const handleLabelClick = (event: any) => {
      const { label } = event.detail;
      const rowIndex = sequences.findIndex((seq) => seq.name === label);
      if (rowIndex !== -1) {
        onLabelClick(label, sequences[rowIndex].id, trackId, rowIndex);
      }
    };

    const handleResidueClick = (event: any) => {
      const { position, i } = event.detail;
      if (i >= 0 && i < sequences.length) {
        onResidueClick(sequences[i].id, position, trackId, i);
      }
    };

    const handleResidueMouseEnter = (event: any) => {
      const { position, i } = event.detail;
      if (i >= 0 && position >= 0 && i < sequences.length) {
        onResidueHover(sequences[i].id, position, trackId, i);
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
  }, [sequences, trackId, onLabelClick, onResidueClick, onResidueHover, onResidueLeave]);

  // Update features (highlighting)
  useEffect(() => {
    const msaComponent = msaRef.current;
    if (!msaComponent) return;

    const features = [];

    // Active row highlight
    if (activeRow && activeRow.msaKey === trackId) {
      features.push({
        id: 'active-row-highlight',
        sequences: { from: activeRow.rowIndex, to: activeRow.rowIndex },
        residues: { from: 1, to: maxLength },
        fillColor: isMaster ? "rgba(59, 130, 246, 0.2)" : "rgba(34, 197, 94, 0.2)",
        borderColor: isMaster ? "#3B82F6" : "#22C55E",
      });
    }

    // Hover cell highlight
    if (hoveredCell && hoveredCell.msaKey === trackId) {
      features.push({
        id: 'hover-cell-highlight',
        sequences: { from: hoveredCell.rowIndex, to: hoveredCell.rowIndex },
        residues: { from: hoveredCell.position + 1, to: hoveredCell.position + 1 },
        fillColor: '#00FF0066',
        borderColor: '#00FF00',
      });
    }

    msaComponent.features = features;
  }, [msaRef, activeRow, hoveredCell, trackId, maxLength, isMaster]);

  const height = Math.min(200, sequences.length * 16 + 30);

  return (
    // In MsaTrack component - replace the main container and label div
    <div style={{ display: 'flex', alignItems: 'stretch', width: '100%' }}>
      {/* Label */}
      <div
        style={{
          width: `${labelWidthPx}px`,
          padding: '8px', // Increased padding
          display: 'flex',
          alignItems: 'center', // Center vertically
          fontSize: '11px',
          fontWeight: '500',
          color: isMaster ? '#1E40AF' : '#059669',
          userSelect: 'none',
          flexShrink: 0,
          backgroundColor: '#f9fafb', // Light background to distinguish
        }}
      >
        <div
          style={{
            width: '3px',
            height: '12px',
            backgroundColor: isMaster ? '#3B82F6' : '#10B981',
            marginRight: '6px',
            flexShrink: 0,
            borderRadius: '1px'
          }}
        />
        <span style={{ whiteSpace: 'nowrap' }}>
          {title}
        </span>
      </div>

      {/* MSA Track */}
      <div style={{ flex: 1, lineHeight: 0 }}>
        <nightingale-msa
          ref={msaRef}
          height={height}
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
