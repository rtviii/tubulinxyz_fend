import { useState, useEffect } from 'react';

const API_BASE_URL = "http://localhost:8000";

export function useAlignmentData() {
  const [alignmentData, setAlignmentData] = useState<{ name: string; sequence: string }[]>([]);
  const [maxLength, setMaxLength] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAlignmentData = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/msaprofile/master`);
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
      } catch (err: any) {
        setError(`Failed to fetch alignment data: ${err.message}. Make sure the API is running.`);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAlignmentData();
  }, []);

  const addSequence = (newSequence: { name: string; sequence: string }) => {
    setAlignmentData(prev => [...prev, newSequence]);
  };

  return { alignmentData, maxLength, isLoading, error, addSequence };
}