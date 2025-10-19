"use client";

import { useEffect, useRef, useState } from "react";

// Define the base URL for your API
const API_BASE_URL = "http://localhost:8000";

// TypeScript declarations for the web components
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
  // State for component and data loading status
  const [areComponentsLoaded, setAreComponentsLoaded] = useState(false);
  const [alignmentData, setAlignmentData] = useState<{ name: string, sequence: string }[]>([]);
  const [maxLength, setMaxLength] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // State for event tracking
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const [lastEventLog, setLastEventLog] = useState<string | null>(null);

  // Ref for the main MSA component
  const msaRef = useRef<any>(null);

  // Effect to load Nightingale web components dynamically
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

  // Effect to set data on Nightingale components and add event listeners
  useEffect(() => {
    const msaComponent = msaRef.current;
    
    // Check if components are loaded, data is present, and ref is attached
    if (areComponentsLoaded && alignmentData.length > 0 && msaComponent) {
      
      // --- Event Handlers ---

      // 1. Handles clicks on the sequence labels (as per your wiki)
      const handleLabelClick = (event: any) => {
        const { label } = event.detail;
        setActiveLabel(label);
        setLastEventLog(`EVENT: msa-active-label | Label: "${label}"`);
        console.log("msa-active-label event:", event.detail);
      };

      // 2. Handles clicks on the residues (canvas area)
      const handleResidueClick = (event: any) => {
        const { position, i } = event.detail;
        // Correlate row index 'i' with our data
        const sequenceName = alignmentData[i]?.name || 'Unknown';
        setActiveLabel(sequenceName); // Also set active label on residue click
        setLastEventLog(`EVENT: onResidueClick | Seq: "${sequenceName}" (Row ${i}) | Pos: ${position}`);
        console.log("onResidueClick event:", event.detail);
      };
      
      // 3. Handles mouse hover over residues (canvas area)
      const handleResidueHover = (event: any) => {
         const { position, i } = event.detail;
         const sequenceName = alignmentData[i]?.name || 'Unknown';
         setLastEventLog(`EVENT: onResidueMouseEnter | Seq: "${sequenceName}" (Row ${i}) | Pos: ${position}`);
      };

      // --- Set Data & Attach Listeners ---
      
      // Set the MSA data
      msaComponent.data = alignmentData;

      // Add all event listeners
      msaComponent.addEventListener('msa-active-label', handleLabelClick);
      msaComponent.addEventListener('onResidueClick', handleResidueClick);
      msaComponent.addEventListener('onResidueMouseEnter', handleResidueHover);

      // --- Cleanup Function ---
      // This is crucial to prevent memory leaks when the component unmounts
      return () => {
        msaComponent.removeEventListener('msa-active-label', handleLabelClick);
        msaComponent.removeEventListener('onResidueClick', handleResidueClick);
        msaComponent.removeEventListener('onResidueMouseEnter', handleResidueHover);
      };
    }
    // Re-run this effect if components or data change
  }, [areComponentsLoaded, alignmentData]);

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
            cursor: pointer; /* Add cursor pointer */
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
                    length={maxLength.toString()}
                    display-start="1"
                    display-end={maxLength.toString()}
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
                  highlight-event="onmouseover" /* Re-enabled for hover */
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
          <div className="w-full h-96 border rounded bg-gray-100 flex items-center justify-center">
            <div className="text-center text-gray-500">
              <p>Molstar Structure Viewer</p>
              <p className="text-sm mt-2">Select a sequence to load structure</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
