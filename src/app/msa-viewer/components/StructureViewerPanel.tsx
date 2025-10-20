// components/StructureViewerPanel.tsx
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { MolstarNode, MolstarNode_secondary } from "@/components/molstar/molstar_spec";
import { useSequenceStructureRegistry } from "../hooks/useSequenceStructureSync";

interface StructureViewerPanelProps {
  molstarNodeRef: React.RefObject<HTMLDivElement>;
  molstarNodeRef_secondary: React.RefObject<HTMLDivElement>;
  mainInitialized: boolean;
  auxInitialized: boolean;
  mainService: any;
  auxService: any;
  registry: ReturnType<typeof useSequenceStructureRegistry>;
}

export function StructureViewerPanel({
  molstarNodeRef,
  molstarNodeRef_secondary,
  mainInitialized,
  auxInitialized,
  mainService,
  auxService,
  registry
}: StructureViewerPanelProps) {
  // Get structures loaded in each viewer
  const mainStructures = Array.from(registry.structures.values())
    .filter(s => s.viewerInstance === 'main')
    .map(s => s.pdbId);
  
  const auxStructures = Array.from(registry.structures.values())
    .filter(s => s.viewerInstance === 'auxiliary')
    .map(s => s.pdbId);

  return (
    <div className="flex-1 h-full border rounded-lg p-4 bg-white flex flex-col">
      <h2 className="text-lg font-semibold mb-2">Structure Viewer</h2>

      <ResizablePanelGroup
        direction="vertical"
        className="flex-1 border rounded-lg overflow-hidden"
      >
        <ResizablePanel defaultSize={50} minSize={20}>
          <div className="h-full w-full relative bg-gray-100">
            <MolstarNode ref={molstarNodeRef} />
            {!mainInitialized && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-75 z-10">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                  <p className="text-gray-600">Initializing Main Molstar...</p>
                </div>
              </div>
            )}
          </div>
        </ResizablePanel>

        <ResizableHandle className="h-2 bg-gray-200 hover:bg-gray-300 transition-colors" />

        <ResizablePanel defaultSize={50} minSize={20}>
          <div className="h-full w-full relative bg-gray-100">
            <MolstarNode_secondary ref={molstarNodeRef_secondary} />
            {!auxInitialized && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-75 z-10">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400 mx-auto mb-2"></div>
                  <p className="text-gray-600">Initializing Aux Molstar...</p>
                </div>
              </div>
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      <div className="mt-2 text-sm text-gray-600">
        <p>Loaded (Main): {mainStructures.join(', ') || 'Loading...'}</p>
        <p>Loaded (Aux): {auxStructures.join(', ') || 'Loading...'}</p>
        <p className="text-xs mt-1">
          Select sequences in the MSA to explore corresponding structures.
        </p>
        <button
          onClick={() => registry.logState()}
          className="mt-2 px-2 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded"
        >
          🐛 Debug Registry
        </button>
      </div>
    </div>
  );
}