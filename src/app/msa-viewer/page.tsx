"use client";
import { useEffect, useRef, useState } from "react";
import { useMolstarService } from '@/components/molstar/molstar_service';
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
  const molstarContainerRef = useRef<HTMLDivElement>(null);

  const { service, isInitialized } = useMolstarService(molstarContainerRef, 'main');

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

  // Effect to fetch alignment data from the API
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
        // This is the correct alignment length from your API
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

  // Effect to initialize Molstar with a default structure
  useEffect(() => {
    const loadDefaultStructure = async () => {
      if (service && isInitialized) {
        try {
          // Load a default tubulin structure - using 6S8L as an example
          const defaultPdbId = "5CJO";
          // const defaultClassification: TubulinClassification = {
          //   alpha: ['A', 'C', 'E'],
          //   beta: ['B', 'D', 'F'],
          //   gamma: [],
          //   delta: [],
          //   epsilon: [],
          //   other: []
          // };
          
          console.log(`Loading default structure: ${defaultPdbId}`);
          const success = await service.controller.loadStructure(defaultPdbId, {});
          
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
  }, [service, isInitialized]);

  // Effect to set data on Nightingale components and add event listeners
  useEffect(() => {
    const msaComponent = msaRef.current;
    
    // Ensure all dependencies are ready
    if (areComponentsLoaded && alignmentData.length > 0 && maxLength > 0 && msaComponent) {
      
      // --- Event Handlers ---

      // 1. Handles clicks on the sequence labels
      const handleLabelClick = (event: any) => {
        const { label } = event.detail;
        setActiveLabel(label); // Update React state
        setLastEventLog(`EVENT: msa-active-label | Label: "${label}"`);

        // Find the index of the clicked label to create the highlight
        const rowIndex = alignmentData.findIndex(seq => seq.name === label);
        if (rowIndex !== -1) {
          const highlight = {
            sequences: { from: rowIndex, to: rowIndex }, // Row index
            residues: { from: 1, to: maxLength },       // Full width
            fillColor: "rgba(59, 130, 246, 0.2)",     // Light blue fill
            borderColor: "#3B82F6",                   // Blue border
          };
          msaComponent.features = [highlight]; // Set the highlight feature
          // Note: The component updates its own 'activeLabel' property internally here
        }
      };

      // 2. Handles clicks on the residues (canvas area)
      const handleResidueClick = (event: any) => {
        const { position, i } = event.detail; // 'i' is the row index
        const sequenceName = alignmentData[i]?.name || 'Unknown';
        
        setActiveLabel(sequenceName); // Update React state
        setLastEventLog(`EVENT: onResidueClick | Seq: "${sequenceName}" (Row ${i}) | Pos: ${position}`);

        // Create highlight feature for the clicked row index 'i'
        const highlight = {
          sequences: { from: i, to: i },
          residues: { from: 1, to: maxLength },
          fillColor: "rgba(59, 130, 246, 0.2)",
          borderColor: "#3B82F6",
        };
        msaComponent.features = [highlight]; // Set the highlight feature
        
        // --- THIS IS THE FIX ---
        // Programmatically set the component's 'activeLabel' property
        // to make the label bold, syncing it with the canvas click.
        msaComponent.activeLabel = sequenceName;
      };
      
      // 3. Handles mouse hover over residues (canvas area)
      const handleResidueHover = (event: any) => {
         const { position, i } = event.detail;
         const sequenceName = alignmentData[i]?.name || 'Unknown';
         setLastEventLog(`EVENT: onResidueMouseEnter | Seq: "${sequenceName}" (Row ${i}) | Pos: ${position}`);
      };

      // --- Set Data & Attach Listeners ---
      
      msaComponent.data = alignmentData;

      msaComponent.addEventListener('msa-active-label', handleLabelClick);
      msaComponent.addEventListener('onResidueClick', handleResidueClick);
      msaComponent.addEventListener('onResidueMouseEnter', handleResidueHover);

      // --- Cleanup Function ---
      return () => {
        msaComponent.removeEventListener('msa-active-label', handleLabelClick);
        msaComponent.removeEventListener('onResidueClick', handleResidueClick);
        msaComponent.removeEventListener('onResidueMouseEnter', handleResidueHover);
      };
    }
  // Re-run this effect if components, data, or maxLength change
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
        
        /* This style is now controlled by the component's 'activeLabel' prop */
        /*
        nightingale-msa .biowc-msa-label.active {
            font-weight: bold;
            background-color: #DBEAFE;
        }
        */
        
        /* Molstar container styling */
        .molstar-container {
          width: 100%;
          height: 100%;
          position: relative;
        }
        
        .molstar-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          background-color: #f8fafc;
          color: #64748b;
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
                  {/* Both length and display-end are set by maxLength from the API */}
                  <nightingale-navigation
                    height="50"
                    length={maxLength}
                    display-start="1"
                    display-end={maxLength}
                    highlight-color="#EB3BFF22"
                  />
                </div>

                {/* MSA viewer */}
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
            
            {/* Real-time Event Log */}
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
          <div className="w-full h-96 border rounded bg-gray-100 overflow-hidden">
            
            <div 
              ref={molstarContainerRef} 
              className="molstar-container"
              style={{ width: '100%', height: '100%', minHeight: '384px' }}
            >
              {!isInitialized && (
                <div className="molstar-loading">
                  <div className="text-center">
                    <p className="mb-2">Loading Molstar Structure Viewer...</p>
                    <p className="text-sm text-gray-500">Loading structure 6S8L</p>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="mt-2 text-sm text-gray-600">
            <p>Loaded: 6S8L (Tubulin structure)</p>
            <p className="text-xs">Select sequences in the MSA to explore corresponding structures</p>
          </div>
        </div>
      </div>
    </div>
  );
}