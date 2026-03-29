'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { MolstarInstance } from '@/components/molstar/services/MolstarInstance';

export interface MolstarPopupTarget {
  residueLetter: string;
  chainLabel: string;    // e.g. "8DRB:A"
  authSeqId: number;
  chainId: string;
  masterIndex: number;
  position3d: [number, number, number];
}

interface MolstarResiduePopupProps {
  target: MolstarPopupTarget | null;
  instance: MolstarInstance | null;
  onClose: () => void;
  /** Offset from the residue's projected position to the popup anchor point */
  offset?: { x: number; y: number };
}

const POPUP_OFFSET = { x: 120, y: -80 };

export function MolstarResiduePopup({ target, instance, onClose, offset = POPUP_OFFSET }: MolstarResiduePopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);
  const [screenPos, setScreenPos] = useState<{ x: number; y: number } | null>(null);
  const target3dRef = useRef(target?.position3d ?? null);
  target3dRef.current = target?.position3d ?? null;

  // Project 3D position to screen on mount and camera changes
  const project = useCallback(() => {
    const pos3d = target3dRef.current;
    if (!pos3d || !instance?.viewer) return;
    const projected = instance.viewer.projectToScreen(pos3d);
    if (projected) setScreenPos(projected);
  }, [instance]);

  // Initial projection + subscribe to camera changes
  useEffect(() => {
    if (!target || !instance?.viewer) {
      setScreenPos(null);
      return;
    }
    project();

    // didDraw fires every render frame (including smooth animations)
    const unsubscribe = instance.viewer.subscribeToDidDraw(project);

    return unsubscribe;
  }, [target, instance, project]);

  // Close on Escape
  useEffect(() => {
    if (!target) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [target, onClose]);

  if (!target || !screenPos) return null;

  // Compute the popup position (offset from the residue anchor)
  // Determine which side to place the popup based on viewport position
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;
  const flipX = screenPos.x + offset.x + 220 > viewportWidth;
  const popupX = flipX ? screenPos.x - offset.x - 220 : screenPos.x + offset.x;
  const popupY = Math.max(8, Math.min(screenPos.y + offset.y, (typeof window !== 'undefined' ? window.innerHeight : 900) - 200));

  // Connector line: from residue projected point to popup anchor corner
  const connectorEnd = {
    x: flipX ? popupX + 220 : popupX,
    y: popupY + 20,
  };

  // Get the Molstar container's bounding rect for correct SVG overlay positioning
  return createPortal(
    <>
      {/* SVG connector line */}
      <svg
        className="fixed inset-0 z-[9998] pointer-events-none"
        style={{ width: '100vw', height: '100vh' }}
      >
        <line
          x1={screenPos.x}
          y1={screenPos.y}
          x2={connectorEnd.x}
          y2={connectorEnd.y}
          stroke="#3b82f6"
          strokeWidth={1.5}
          strokeDasharray="4 3"
          opacity={0.7}
        />
        {/* Small circle at the residue anchor point */}
        <circle
          cx={screenPos.x}
          cy={screenPos.y}
          r={4}
          fill="#3b82f6"
          opacity={0.8}
        />
      </svg>

      {/* Popup panel */}
      <div
        ref={popupRef}
        className="fixed z-[9999] bg-white/95 backdrop-blur-sm border border-gray-200 rounded-lg shadow-lg min-w-[220px] text-sm"
        style={{ top: popupY, left: popupX }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
          <div>
            <span className="font-semibold text-gray-900 text-base">
              {target.residueLetter}{target.authSeqId}
            </span>
            <span className="text-xs text-gray-500 ml-2">
              {target.chainLabel}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body stub */}
        <div className="px-3 py-2">
          <div className="text-xs text-gray-500">
            MSA position {target.masterIndex}
          </div>
          <div className="mt-2 text-xs text-gray-400 italic">
            Actions coming soon
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
