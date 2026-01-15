// src/app/msalite/hooks/useLigandColoring.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  LigandAnnotation,
  getMockLigands,
  assignLigandColors,
  applyLigandColoring,
  clearLigandColoring,
} from '../services/ligandColorService';

interface UseLigandColoringOptions {
  onColoringChanged?: () => void;
}

export function useLigandColoring(options: UseLigandColoringOptions = {}) {
  const [availableLigands, setAvailableLigands] = useState<LigandAnnotation[]>([]);
  const [selectedLigandIds, setSelectedLigandIds] = useState<Set<string>>(new Set());
  const [ligandColors, setLigandColors] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  
  // Store callback in ref to avoid re-triggering effect
  const onColoringChangedRef = useRef(options.onColoringChanged);
  onColoringChangedRef.current = options.onColoringChanged;

  // Load ligands (mock for now, swap for real API later)
  const fetchLigands = useCallback(async () => {
    setIsLoading(true);
    try {
      // TODO: Replace with actual fetch
      // const response = await fetch('http://localhost:8000/annotations/ligands');
      // const data = await response.json();
      
      const ligands = getMockLigands();
      setAvailableLigands(ligands);
      setLigandColors(assignLigandColors(ligands));
    } catch (err) {
      console.error('Failed to fetch ligands:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Auto-fetch on mount
  useEffect(() => {
    fetchLigands();
  }, [fetchLigands]);

  // Apply coloring whenever selection changes
  useEffect(() => {
    if (availableLigands.length === 0) return;
    
    if (selectedLigandIds.size === 0) {
      clearLigandColoring();
    } else {
      applyLigandColoring(availableLigands, selectedLigandIds, ligandColors);
    }
    
    onColoringChangedRef.current?.();
  }, [selectedLigandIds, availableLigands, ligandColors]);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearLigandColoring();
  }, []);

  const toggleLigand = useCallback((ligandId: string) => {
    setSelectedLigandIds(prev => {
      const next = new Set(prev);
      if (next.has(ligandId)) {
        next.delete(ligandId);
      } else {
        next.add(ligandId);
      }
      return next;
    });
  }, []);

  const selectAllLigands = useCallback(() => {
    setSelectedLigandIds(new Set(availableLigands.map(l => l.ligandId)));
  }, [availableLigands]);

  const clearSelection = useCallback(() => {
    setSelectedLigandIds(new Set());
  }, []);

  const isLigandSelected = useCallback((ligandId: string) => {
    return selectedLigandIds.has(ligandId);
  }, [selectedLigandIds]);

  return {
    availableLigands,
    selectedLigandIds,
    ligandColors,
    isLoading,
    fetchLigands,
    toggleLigand,
    selectAllLigands,
    clearSelection,
    isLigandSelected,
    selectedCount: selectedLigandIds.size,
  };
}