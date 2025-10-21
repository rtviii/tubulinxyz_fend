// components/ControlPanel.tsx
// New file
import { MolstarService } from "@/components/molstar/molstar_service";
import { InputTabs } from "./InputTabs";
import { StatsPanel } from "./StatsPanel";
import { useSequenceStructureRegistry } from "./hooks/useSequenceStructureSync";

interface ControlPanelProps {
  molstarService: MolstarService | null;
  registry: ReturnType<typeof useSequenceStructureRegistry>;
  activeLabel: string | null;
  lastEventLog: string | null;
}

export function ControlPanel({
  molstarService,
  registry,
  activeLabel,
  lastEventLog
}: ControlPanelProps) {
  return (
    <>
      {/* Combined Input Component */}
      <InputTabs molstarService={molstarService} registry={registry} />

      {/* Compressed Stats Panel */}
      <StatsPanel
        registry={registry}
        activeLabel={activeLabel}
        lastEventLog={lastEventLog}
      />
    </>
  );
}