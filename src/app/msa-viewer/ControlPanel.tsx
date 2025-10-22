// ControlPanel.tsx
import { MolstarService } from "@/components/molstar/molstar_service";
import { InputTabs } from "./InputTabs";
import { StatsPanel } from "./StatsPanel";
import { useSequenceStructureRegistry } from "./hooks/useSequenceStructureSync";

interface ControlPanelProps {
  molstarService: MolstarService | null;
  auxiliaryService: MolstarService | null;
  registry: ReturnType<typeof useSequenceStructureRegistry>;
  activeLabel: string | null;
  lastEventLog: string | null;
}

export function ControlPanel({
  molstarService,
  auxiliaryService,
  registry,
  activeLabel,
  lastEventLog
}: ControlPanelProps) {
  return (
    <>
      <InputTabs 
        mainService={molstarService}
        auxiliaryService={auxiliaryService}
        registry={registry} 
      />

      <StatsPanel
        registry={registry}
        activeLabel={activeLabel}
        lastEventLog={lastEventLog}
      />
    </>
  );
}