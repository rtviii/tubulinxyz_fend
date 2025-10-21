// components/StructureViewerPanel.tsx
import { MolstarNode } from "@/components/molstar/molstar_spec";
import { useSequenceStructureRegistry } from "../hooks/useSequenceStructureSync";

interface StructureViewerPanelProps {
  molstarNodeRef: React.RefObject<HTMLDivElement>;
  mainInitialized: boolean;
  mainService: any;
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
    <div className="flex-1 h-full border rounded-lg p-4 bg-white flex flex-col">
      <h2 className="text-lg font-semibold mb-2">Structure Viewer</h2>
      
      <div className="flex-1 border rounded-lg overflow-hidden relative bg-gray-100">
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

      <div className="mt-2 text-sm text-gray-600">
        <p>Loaded: {loadedStructures.join(', ') || 'Loading...'}</p>
        <p className="text-xs mt-1">Select sequences in the MSA to explore corresponding structures.</p>
        <button
          onClick={() => registry.logState()}
          className="mt-2 px-2 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded"
        >
          Debug Registry
        </button>
      </div>
    </div>
  );
}