// ControlPanel.tsx
import { MolstarService } from "@/components/molstar/molstar_service";
import { InputTabs } from "./InputTabs";
// import { StatsPanel } from "./StatsPanel";
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

        {/* <span className="font-semibold text-gray-600">Last Event:</span> */}
      <div>
        <pre className="text-gray-800 bg-gray-50 p-1 rounded mt-1 overflow-x-auto border text-xs">
          {lastEventLog || "No events"}
        </pre>
      </div>
      {/* <StatsPanel
        registry={registry}
        activeLabel={activeLabel}
        lastEventLog={lastEventLog}
      /> */}
    </>
  );
}