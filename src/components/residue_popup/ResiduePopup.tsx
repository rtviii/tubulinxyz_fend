'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, GripHorizontal } from 'lucide-react';
import type { MolstarInstance } from '@/components/molstar/services/MolstarInstance';
import type { ResiduePopupTarget } from './types';

// ── Drag hook ────────────────────────────────────────────────

function useDrag(initialPos: { x: number; y: number }) {
  const [pos, setPos] = useState(initialPos);
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });
  // Track whether the user has manually dragged
  const userDragged = useRef(false);

  // Sync with new initial position only if user hasn't dragged
  useEffect(() => {
    if (!userDragged.current) setPos(initialPos);
  }, [initialPos.x, initialPos.y]); // eslint-disable-line react-hooks/exhaustive-deps

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    offset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      userDragged.current = true;
      setPos({ x: ev.clientX - offset.current.x, y: ev.clientY - offset.current.y });
    };
    const onUp = () => {
      dragging.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [pos.x, pos.y]);

  return { pos, onMouseDown, userDragged };
}

// ── Shared content (the inner card) ──────────────────────────

function ResiduePopupContent({ target, onClose }: { target: ResiduePopupTarget; onClose: () => void }) {
  return (
    <>
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
        <div>
          <span className="font-semibold text-gray-900 text-base">
            {target.residueLetter}
            {target.authSeqId !== undefined ? target.authSeqId : ''}
          </span>
          <span className="text-xs text-gray-500 ml-2">
            {target.label}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X size={14} />
        </button>
      </div>
      <div className="px-3 py-2">
        <div className="text-xs text-gray-500">
          MSA position {target.masterIndex}
        </div>
        <div className="mt-2 text-xs text-gray-400 italic">
          Actions coming soon
        </div>
      </div>
    </>
  );
}

// ── Anchored popup (3D-tracked with connector line) ──────────

const ANCHOR_OFFSET = { x: 120, y: -80 };
const POPUP_HEIGHT_ESTIMATE = 100; // rough height for collision stacking

function AnchoredPopup({
  target,
  instance,
  onClose,
  stackIndex = 0,
}: {
  target: ResiduePopupTarget & { anchor: { mode: 'anchored'; position3d: [number, number, number] } };
  instance: MolstarInstance | null;
  onClose: () => void;
  stackIndex?: number;
}) {
  const [screenPos, setScreenPos] = useState<{ x: number; y: number } | null>(null);
  const pos3dRef = useRef(target.anchor.position3d);
  pos3dRef.current = target.anchor.position3d;

  const project = useCallback(() => {
    const pos3d = pos3dRef.current;
    if (!pos3d || !instance?.viewer) return;
    const projected = instance.viewer.projectToScreen(pos3d);
    if (projected) setScreenPos(projected);
  }, [instance]);

  useEffect(() => {
    if (!instance?.viewer) { setScreenPos(null); return; }
    project();
    const unsubscribe = instance.viewer.subscribeToDidDraw(project);
    return unsubscribe;
  }, [instance, project]);

  // Compute initial popup position from projected 3D anchor
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1920;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 900;
  const anchorX = screenPos?.x ?? 0;
  const anchorY = screenPos?.y ?? 0;
  const flipX = anchorX + ANCHOR_OFFSET.x + 220 > vw;
  const autoX = flipX ? anchorX - ANCHOR_OFFSET.x - 220 : anchorX + ANCHOR_OFFSET.x;
  const autoY = Math.max(8, Math.min(anchorY + ANCHOR_OFFSET.y + stackIndex * POPUP_HEIGHT_ESTIMATE, vh - 200));

  const { pos: popupPos, onMouseDown, userDragged } = useDrag({ x: autoX, y: autoY });

  if (!screenPos) return null;

  // Connector line: from 3D anchor to popup edge
  const connectorEnd = {
    x: popupPos.x < anchorX ? popupPos.x + 220 : popupPos.x,
    y: popupPos.y + 20,
  };

  return (
    <>
      <svg className="fixed inset-0 z-[9998] pointer-events-none" style={{ width: '100vw', height: '100vh' }}>
        <line
          x1={anchorX} y1={anchorY}
          x2={connectorEnd.x} y2={connectorEnd.y}
          stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="4 3" opacity={0.7}
        />
        <circle cx={anchorX} cy={anchorY} r={4} fill="#3b82f6" opacity={0.8} />
      </svg>
      <div
        className="fixed z-[9999] bg-white/95 backdrop-blur-sm border border-gray-200 rounded-lg shadow-lg min-w-[220px] text-sm"
        style={{ top: popupPos.y, left: popupPos.x }}
      >
        <div
          className="flex items-center gap-1 px-2 py-1 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-400 border-b border-gray-50"
          onMouseDown={onMouseDown}
        >
          <GripHorizontal size={12} />
        </div>
        <ResiduePopupContent target={target} onClose={onClose} />
      </div>
    </>
  );
}

// ── Static popup (screen-positioned, no 3D tracking) ─────────

function StaticPopup({
  target,
  onClose,
  stackIndex = 0,
}: {
  target: ResiduePopupTarget & { anchor: { mode: 'static'; screenX: number; screenY: number } };
  onClose: () => void;
  stackIndex?: number;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  const initX = Math.min(target.anchor.screenX, (typeof window !== 'undefined' ? window.innerWidth : 1920) - 230);
  const initY = Math.min(target.anchor.screenY + stackIndex * POPUP_HEIGHT_ESTIMATE, (typeof window !== 'undefined' ? window.innerHeight : 900) - 200);
  const { pos, onMouseDown } = useDrag({ x: initX, y: initY });

  return (
    <div
      ref={menuRef}
      className="fixed z-[9999] bg-white/95 backdrop-blur-sm border border-gray-200 rounded-lg shadow-lg min-w-[220px] text-sm"
      style={{ top: pos.y, left: pos.x }}
    >
      <div
        className="flex items-center gap-1 px-2 py-1 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-400 border-b border-gray-50"
        onMouseDown={onMouseDown}
      >
        <GripHorizontal size={12} />
      </div>
      <ResiduePopupContent target={target} onClose={onClose} />
    </div>
  );
}

// ── Public component: renders one popup (dispatches by mode) ─

interface ResiduePopupProps {
  target: ResiduePopupTarget;
  instance: MolstarInstance | null;
  onClose: () => void;
  stackIndex?: number;
}

function ResiduePopupSingle({ target, instance, onClose, stackIndex = 0 }: ResiduePopupProps) {
  if (target.anchor.mode === 'anchored') {
    return <AnchoredPopup target={target as any} instance={instance} onClose={onClose} stackIndex={stackIndex} />;
  }
  return <StaticPopup target={target as any} onClose={onClose} stackIndex={stackIndex} />;
}

// ── Multi-popup layer: renders all active popups via portal ──

interface ResiduePopupLayerProps {
  popups: ResiduePopupTarget[];
  instance: MolstarInstance | null;
  onClose: (id: string) => void;
  onCloseAll: () => void;
}

export function ResiduePopupLayer({ popups, instance, onClose, onCloseAll }: ResiduePopupLayerProps) {
  useEffect(() => {
    if (popups.length === 0) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseAll();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [popups.length, onCloseAll]);

  if (popups.length === 0) return null;

  return createPortal(
    <>
      {popups.map((target, i) => (
        <ResiduePopupSingle
          key={target.id}
          target={target}
          instance={instance}
          onClose={() => onClose(target.id)}
          stackIndex={i}
        />
      ))}
    </>,
    document.body
  );
}
