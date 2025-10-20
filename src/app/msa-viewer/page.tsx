"use client";

import { useEffect, useRef, useState } from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useMolstarService } from "@/components/molstar/molstar_service";
import {
  MolstarNode,
  MolstarNode_secondary,
} from "@/components/molstar/molstar_spec";
import { useAppDispatch, useAppSelector } from "@/store/store";
import {
  selectStructure,
  selectSelectedStructure,
  selectIsLoading,
  selectError,
  setLoading,
  setError,
} from "@/store/slices/tubulin_structures";

const API_BASE_URL = "http://localhost:8000";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "nightingale-manager": any;
      "nightingale-navigation": any;
      "nightingale-msa": any;
      "nightingale-track": any;
      "nightingale-sequence": any;
    }
  }
}

export default function MSAViewerPage() {
  const dispatch = useAppDispatch();
  
  const [areComponentsLoaded, setAreComponentsLoaded] = useState(false);
  const [alignmentData, setAlignmentData] = useState<
    { name: string; sequence: string }[]
  >([]);
  const [maxLength, setMaxLength] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setErrorState] = useState<string | null>(null);

  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const [lastEventLog, setLastEventLog] = useState<string | null>(null);

  const msaRef = useRef<any>(null);
  
  const molstarNodeRef = useRef<HTMLDivElement>(null);
  const molstarNodeRef_secondary = useRef<HTMLDivElement>(null);

  const mstar_service_main = useMolstarService(molstarNodeRef, 'main');
  const mstar_service_aux = useMolstarService(molstarNodeRef_secondary, 'auxiliary');

  const selectedStructure = useAppSelector(selectSelectedStructure);
  const isLoadingStructure = useAppSelector(selectIsLoading);
  const errorStructure = useAppSelector(selectError);

  // CRITICAL: Render MolstarNodes immediately (hidden during loading)
  // This ensures refs are available for the service hook
  const showContent = !isLoading && areComponentsLoaded && !error;

  // DEBUG: Check ref and service status
  useEffect(() => {
    console.log('🔍 DEBUG - Ref status:', {
      main_ref_current: !!molstarNodeRef.current,
      aux_ref_current: !!molstarNodeRef_secondary.current,
      main_ref_element: molstarNodeRef.current?.tagName,
      aux_ref_element: molstarNodeRef_secondary.current?.tagName,
    });
  }, []);

  useEffect(() => {
    console.log('🔍 DEBUG - Service states:', {
      main_initialized: mstar_service_main.isInitialized,
      main_has_service: !!mstar_service_main.service,
      main_has_ctx: !!mstar_service_main.service?.viewer?.ctx,
      aux_initialized: mstar_service_aux.isInitialized,
      aux_has_service: !!mstar_service_aux.service,
      aux_has_ctx: !!mstar_service_aux.service?.viewer?.ctx,
    });
  }, [mstar_service_main, mstar_service_aux]);

  // CRITICAL FIX: Use refs to track if structures have been loaded
  const mainStructureLoadedRef = useRef(false);
  const auxStructureLoadedRef = useRef(false);

  // FIXED: Separate effects for each service with proper guards
  useEffect(() => {
    const loadMainStructure = async () => {
      // Guard: Only load once
      if (mainStructureLoadedRef.current) {
        return;
      }

      // Guard: Ensure service is truly ready
      if (!mstar_service_main.service?.viewer?.ctx) {
        console.log("Main viewer not ready yet, skipping load");
        return;
      }

      if (!mstar_service_main.isInitialized) {
        console.log("Main service not initialized yet");
        return;
      }

      console.log("Loading default structure: 5CJO (main)");
      mainStructureLoadedRef.current = true;
      
      dispatch(setLoading(true));
      dispatch(selectStructure("5CJO"));
      
      try {
        await mstar_service_main.service.controller.loadStructure("5CJO", {});
        console.log("Successfully loaded 5CJO (main)");
      } catch (e) {
        console.error("Error loading 5CJO (main):", e);
        mainStructureLoadedRef.current = false; // Allow retry on error
        dispatch(
          setError(
            e instanceof Error ? e.message : "Failed to load main structure"
          )
        );
      } finally {
        dispatch(setLoading(false));
      }
    };

    loadMainStructure();
  }, [mstar_service_main.isInitialized, dispatch]);

  useEffect(() => {
    const loadAuxStructure = async () => {
      // Guard: Only load once
      if (auxStructureLoadedRef.current) {
        return;
      }

      // Guard: Ensure service is truly ready
      if (!mstar_service_aux.service?.viewer?.ctx) {
        console.log("Aux viewer not ready yet, skipping load");
        return;
      }

      if (!mstar_service_aux.isInitialized) {
        console.log("Aux service not initialized yet");
        return;
      }

      console.log("Loading default structure: 1JFF (aux)");
      auxStructureLoadedRef.current = true;
      
      try {
        await mstar_service_aux.service.controller.loadStructure("1JFF", {});
        console.log("Successfully loaded 1JFF (aux)");
      } catch (e) {
        console.error("Error loading 1JFF (aux):", e);
        auxStructureLoadedRef.current = false; // Allow retry on error
      }
    };

    loadAuxStructure();
  }, [mstar_service_aux.isInitialized, dispatch]);

  // Nightingale components loading
  useEffect(() => {
    const loadNightingaleComponents = async () => {
      try {
        await import("@nightingale-elements/nightingale-manager");
        await import("@nightingale-elements/nightingale-msa");
        await import("@nightingale-elements/nightingale-track");
        await import("@nightingale-elements/nightingale-navigation");

        console.log("Nightingale components imported successfully.");
        await new Promise((resolve) => setTimeout(resolve, 100));
        setAreComponentsLoaded(true);
      } catch (err) {
        console.error("Failed to load Nightingale components:", err);
        setErrorState(
          "Failed to load Nightingale visualization components. Check the browser console for details."
        );
      }
    };
    loadNightingaleComponents();
  }, []);

  // Fetch alignment data
  useEffect(() => {
    const fetchAlignmentData = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/align/master-profile`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        const formattedSequences = data.sequences.map((record: any) => ({
          name: record.id.split("|")[0],
          sequence: record.sequence,
        }));

        setAlignmentData(formattedSequences);
        setMaxLength(data.alignment_length);
        console.log("Alignment data fetched and processed.");
      } catch (err: any) {
        console.error("Failed to fetch alignment data:", err);
        setErrorState(
          `Failed to fetch alignment data: ${err.message}. Make sure the API is running.`
        );
      } finally {
        setIsLoading(false);
      }
    };
    fetchAlignmentData();
  }, []);

  // MSA event handlers
  useEffect(() => {
    const msaComponent = msaRef.current;

    if (
      areComponentsLoaded &&
      alignmentData.length > 0 &&
      maxLength > 0 &&
      msaComponent
    ) {
      const handleLabelClick = (event: any) => {
        const { label } = event.detail;
        setActiveLabel(label);
        setLastEventLog(`EVENT: msa-active-label | Label: "${label}"`);

        const rowIndex = alignmentData.findIndex((seq) => seq.name === label);
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
        const sequenceName = alignmentData[i]?.name || "Unknown";

        setActiveLabel(sequenceName);
        setLastEventLog(
          `EVENT: onResidueClick | Seq: "${sequenceName}" (Row ${i}) | Pos: ${position}`
        );

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
        const sequenceName = alignmentData[i]?.name || "Unknown";
        setLastEventLog(
          `EVENT: onResidueMouseEnter | Seq: "${sequenceName}" (Row ${i}) | Pos: ${position}`
        );
      };

      msaComponent.data = alignmentData;

      msaComponent.addEventListener("msa-active-label", handleLabelClick);
      msaComponent.addEventListener("onResidueClick", handleResidueClick);
      msaComponent.addEventListener("onResidueMouseEnter", handleResidueHover);

      return () => {
        msaComponent.removeEventListener("msa-active-label", handleLabelClick);
        msaComponent.removeEventListener("onResidueClick", handleResidueClick);
        msaComponent.removeEventListener(
          "onResidueMouseEnter",
          handleResidueHover
        );
      };
    }
  }, [areComponentsLoaded, alignmentData, maxLength]);

  return (
    <div className="w-full min-h-screen bg-gray-50 p-4">
      {/* Loading overlay */}
      {(isLoading || !areComponentsLoaded) && (
        <div className="fixed inset-0 bg-white z-50 flex items-center justify-center">
          <div className="p-8">
            <h1 className="text-2xl font-bold mb-4">Loading...</h1>
            {!areComponentsLoaded && <p>Loading Nightingale Components...</p>}
            {isLoading && <p>Fetching alignment data from the server...</p>}
            <p>
              If this takes more than a few seconds, please check the browser
              console for errors.
            </p>
          </div>
        </div>
      )}

      {/* Error overlay */}
      {error && (
        <div className="fixed inset-0 bg-white z-50 flex items-center justify-center">
          <div className="p-8 bg-red-50 border border-red-200 rounded-lg max-w-2xl">
            <h1 className="text-2xl font-bold text-red-700 mb-4">
              An Error Occurred
            </h1>
            <p className="text-red-600">{error}</p>
          </div>
        </div>
      )}
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
            {areComponentsLoaded && alignmentData.length > 0 && maxLength > 0 ? (
              <>
                <nightingale-manager style={{ minWidth: "800px" }}>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      width: "100%",
                    }}
                  >
                    <div
                      style={{
                        lineHeight: 0,
                        paddingLeft: "100px",
                        marginBottom: "10px",
                      }}
                    >
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
                    <span className="text-sm font-semibold text-gray-600">
                      Active Sequence:{" "}
                    </span>
                    <span className="font-mono text-blue-600 font-bold">
                      {activeLabel || "None"}
                    </span>
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-gray-600">
                      Last Event Log:
                    </span>
                    <pre className="text-sm text-gray-800 bg-gray-100 p-2 rounded mt-1 overflow-x-auto">
                      {lastEventLog || "No events yet. Click or hover on the MSA."}
                    </pre>
                  </div>
                </div>
              </>
            ) : (
              <div className="p-8 text-center text-gray-500">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p>Loading alignment visualization...</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Structure Viewer (Resizable) */}
        <div className="flex-1 border rounded-lg p-4 bg-white flex flex-col">
          <h2 className="text-lg font-semibold mb-2">Structure Viewer</h2>

          <ResizablePanelGroup
            direction="vertical"
            className="flex-1 border rounded-lg overflow-hidden"
          >
            {/* Main Viewer Panel */}
            <ResizablePanel defaultSize={50} minSize={20}>
              <div className="h-full w-full relative bg-gray-100">
                <MolstarNode ref={molstarNodeRef} />

                {/* Overlays for Main Viewer */}
                {!mstar_service_main.isInitialized && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-75 z-10">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                      <p className="text-gray-600">
                        Initializing Main Molstar...
                      </p>
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
            </ResizablePanel>

            <ResizableHandle className="h-2 bg-gray-200 hover:bg-gray-300 transition-colors" />

            {/* Auxiliary Viewer Panel */}
            <ResizablePanel defaultSize={50} minSize={20}>
              <div className="h-full w-full relative bg-gray-100">
                <MolstarNode_secondary ref={molstarNodeRef_secondary} />

                {/* Overlay for Aux Viewer */}
                {!mstar_service_aux.isInitialized && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-75 z-10">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400 mx-auto mb-2"></div>
                      <p className="text-gray-600">
                        Initializing Aux Molstar...
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>

          <div className="mt-2 text-sm text-gray-600">
            <p>Loaded (Main): {selectedStructure || "5CJO"}</p>
            <p>Loaded (Aux): 1JFF</p>
            {errorStructure && (
              <div className="text-red-500 text-sm mt-1 p-2 bg-red-50 rounded-md">
                {errorStructure}
              </div>
            )}
            <p className="text-xs">
              Select sequences in the MSA to explore corresponding structures.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}