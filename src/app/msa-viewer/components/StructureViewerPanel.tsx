// components/StructureViewerPanel.tsx
import { MolstarNode } from "@/components/molstar/molstar_spec";
import { useSequenceStructureRegistry } from "../hooks/useSequenceStructureSync";
import { MolstarService } from "@/components/molstar/molstar_service";

interface StructureViewerPanelProps {
  mainNodeRef: React.RefObject<HTMLDivElement>;
  auxiliaryNodeRef: React.RefObject<HTMLDivElement>;
  mainInitialized: boolean;
  auxiliaryInitialized: boolean;
  mainService: MolstarService | null;
  auxiliaryService: MolstarService | null;
  registry: ReturnType<typeof useSequenceStructureRegistry>;
}

export function StructureViewerPanel({
  mainNodeRef,
  auxiliaryNodeRef,
  mainInitialized,
  auxiliaryInitialized,
  mainService,
  auxiliaryService,
  registry
}: StructureViewerPanelProps) {
  const mainStructures = Array.from(registry.structures.values())
    .filter(s => s.viewerId === 'main')
    .map(s => s.pdbId);
    
  const auxiliaryStructures = Array.from(registry.structures.values())
    .filter(s => s.viewerId === 'auxiliary')
    .map(s => s.pdbId);

  return (
    <div className="w-full h-full border rounded-lg p-2 bg-white flex flex-col">
      {/* <h2 className="text-lg font-semibold mb-2">Structure Viewers</h2> */}
      
      <div className="flex-1 flex gap-2 min-h-0">
        {/* Main Viewer - Left */}
        <div className="flex-1 flex flex-col">
          <div className="text-xs font-medium text-gray-700 mb-1 px-1">
            Main: {mainStructures.join(', ') || 'None'}
          </div>
          <div className="flex-1 overflow-hidden relative bg-gray-100 rounded-md">
            <MolstarNode ref={mainNodeRef} />
            {!mainInitialized && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-75 z-10">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                  <p className="text-gray-600">Initializing Main...</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Auxiliary Viewer - Right */}
        <div className="flex-1 flex flex-col">
          <div className="text-xs font-medium text-gray-700 mb-1 px-1">
            Auxiliary: {auxiliaryStructures.join(', ') || 'None'}
          </div>
          <div className="flex-1 overflow-hidden relative bg-gray-100 rounded-md">
            <MolstarNode ref={auxiliaryNodeRef} />
            {!auxiliaryInitialized && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-75 z-10">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-2"></div>
                  <p className="text-gray-600">Initializing Auxiliary...</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-1 text-xs text-gray-600">
        <p className="mt-0.5">Hover over MSA positions to highlight corresponding residues in all structures.</p>
      </div>
    </div>
  );
}