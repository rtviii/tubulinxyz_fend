// src/app/msa-viewer/components/tracks/SingleSequenceTrack.tsx
import React, { useEffect, useRef } from 'react';
import { SequenceData, MsaHighlight, MsaHover } from '../msa-types';
import { mockRegionData } from '../msa-data';

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
  width?: number;
  msaTrackRefs: React.MutableRefObject<{ [key: string]: any }>;
}

export function SingleSequenceTrack({
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
  onToggleRegion,
  width
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
      if (typeof position === 'number') {
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

    if (hoveredCell && hoveredCell.seqId === sequence.id) {
      const nglPos = hoveredCell.position0 + 1;
      features.push({
        id: 'hover-cell-highlight',
        sequences: { from: 0, to: 0 },
        residues: { from: nglPos, to: nglPos },
        fillColor: '#00FF0066',
        borderColor: '#00FF00',
      });
    }

    msaComponent.features = features;
  }, [msaRef, activeSeq, hoveredCell, sequence.id, maxLength, isMaster]);

  useEffect(() => {
    // Handle mock regions
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

    // Handle mutations from database
    const mutationsRegionId = `${sequence.id}-mutations`;
    const mutationsTrack = regionTrackRefs.current[mutationsRegionId];
    
    if (mutationsTrack && enabledRegions.has('mutations')) {
      // @ts-ignore
      const mutations = sequence.origin?.type === 'pdb' ? sequence.origin.mutations || [] : [];
      
      const mutationFeatures = mutations.map((mut: any, idx: number) => ({
        accession: `mut_${idx}`,
        start: mut.master_index,
        end: mut.master_index,
        color: '#EF4444',
        shape: 'circle',
        tooltipContent: `${mut.from_residue}${mut.master_index}${mut.to_residue} (PDB: ${mut.pdb_auth_id})`
      }));
      
      mutationsTrack.data = mutationFeatures;
    } else if (mutationsTrack) {
      mutationsTrack.data = [];
    }
  }, [enabledRegions, sequence]);

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
            width={width}
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {/* Mutations from database */}
              {/* @ts-ignore */}
              {sequence.origin?.type === 'pdb' && sequence.origin.mutations && sequence.origin.mutations.length > 0 && (
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '3px 4px',
                    cursor: 'pointer',
                    fontSize: '9px',
                    transition: 'all 0.15s'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={enabledRegions.has('mutations')}
                    onChange={() => onToggleRegion('mutations')}
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
                      backgroundColor: '#EF4444',
                      borderRadius: '50%',
                      flexShrink: 0
                    }}
                  />
                  <span style={{ color: '#374151', fontWeight: '500' }}>
                    Mutations
                  </span>
                  <span style={{ color: '#9CA3AF', fontSize: '8px', marginLeft: 'auto' }}>
                    {/* @ts-ignore */}
                    ({sequence.origin.mutations.length})
                  </span>
                </label>
              )}

              {/* Mock regions */}
              {Object.entries(mockRegionData).map(([regionId, regionInfo]) => (
                <label
                  key={regionId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '3px 4px',
                    cursor: 'pointer',
                    fontSize: '9px',
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
          {/* Mutations track */}
          {/* @ts-ignore */}
          {enabledRegions.has('mutations') && sequence.origin?.type === 'pdb' && sequence.origin.mutations && (
            <div style={{ display: 'flex', width: '100%', height: `${regionTrackHeight}px`, marginBottom: '1px' }}>
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
                    backgroundColor: '#EF4444',
                    borderRadius: '50%',
                    flexShrink: 0
                  }}
                />
                <div style={{
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  Mutations
                </div>
              </div>

              <div style={{ flex: 1, height: `${regionTrackHeight}px`, lineHeight: 0 }}>
                <nightingale-track
                  ref={el => regionTrackRefs.current[`${sequence.id}-mutations`] = el}
                  height={regionTrackHeight}
                  length={maxLength}
                  display-start="1"
                  display-end={maxLength}
                  layout="non-overlapping"
                  highlight-event="onmouseover"
                  width={width}
                />
              </div>
            </div>
          )}

          {/* Mock region tracks */}
          {Array.from(enabledRegions).filter(r => r !== 'mutations').map(regionId => {
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
                    width={width}
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
