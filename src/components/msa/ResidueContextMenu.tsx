'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';

export interface ContextMenuTarget {
  residueLetter: string;
  chainLabel: string;    // e.g. "8DRB:A"
  authSeqId: number;
  chainId: string;       // auth_asym_id
  masterIndex: number;   // 1-based MSA column
  screenX: number;
  screenY: number;
}

interface ResidueContextMenuProps {
  target: ContextMenuTarget | null;
  onClose: () => void;
}

export function ResidueContextMenu({ target, onClose }: ResidueContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjusted, setAdjusted] = useState<{ top: number; left: number } | null>(null);

  // Viewport edge clamping after render
  useEffect(() => {
    if (!target || !menuRef.current) {
      setAdjusted(null);
      return;
    }
    const rect = menuRef.current.getBoundingClientRect();
    let top = target.screenY;
    let left = target.screenX;
    if (top + rect.height > window.innerHeight) {
      top = window.innerHeight - rect.height - 8;
    }
    if (left + rect.width > window.innerWidth) {
      left = window.innerWidth - rect.width - 8;
    }
    setAdjusted({ top, left });
  }, [target]);

  // Close on click outside, Escape, scroll
  const handleClose = useCallback((e: MouseEvent | KeyboardEvent | Event) => {
    if (e instanceof KeyboardEvent && e.key !== 'Escape') return;
    if (e instanceof MouseEvent && menuRef.current?.contains(e.target as Node)) return;
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!target) return;
    document.addEventListener('mousedown', handleClose);
    document.addEventListener('keydown', handleClose);
    window.addEventListener('scroll', handleClose, true);
    return () => {
      document.removeEventListener('mousedown', handleClose);
      document.removeEventListener('keydown', handleClose);
      window.removeEventListener('scroll', handleClose, true);
    };
  }, [target, handleClose]);

  if (!target) return null;

  const pos = adjusted ?? { top: target.screenY, left: target.screenX };

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[9999] bg-white border border-gray-200 rounded-lg shadow-lg min-w-[200px] py-1.5 text-sm"
      style={{ top: pos.top, left: pos.left }}
    >
      <div className="px-3 py-2 border-b border-gray-100">
        <div className="font-medium text-gray-900">
          {target.residueLetter} {target.authSeqId}
        </div>
        <div className="text-xs text-gray-500 mt-0.5">
          {target.chainLabel} | MSA pos {target.masterIndex}
        </div>
      </div>
      <div className="px-3 py-2 text-xs text-gray-400 italic">
        Actions coming soon
      </div>
    </div>,
    document.body
  );
}
