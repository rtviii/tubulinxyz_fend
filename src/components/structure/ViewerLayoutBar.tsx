'use client';

import type { RefObject } from 'react';
import { PanelTop, Rows2, PanelBottom } from 'lucide-react';
import type { ImperativePanelHandle } from 'react-resizable-panels';

export type LayoutState = 'molstar-only' | 'split' | 'msa-only';

interface ViewerLayoutBarProps {
  molstarPanelRef: RefObject<ImperativePanelHandle>;
  msaPanelRef: RefObject<ImperativePanelHandle>;
  layoutState: LayoutState;
  defaultMolstarSize?: number;
  defaultMsaSize?: number;
}

export function ViewerLayoutBar({
  molstarPanelRef,
  msaPanelRef,
  layoutState,
  defaultMolstarSize = 66,
  defaultMsaSize = 34,
}: ViewerLayoutBarProps) {
  const setMolstarOnly = () => {
    msaPanelRef.current?.collapse();
  };
  const setSplit = () => {
    molstarPanelRef.current?.expand(defaultMolstarSize);
    msaPanelRef.current?.expand(defaultMsaSize);
    molstarPanelRef.current?.resize(defaultMolstarSize);
    msaPanelRef.current?.resize(defaultMsaSize);
  };
  const setMsaOnly = () => {
    molstarPanelRef.current?.collapse();
  };

  return (
    <div
      className="flex items-center gap-0 px-1 py-0.5
                 rounded-full bg-white/80 backdrop-blur border border-slate-200/60
                 shadow-sm text-[11px]"
    >
      <LayoutButton
        icon={PanelTop}
        active={layoutState === 'molstar-only'}
        onClick={setMolstarOnly}
        title="Molstar only"
      />
      <LayoutButton
        icon={Rows2}
        active={layoutState === 'split'}
        onClick={setSplit}
        title="Split view"
      />
      <LayoutButton
        icon={PanelBottom}
        active={layoutState === 'msa-only'}
        onClick={setMsaOnly}
        title="MSA only"
      />
    </div>
  );
}

function LayoutButton({
  icon: Icon,
  active,
  onClick,
  title,
}: {
  icon: typeof PanelTop;
  active: boolean;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`flex items-center gap-1 px-1.5 py-1.5 rounded-full transition-colors ${
        active
          ? 'text-slate-700 bg-slate-100/70'
          : 'text-slate-400 hover:text-slate-700'
      }`}
    >
      <Icon size={13} />
    </button>
  );
}
