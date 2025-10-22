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

// Mock functional regions for PDB sequences
const mockRegionData = {
  ligand_binding: {
    name: 'Ligand Binding',
    color: '#EC4899',
    shape: 'rectangle' as const,
    features: [
      { accession: 'lig1', start: 120, end: 127, color: '#EC4899', shape: 'rectangle', tooltipContent: 'Substrate binding pocket' },
      { accession: 'lig2', start: 180, end: 186, color: '#EC4899', shape: 'rectangle', tooltipContent: 'Cofactor binding' }
    ]
  },
  catalytic_site: {
    name: 'Catalytic Site',
    color: '#F97316',
    shape: 'diamond' as const,
    features: [
      { accession: 'cat1', start: 95, end: 95, color: '#F97316', shape: 'diamond', tooltipContent: 'Catalytic residue H95' },
      { accession: 'cat2', start: 140, end: 140, color: '#F97316', shape: 'diamond', tooltipContent: 'Catalytic residue D140' },
      { accession: 'cat3', start: 165, end: 165, color: '#F97316', shape: 'diamond', tooltipContent: 'Catalytic residue S165' }
    ]
  },
  protein_interface: {
    name: 'Protein Interface',
    color: '#06B6D4',
    shape: 'rectangle' as const,
    features: [
      { accession: 'int1', start: 35, end: 43, color: '#06B6D4', shape: 'rectangle', tooltipContent: 'Dimer interface α1' },
      { accession: 'int2', start: 200, end: 208, color: '#06B6D4', shape: 'rectangle', tooltipContent: 'Dimer interface α2' }
    ]
  },
  regulatory_site: {
    name: 'Regulatory Site',
    color: '#A855F7',
    shape: 'circle' as const,
    features: [
      { accession: 'reg1', start: 72, end: 72, color: '#A855F7', shape: 'circle', tooltipContent: 'Phosphorylation site T72' },
      { accession: 'reg2', start: 145, end: 145, color: '#A855F7', shape: 'circle', tooltipContent: 'Allosteric site' }
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
  
  // Track which sequences have regions panel expanded
  const [expandedRegions, setExpandedRegions] = useState<Set<string>>(new Set());
  
  // Track which regions are enabled for each sequence
  const [enabledRegions, setEnabledRegions] = useState<Map<string, Set<string>>>(new Map());

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
                isRegionsExpanded={false}
                onToggleRegions={() => {}}
                enabledRegions={new Set()}
                onToggleRegion={() => {}}
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
                  onResidueClick={handleResidueClick}
                  onResidueHover={handleResidueHover}
                  onResidueLeave={handleResidueLeave}
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
  isRegionsExpanded: boolean;
  onToggleRegions: () => void;
  enabledRegions: Set<string>;
  onToggleRegion: (regionId: string) => void;
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
  isMaster,
  isRegionsExpanded,
  onToggleRegions,
  enabledRegions,
  onToggleRegion
}: SingleSequenceTrackProps) {

  const msaRef = useRef<any>(null);
  const regionTrackRefs = useRef<{ [key: string]: any }>({});
  const rowHeight = 18;
  const regionTrackHeight = 16;

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

  // Update region tracks when enabled regions change
  useEffect(() => {
    Object.entries(mockRegionData).forEach(([regionId, regionInfo]) => {
      const track = regionTrackRefs.current[`${sequence.id}-${regionId}`];
      if (track) {
        if (enabledRegions.has(regionId)) {
          track.data = regionInfo.features;
        } else {
          track.data = [];
        }
      }
    });
  }, [enabledRegions, sequence.id]);

  const hasEnabledRegions = enabledRegions.size > 0;

  return (
    <div style={{ width: '100%' }}>
      {/* Main sequence row */}
      <div style={{ display: 'flex', width: '100%', height: `${rowHeight}px` }}>
        <div
          style={{
            width: `${labelWidthPx}px`,
            minWidth: `${labelWidthPx}px`,
            height: `${rowHeight}px`,
            padding: '2px 4px',
            display: 'flex',
            alignItems: 'center',
            fontSize: '10px',
            fontWeight: '500',
            color: isMaster ? '#1E40AF' : '#059669',
            backgroundColor: isMaster ? '#EFF6FF' : '#ECFDF5',
            boxSizing: 'border-box',
            borderLeft: `3px solid ${isMaster ? '#3B82F6' : '#10B981'}`,
            gap: '4px'
          }}
        >
          {!isMaster && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleRegions();
              }}
              style={{
                width: '14px',
                height: '14px',
                minWidth: '14px',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isRegionsExpanded ? '#10B981' : '#D1D5DB',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '10px',
                fontWeight: 'bold',
                transition: 'all 0.2s',
                flexShrink: 0
              }}
              title="Toggle functional regions"
            >
              {isRegionsExpanded ? '−' : '+'}
            </button>
          )}
          <div 
            onClick={() => onLabelClick(sequence.name, sequence.id)}
            style={{ 
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
              cursor: 'pointer',
              // overflow: 'hidden'
            }}
          >
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

      {/* Collapsible regions panel */}
      {!isMaster && (
        <div
          style={{
            maxHeight: isRegionsExpanded ? '300px' : '0',
            overflow: 'hidden',
            transition: 'max-height 0.3s ease-in-out',
            backgroundColor: '#F9FAFB',
            borderLeft: '3px solid #10B981'
          }}
        >
          <div style={{ padding: '6px' }}>
            <div style={{ 
              fontSize: '9px', 
              fontWeight: '600', 
              color: '#6B7280',
              marginBottom: '4px',
              paddingLeft: '2px'
            }}>
              Functional Regions
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {Object.entries(mockRegionData).map(([regionId, regionInfo]) => (
                <label
                  key={regionId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '3px 4px',
                    backgroundColor: enabledRegions.has(regionId) ? '#E0F2FE' : 'white',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    fontSize: '9px',
                    border: `1px solid ${enabledRegions.has(regionId) ? '#BAE6FD' : '#E5E7EB'}`,
                    transition: 'all 0.15s'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={enabledRegions.has(regionId)}
                    onChange={() => onToggleRegion(regionId)}
                    style={{
                      width: '12px',
                      height: '12px',
                      cursor: 'pointer',
                      flexShrink: 0
                    }}
                  />
                  <div
                    style={{
                      width: '8px',
                      height: '8px',
                      backgroundColor: regionInfo.color,
                      borderRadius: regionInfo.shape === 'circle' ? '50%' : '2px',
                      flexShrink: 0
                    }}
                  />
                  <span style={{ color: '#374151', fontWeight: '500' }}>
                    {regionInfo.name}
                  </span>
                  <span style={{ color: '#9CA3AF', fontSize: '8px', marginLeft: 'auto' }}>
                    ({regionInfo.features.length})
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Enabled region tracks */}
      {!isMaster && hasEnabledRegions && (
        <div style={{ width: '100%' }}>
          {Array.from(enabledRegions).map(regionId => {
            const regionInfo = mockRegionData[regionId as keyof typeof mockRegionData];
            if (!regionInfo) return null;

            return (
              <div key={regionId} style={{ display: 'flex', width: '100%', height: `${regionTrackHeight}px`, marginBottom: '1px' }}>
                <div
                  style={{
                    width: `${labelWidthPx}px`,
                    minWidth: `${labelWidthPx}px`,
                    height: `${regionTrackHeight}px`,
                    padding: '2px 6px 2px 24px',
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: '8px',
                    fontWeight: '500',
                    color: '#6B7280',
                    backgroundColor: '#F9FAFB',
                    boxSizing: 'border-box',
                    borderLeft: '3px solid #10B981',
                    gap: '3px'
                  }}
                >
                  <div
                    style={{
                      width: '5px',
                      height: '5px',
                      backgroundColor: regionInfo.color,
                      borderRadius: regionInfo.shape === 'circle' ? '50%' : '1px',
                      flexShrink: 0
                    }}
                  />
                  <div style={{ 
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden'
                  }}>
                    {regionInfo.name}
                  </div>
                </div>

                <div style={{ flex: 1, height: `${regionTrackHeight}px`, lineHeight: 0 }}>
                  <nightingale-track
                    ref={el => regionTrackRefs.current[`${sequence.id}-${regionId}`] = el}
                    height={regionTrackHeight}
                    length={maxLength}
                    display-start="1"
                    display-end={maxLength}
                    layout="non-overlapping"
                    highlight-event="onmouseover"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
