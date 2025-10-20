// components/MSADisplay.tsx
import { useEffect, useRef, useState, useCallback } from 'react';

interface MSADisplayProps {
  alignmentData: { name: string; sequence: string }[];
  maxLength: number;
  onLabelClick: (label: string, rowIndex: number) => void;
  onResidueClick: (sequenceName: string, rowIndex: number, position: number) => void;
  onResidueHover: (sequenceName: string, rowIndex: number, position: number) => void;
}

export function MSADisplay({
  alignmentData,
  maxLength,
  onLabelClick,
  onResidueClick,
  onResidueHover
}: MSADisplayProps) {
  const msaRef = useRef<any>(null);
  const [hoveredCell, setHoveredCell] = useState<{
    rowIndex: number;
    position: number;
  } | null>(null);

  // Update features when hover changes
  useEffect(() => {
    const msaComponent = msaRef.current;
    if (!msaComponent) return;

    if (hoveredCell) {
      // Create a single-cell highlight feature
      msaComponent.features = [{
        id: 'hover-highlight',
        residues: { 
          from: hoveredCell.position + 1,  // 1-based
          to: hoveredCell.position + 1 
        },
        sequences: { 
          from: hoveredCell.rowIndex, 
          to: hoveredCell.rowIndex 
        },
        fillColor: '#00FF0066',       // Semi-transparent green
        borderColor: '#00FF00',        // Solid green border
      }];
    } else {
      // Clear features when not hovering
      msaComponent.features = [];
    }
  }, [hoveredCell]);

  useEffect(() => {
    const msaComponent = msaRef.current;
    if (!msaComponent || alignmentData.length === 0) return;

    // Set the data
    msaComponent.data = alignmentData;

    // Label click handler
    const handleLabelClick = (event: any) => {
      const { label } = event.detail;
      const rowIndex = alignmentData.findIndex((seq) => seq.name === label);
      if (rowIndex !== -1) {
        onLabelClick(label, rowIndex);
        
        // Highlight entire row
        const highlight = {
          id: 'row-highlight',
          sequences: { from: rowIndex, to: rowIndex },
          residues: { from: 1, to: maxLength },
          fillColor: "rgba(59, 130, 246, 0.2)",
          borderColor: "#3B82F6",
        };
        msaComponent.features = [highlight];
      }
    };

    // Residue click handler
    const handleResidueClick = (event: any) => {
      const { position, i } = event.detail;
      const sequenceName = alignmentData[i]?.name || "Unknown";
      onResidueClick(sequenceName, i, position);
      
      // Highlight entire row
      const highlight = {
        id: 'row-highlight',
        sequences: { from: i, to: i },
        residues: { from: 1, to: maxLength },
        fillColor: "rgba(59, 130, 246, 0.2)",
        borderColor: "#3B82F6",
      };
      msaComponent.features = [highlight];
      msaComponent.activeLabel = sequenceName;
    };

    // Residue hover handler - THIS IS THE KEY EVENT
    const handleResidueMouseEnter = (event: any) => {
      const { position, i } = event.detail;
      
      if (i >= 0 && position >= 0 && i < alignmentData.length) {
        setHoveredCell({ rowIndex: i, position });
        
        const sequenceName = alignmentData[i]?.name || "Unknown";
        onResidueHover(sequenceName, i, position);
      }
    };

    // Clear hover when mouse leaves a residue
    const handleResidueMouseLeave = (event: any) => {
      setHoveredCell(null);
    };

    // Add all event listeners
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
  }, [alignmentData, maxLength, onLabelClick, onResidueClick, onResidueHover]);

  return (
    <nightingale-manager style={{ minWidth: "800px" }}>
      <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
        <div style={{ lineHeight: 0, paddingLeft: "100px", marginBottom: "10px" }}>
          <nightingale-navigation
            height="50"
            length={maxLength}
            display-start="1"
            display-end={maxLength}
            highlight-color="#EB3BFF22"
          />
        </div>
        <nightingale-msa
          ref={msaRef}
          height="300"
          length={maxLength}
          display-start="1"
          display-end={maxLength}
          color-scheme="clustal2"
          label-width="100"
          highlight-event="onmouseover"
          highlight-color="#00FF0044"
          overlay-conservation={false}
        />
      </div>
    </nightingale-manager>
  );
}
