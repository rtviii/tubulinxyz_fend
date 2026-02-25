'use client';

import { useEffect, useState, useRef } from 'react';
import type { MolstarInstance } from '../services/MolstarInstance';

interface ResidueInfo {
  chainId: string;
  authSeqId: number;
  // extend this as you pull more data in
}

interface Props {
  instance: MolstarInstance | null;
  // optional: enrich the label with whatever you want from outside
  getLabel?: (info: ResidueInfo) => string | null;
}

export function ResidueInfoOverlay({ instance, getLabel }: Props) {
  const [pinned, setPinned] = useState<ResidueInfo | null>(null);
  const [hovered, setHovered] = useState<ResidueInfo | null>(null);

  useEffect(() => {
    if (!instance?.viewer) return;

    const unsubHover = instance.viewer.subscribeToHover(info => {
      setHovered(info ?? null);
    });

    const unsubClick = instance.viewer.subscribeToClick(info => {
      if (!info) {
        setPinned(null);
        return;
      }
      setPinned(prev =>
        prev?.chainId === info.chainId && prev?.authSeqId === info.authSeqId
          ? null   // clicking same residue again unpins
          : info
      );
    });

    return () => {
      unsubHover();
      unsubClick();
    };
  }, [instance]);

  const displayed = pinned ?? hovered;
  if (!displayed) return null;

  const customLabel = getLabel?.(displayed);

  return (
    <div
      className="absolute bottom-4 left-4 z-10 pointer-events-none"
    >
      <div className="bg-black/70 text-white text-xs rounded px-3 py-2 font-mono space-y-0.5 shadow-lg">
        <div className="text-gray-300">
          chain <span className="text-white font-semibold">{displayed.chainId}</span>
          {' '}&middot;{' '}
          residue <span className="text-white font-semibold">{displayed.authSeqId}</span>
          {pinned && (
            <span className="ml-2 text-yellow-400 text-[10px]">pinned</span>
          )}
        </div>
        {customLabel && (
          <div className="text-blue-300">{customLabel}</div>
        )}
      </div>
    </div>
  );
}