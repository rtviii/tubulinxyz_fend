// src/app/msa-viewer/components/tracks/AnnotationTrack.tsx
import React from 'react';

interface AnnotationTrackProps {
  trackId     : string;
  title       : string;
  color       : string;
  shape       : string;
  features    : any[];
  maxLength   : number;
  labelWidthPx: number;
  trackRefs   : React.MutableRefObject<{ [key: string]: any }>;
}

export function AnnotationTrack({
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
          width          : `${labelWidthPx}px`,
          minWidth       : `${labelWidthPx}px`,
          height         : '20px',
          padding        : '2px 6px',
          display        : 'flex',
          alignItems     : 'center',
          fontSize       : '10px',
          fontWeight     : '500',
          color          : '#374151',
          backgroundColor: '#f9fafb',
          boxSizing      : 'border-box',
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