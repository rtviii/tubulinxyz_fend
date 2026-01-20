import { MolstarNode } from "@/components/molstar/spec";
import { useAppSelector } from "@/store/store";

interface StructureViewerPanelProps {
  mainNodeRef: React.RefObject<HTMLDivElement>;
  mainInitialized: boolean;
}

export function StructureViewerPanel({
  mainNodeRef,
  mainInitialized,
}: StructureViewerPanelProps) {
  const currentStructure = useAppSelector(state => state.molstarRefs.currentStructure);

  return (
    <div className="w-full h-full border rounded-lg p-2 bg-white flex flex-col">
      <div className="flex-1 flex flex-col">
        <div className="text-xs font-medium text-gray-700 mb-1 px-1">
          Loaded: {currentStructure || 'None'}
        </div>
        <div className="flex-1 overflow-hidden relative bg-gray-100 rounded-md">
          <MolstarNode ref={mainNodeRef} />
          {!mainInitialized && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-75 z-10">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-gray-600">Initializing Viewer...</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-1 text-xs text-gray-600">
        <p className="mt-0.5">Hover over MSA positions to highlight corresponding residues.</p>
      </div>
    </div>
  );
}