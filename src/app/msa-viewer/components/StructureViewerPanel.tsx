// components/StructureViewerPanel.tsx
import { MolstarNode } from "@/components/molstar/molstar_spec";
import { useSequenceStructureRegistry } from "../hooks/useSequenceStructureSync";
import { MolstarService } from "@/components/molstar/molstar_service";

interface StructureViewerPanelProps {
  molstarNodeRef: React.RefObject<HTMLDivElement>;
  mainInitialized: boolean;
  mainService: MolstarService | null;
  registry: ReturnType<typeof useSequenceStructureRegistry>;
}

export function StructureViewerPanel({
  molstarNodeRef,
  mainInitialized,
  mainService,
  registry
}: StructureViewerPanelProps) {
  const loadedStructures = Array.from(registry.structures.values()).map(s => s.pdbId);

  return (
    <div className="w-full h-full border rounded-lg p-2 bg-white flex flex-col">
      <h2 className="text-lg font-semibold mb-1">Structure Viewer</h2>
      
      {/* Removed nested border */}
      <div className="flex-1 overflow-hidden relative bg-gray-100 min-h-0 rounded-md">
        <MolstarNode ref={molstarNodeRef} />
        {!mainInitialized && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-75 z-10">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-gray-600">Initializing Molstar...</p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-1 text-xs text-gray-600">
        <p>Loaded: {loadedStructures.join(', ') || 'Loading...'}</p>
        <p className="mt-0.5">Select sequences in the MSA to explore corresponding structures.</p>
        <button
          onClick={() => registry.logState()}
          className="mt-1 px-1.5 py-0.5 text-xs bg-gray-200 hover:bg-gray-300 rounded"
        >
          Debug Registry
        </button>
      </div>
    </div>
  );
}