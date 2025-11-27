// ControlPanel.tsx
import { MolstarService } from "@/components/molstar/molstar_service";
import { InputTabs } from "./InputTabs";
import { useSequenceStructureRegistry } from "./hooks/useSequenceStructureSync";

interface ControlPanelProps {
  molstarService: MolstarService | null;
  registry: ReturnType<typeof useSequenceStructureRegistry>;
  activeLabel: string | null;
  lastEventLog: string | null;
  onMutationClick?: (pdbId: string, chainId: string, masterIndex: number) => void;
}

export function ControlPanel({
  molstarService,
  registry,
  activeLabel,
  lastEventLog,
  onMutationClick  // ← ADD THIS
}: ControlPanelProps) {
  return (
    <>
      <InputTabs
        mainService={molstarService}
        registry={registry}
        onMutationClick={onMutationClick}  // ← ADD THIS
      />
      <div>
        <pre className="text-gray-800 bg-gray-50 p-1 rounded mt-1 overflow-x-auto border text-xs">
          {lastEventLog || "No events"}
        </pre>
      </div>
    </>
  );
}