"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useMolstarService } from '@/components/molstar/molstar_service';
import { MolstarNode } from '@/components/molstar/molstar_spec';
import { useAppDispatch, useAppSelector } from '@/store/store';
import { selectStructure, selectSelectedStructure, selectIsLoading, selectError, setLoading, setError } from '@/store/slices/tubulin_structures';

const API_BASE_URL = "http://localhost:8000";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'nightingale-manager': any;
      'nightingale-navigation': any;
      'nightingale-msa': any;
      'nightingale-track': any;
      'nightingale-sequence': any;
    }
  }
}

export default function MSAViewerPage() {
  const [areComponentsLoaded, setAreComponentsLoaded] = useState(false);
  const [alignmentData, setAlignmentData] = useState<{ name: string, sequence: string }[]>([]);
  const [maxLength, setMaxLength] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const [lastEventLog, setLastEventLog] = useState<string | null>(null);

  const msaRef = useRef<any>(null);
  const molstarRef = useRef<HTMLDivElement>(null);

  const { isInitialized, service } = useMolstarService(molstarRef, 'main');
  const dispatch = useAppDispatch();
  const selectedStructure = useAppSelector(selectSelectedStructure);
  const isLoadingStructure = useAppSelector(selectIsLoading);
  const errorStructure = useAppSelector(selectError);

  const loadStructureWithCleanup = useCallback(async (
    pdbId: string,
    loadFunction: () => Promise<void>,
    source: 'url' | 'manual' | 'backend'
  ) => {
    if (!service?.controller) {
      console.log('Service or controller not ready');
      return false;
    }

    console.log(`Loading structure ${pdbId} from ${source}...`);
    try {
      await service.controller.clearCurrentStructure();
    } catch (clearError) {
      console.warn('Error during structure cleanup:', clearError);
    }

    dispatch(selectStructure(pdbId));
    dispatch(setLoading(true));

    try {
      await loadFunction();
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      return false;
    } finally {
      dispatch(setLoading(false));
    }
  }, [service, dispatch]);

  const handleStructureSelect = useCallback(async (pdbId: string) => {
    return await loadStructureWithCleanup(pdbId, async () => {
      await service!.controller.loadStructure(pdbId, {});
      await service!.viewer.representations.stylized_lighting();
    }, 'manual');
  }, [loadStructureWithCleanup, service]);
  useEffect(() => {
    const loadDefaultStructure = async () => {
      if (service && isInitialized) {
        try {
          const defaultPdbId = "5CJO";
          console.log(`Loading default structure: ${defaultPdbId}`);

          const success = await loadStructureWithCleanup(defaultPdbId, async () => {
            await service.controller.loadStructure(defaultPdbId, {});
            await service.viewer.representations.stylized_lighting();
          }, 'manual');

          if (success) {
            console.log(`Successfully loaded structure ${defaultPdbId} in MSA viewer`);
          } else {
            console.warn(`Failed to load default structure ${defaultPdbId}`);
          }
        } catch (error) {
          console.error("Error loading default structure:", error);
        }
      }
    };

    loadDefaultStructure();
  }, [service, isInitialized, loadStructureWithCleanup]);

  useEffect(() => {
    const loadNightingaleComponents = async () => {
      try {
        await import("@nightingale-elements/nightingale-manager");
        await import("@nightingale-elements/nightingale-msa");
        await import("@nightingale-elements/nightingale-track");
        await import("@nightingale-elements/nightingale-navigation");

        console.log("Nightingale components imported successfully.");
        await new Promise(resolve => setTimeout(resolve, 100));
        setAreComponentsLoaded(true);
      } catch (err) {
        console.error("Failed to load Nightingale components:", err);
        setError("Failed to load Nightingale visualization components. Check the browser console for details.");
      }
    };
    loadNightingaleComponents();
  }, []);

  useEffect(() => {
    const fetchAlignmentData = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/align/master-profile`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        const formattedSequences = data.sequences.map((record: any) => ({
          name: record.id.split('|')[0],
          sequence: record.sequence,
        }));

        setAlignmentData(formattedSequences);
        setMaxLength(data.alignment_length);
        console.log("Alignment data fetched and processed.");
      } catch (err: any) {
        console.error("Failed to fetch alignment data:", err);
        setError(`Failed to fetch alignment data: ${err.message}. Make sure the API is running.`);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAlignmentData();
  }, []);

  useEffect(() => {
    const msaComponent = msaRef.current;

    if (areComponentsLoaded && alignmentData.length > 0 && maxLength > 0 && msaComponent) {

      const handleLabelClick = (event: any) => {
        const { label } = event.detail;
        setActiveLabel(label);
        setLastEventLog(`EVENT: msa-active-label | Label: "${label}"`);

        const rowIndex = alignmentData.findIndex(seq => seq.name === label);
        if (rowIndex !== -1) {
          const highlight = {
            sequences: { from: rowIndex, to: rowIndex },
            residues: { from: 1, to: maxLength },
            fillColor: "rgba(59, 130, 246, 0.2)",
            borderColor: "#3B82F6",
          };
          msaComponent.features = [highlight];
        }
      };

      const handleResidueClick = (event: any) => {
        const { position, i } = event.detail;
        const sequenceName = alignmentData[i]?.name || 'Unknown';

        setActiveLabel(sequenceName);
        setLastEventLog(`EVENT: onResidueClick | Seq: "${sequenceName}" (Row ${i}) | Pos: ${position}`);

        const highlight = {
          sequences: { from: i, to: i },
          residues: { from: 1, to: maxLength },
          fillColor: "rgba(59, 130, 246, 0.2)",
          borderColor: "#3B82F6",
        };
        msaComponent.features = [highlight];
        msaComponent.activeLabel = sequenceName;
      };

      const handleResidueHover = (event: any) => {
        const { position, i } = event.detail;
        const sequenceName = alignmentData[i]?.name || 'Unknown';
        setLastEventLog(`EVENT: onResidueMouseEnter | Seq: "${sequenceName}" (Row ${i}) | Pos: ${position}`);
      };

      msaComponent.data = alignmentData;

      msaComponent.addEventListener('msa-active-label', handleLabelClick);
      msaComponent.addEventListener('onResidueClick', handleResidueClick);
      msaComponent.addEventListener('onResidueMouseEnter', handleResidueHover);

      return () => {
        msaComponent.removeEventListener('msa-active-label', handleLabelClick);
        msaComponent.removeEventListener('onResidueClick', handleResidueClick);
        msaComponent.removeEventListener('onResidueMouseEnter', handleResidueHover);
      };
    }
  }, [areComponentsLoaded, alignmentData, maxLength]);

  if (isLoading || !areComponentsLoaded) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Loading...</h1>
        {!areComponentsLoaded && <p>Loading Nightingale Components...</p>}
        {isLoading && <p>Fetching alignment data from the server...</p>}
        <p>If this takes more than a few seconds, please check the browser console for errors.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 bg-red-50 border border-red-200 rounded-lg">
        <h1 className="text-2xl font-bold text-red-700 mb-4">An Error Occurred</h1>
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-gray-50 p-4">
      <style>{`
        nightingale-msa .biowc-msa-label {
            font-size: 0.8rem; 
            color: #3B82F6; 
            background-color: transparent;
            padding-top: 2px;
            padding-bottom: 2px;
            transition: background-color 0.2s ease-in-out;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            cursor: pointer;
        }
        nightingale-msa .biowc-msa-label:nth-child(1),
        nightingale-msa .biowc-msa-label:nth-child(2) {
            background-color: #F3F4F6; 
            color: #4B5563; 
        }
        nightingale-msa .biowc-msa-label:hover {
            background-color: #DBEAFE !important; 
            font-weight: bold;
        }
    `}</style>

      <h1 className="text-2xl font-bold mb-4">Tubulin MSA Viewer</h1>

      <div className="flex gap-4">
        {/* Left Panel - MSA */}
        <div className="flex-1 border rounded-lg p-4 bg-white">
          <h2 className="text-lg font-semibold mb-2">Alignment</h2>
          <div className="border rounded overflow-auto">
            <nightingale-manager style={{ minWidth: "800px" }}>
              <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>

                <div style={{ lineHeight: 0, paddingLeft: '100px', marginBottom: '10px' }}>
                  <nightingale-navigation
                    height="50"
                    length={maxLength}
                    display-start="1"
                    display-end={maxLength}
                    highlight-color="#EB3BFF22"
                  />
                </div>

                <nightingale-msa
                  ref={msaRef}
                  height="300"
                  length={maxLength.toString()}
                  display-start="1"
                  display-end={maxLength.toString()}
                  color-scheme="clustal2"
                  label-width="100"
                  highlight-event="onmouseover"
                  highlight-color="#EB3BFF22"
                  overlay-conservation={false}
                />
              </div>
            </nightingale-manager>

            <div className="mt-4 p-4 border-t text-left">
              <div className="mb-2">
                <span className="text-sm font-semibold text-gray-600">Active Sequence: </span>
                <span className="font-mono text-blue-600 font-bold">{activeLabel || 'None'}</span>
              </div>
              <div>
                <span className="text-sm font-semibold text-gray-600">Last Event Log:</span>
                <pre className="text-sm text-gray-800 bg-gray-100 p-2 rounded mt-1 overflow-x-auto">
                  {lastEventLog || 'No events yet. Click or hover on the MSA.'}
                </pre>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Structure Viewer */}
        <div className="flex-1 border rounded-lg p-4 bg-white">
          <h2 className="text-lg font-semibold mb-2">Structure Viewer</h2>
          <div className="w-full h-96 border rounded bg-gray-100 overflow-hidden relative">
            <MolstarNode ref={molstarRef} />
            {!isInitialized && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-75 z-10">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                  <p className="text-gray-600">Initializing Molstar...</p>
                </div>
              </div>
            )}
            {isLoadingStructure && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-75 z-10">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                  <p className="text-gray-600">Loading structure...</p>
                </div>
              </div>
            )}
          </div>
          <div className="mt-2 text-sm text-gray-600">
            <p>Loaded: {selectedStructure || "5CJO"} (Tubulin structure)</p>
            {errorStructure && (
              <div className="text-red-500 text-sm mt-1 p-2 bg-red-50 rounded-md">{errorStructure}</div>
            )}
            <p className="text-xs">Select sequences in the MSA to explore corresponding structures</p>
          </div>
        </div>
      </div>
    </div>
  );
}