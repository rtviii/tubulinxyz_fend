import { MolstarService } from "@/components/molstar/molstar_service";
import { InputTabs } from "./InputTabs";

interface ControlPanelProps {
  molstarService: MolstarService | null;
  lastEventLog: string | null;
  onChainAligned?: (pdbId: string, chainId: string) => void;
}

export function ControlPanel({
  molstarService,
  lastEventLog,
  onChainAligned,
}: ControlPanelProps) {
  return (
    <>
      <InputTabs
        mainService={molstarService}
        onChainAligned={onChainAligned}
      />
      <div>
        <pre className="text-gray-800 bg-gray-50 p-1 rounded mt-1 overflow-x-auto border text-xs">
          {lastEventLog || "No events"}
        </pre>
      </div>
    </>
  );
}