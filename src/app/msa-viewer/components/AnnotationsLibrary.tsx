// components/AnnotationsLibrary.tsx
import { useState } from 'react';

interface AnnotationsLibraryProps {
  activeAnnotations: Set<string>;
  setActiveAnnotations: (annotations: Set<string>) => void;
}

interface AnnotationItem {
  id: string;
  name: string;
  color: string;
  shape: string;
  features: Array<{
    start: number;
    end: number;
    label?: string;
  }>;
}

export function AnnotationsLibrary({ activeAnnotations, setActiveAnnotations }: AnnotationsLibraryProps) {
  // Compact mock annotations data
  const annotations: AnnotationItem[] = [
    {
      id: 'phosphorylation',
      name: 'Phosphorylation',
      color: '#3B82F6',
      shape: 'circle',
      features: [
        { start: 15, end: 15, label: 'S15' },
        { start: 45, end: 45, label: 'T45' },
        { start: 89, end: 89, label: 'Y89' }
      ]
    },
    {
      id: 'acetylation',
      name: 'Acetylation',
      color: '#10B981',
      shape: 'diamond',
      features: [
        { start: 23, end: 23, label: 'K23' },
        { start: 67, end: 67, label: 'K67' }
      ]
    },
    {
      id: 'atp_binding',
      name: 'ATP Binding',
      color: '#EF4444',
      shape: 'rectangle',
      features: [
        { start: 50, end: 65, label: 'ATP pocket' }
      ]
    },
    {
      id: 'metal_binding',
      name: 'Metal Binding',
      color: '#F59E0B',
      shape: 'hexagon',
      features: [
        { start: 30, end: 32, label: 'Mg²⁺' },
        { start: 75, end: 77, label: 'Zn²⁺' }
      ]
    },
    {
      id: 'glycosylation',
      name: 'Glycosylation',
      color: '#8B5CF6',
      shape: 'triangle',
      features: [
        { start: 102, end: 102, label: 'N102' },
        { start: 156, end: 156, label: 'S156' }
      ]
    }
  ];

  const toggleAnnotation = (annotationId: string) => {
    const newActive = new Set(activeAnnotations);
    if (newActive.has(annotationId)) {
      newActive.delete(annotationId);
    } else {
      newActive.add(annotationId);
    }
    setActiveAnnotations(newActive);
  };

  return (
    <div className="h-full border rounded-lg bg-white flex flex-col">
      {/* Compact Header
      <div className="p-2 border-b bg-gray-50">
        <h2 className="text-sm font-semibold text-gray-800">Annotations</h2>
        <p className="text-xs text-gray-600">Toggle tracks</p>
      </div> */}

      {/* Compact Annotations List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {annotations.map((annotation) => (
          <div
            key={annotation.id}
            className={`p-2 rounded border cursor-pointer transition-colors text-xs ${
              activeAnnotations.has(annotation.id)
                ? 'bg-blue-50 border-blue-200'
                : 'bg-white border-gray-200 hover:bg-gray-50'
            }`}
            onClick={() => toggleAnnotation(annotation.id)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-1">
                <div
                  className="w-3 h-3 rounded-sm border"
                  style={{ 
                    backgroundColor: annotation.color, 
                    borderColor: annotation.color,
                    borderRadius: annotation.shape === 'circle' ? '50%' : '2px'
                  }}
                />
                <span className="font-medium text-gray-800 truncate">
                  {annotation.name}
                </span>
                <span className="text-gray-500 text-xs">
                  ({annotation.features.length})
                </span>
              </div>
              <div
                className={`w-3 h-3 rounded border flex items-center justify-center ml-1 ${
                  activeAnnotations.has(annotation.id)
                    ? 'bg-blue-600 border-blue-600'
                    : 'bg-white border-gray-300'
                }`}
              >
                {activeAnnotations.has(annotation.id) && (
                  <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Compact Footer */}
      <div className="p-2 border-t bg-gray-50 text-xs text-gray-600">
        <div className="flex justify-between">
          <span>Active:</span>
          <span className="font-semibold">{activeAnnotations.size}</span>
        </div>
      </div>
    </div>
  );
}