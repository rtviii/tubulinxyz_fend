import { useEffect, useRef } from 'react';

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

  useEffect(() => {
    const msaComponent = msaRef.current;
    if (!msaComponent || alignmentData.length === 0) return;

    const handleLabelClick = (event: any) => {
      const { label } = event.detail;
      const rowIndex = alignmentData.findIndex((seq) => seq.name === label);
      if (rowIndex !== -1) {
        onLabelClick(label, rowIndex);
        const highlight = {
          sequences: { from: rowIndex, to: rowIndex },
          residues: { from: 1, to: maxLength },
          fillColor: "rgba(59, 130, 246, 0.2)",
          borderColor: "#3B82F6",
        };
        msaComponent.features = [highlight];
      }
    };

    const handleResidueClick = (event: any) => {
      const { position, i } = event.detail;
      const sequenceName = alignmentData[i]?.name || "Unknown";
      onResidueClick(sequenceName, i, position);
      const highlight = {
        sequences: { from: i, to: i },
        residues: { from: 1, to: maxLength },
        fillColor: "rgba(59, 130, 246, 0.2)",
        borderColor: "#3B82F6",
      };
      msaComponent.features = [highlight];
      msaComponent.activeLabel = sequenceName;
    };

    const handleResidueHover = (event: any) => {
      const { position, i } = event.detail;
      const sequenceName = alignmentData[i]?.name || "Unknown";
      onResidueHover(sequenceName, i, position);
    };

    msaComponent.data = alignmentData;

    msaComponent.addEventListener("msa-active-label", handleLabelClick);
    msaComponent.addEventListener("onResidueClick", handleResidueClick);
    msaComponent.addEventListener("onResidueMouseEnter", handleResidueHover);

    return () => {
      msaComponent.removeEventListener("msa-active-label", handleLabelClick);
      msaComponent.removeEventListener("onResidueClick", handleResidueClick);
      msaComponent.removeEventListener("onResidueMouseEnter", handleResidueHover);
    };
  }, [alignmentData, maxLength, onLabelClick, onResidueClick, onResidueHover]);

  return (
    <nightingale-manager style={{ minWidth: "800px" }}>
      <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
        <div style={{ lineHeight: 0, paddingLeft: "100px", marginBottom: "10px" }}>
          <nightingale-navigation
            height="50"
            length={500}
            display-start="1"
            display-end={500}
            highlight-color="#EB3BFF22"
          />
        </div>
        <nightingale-msa
          ref={msaRef}
          height="300"
          length={500}
          display-start="1"
          display-end={500}
          color-scheme="clustal2"
          label-width="100"
          highlight-event="onmouseover"
          highlight-color="#EB3BFF22"
          overlay-conservation={false}
        />
      </div>
    </nightingale-manager>
  );
}
