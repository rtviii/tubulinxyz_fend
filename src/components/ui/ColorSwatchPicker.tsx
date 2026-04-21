'use client';

import { ColorPicker } from 'antd';
import type { Color } from 'antd/es/color-picker';
import type { ReactNode, CSSProperties } from 'react';

interface ColorSwatchPickerProps {
  color: string;
  isOverridden: boolean;
  onChange: (hex: string) => void;
  onReset?: () => void;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  title?: string;
  disabled?: boolean;
  /** Stop clicks on the trigger from bubbling to a parent (e.g. row-level toggles). */
  stopPropagation?: boolean;
}

/**
 * Small reusable swatch-as-trigger for antd's ColorPicker.
 * - `children` is the visible trigger element (the swatch/badge). If omitted, a default bar is rendered.
 * - `onChange` fires with the new hex on completed pick (ColorPicker `onChangeComplete`).
 * - `onReset` adds a "Reset to default" button in the panel when `isOverridden` is true.
 */
export function ColorSwatchPicker({
  color,
  isOverridden,
  onChange,
  onReset,
  className,
  style,
  children,
  title,
  disabled,
  stopPropagation = true,
}: ColorSwatchPickerProps) {
  const trigger = children ?? (
    <div
      className={className ?? 'w-2 h-2 rounded-sm'}
      style={{ backgroundColor: color, ...style }}
    />
  );

  return (
    <ColorPicker
      value={color}
      disabled={disabled}
      onChangeComplete={(c: Color) => onChange(c.toHexString())}
      size="small"
      disabledAlpha
      panelRender={(panel) => (
        <div onClick={(e) => stopPropagation && e.stopPropagation()}>
          {panel}
          {isOverridden && onReset && (
            <div className="px-2 py-1 border-t border-gray-200 flex justify-end">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onReset();
                }}
                className="text-[10px] text-gray-600 hover:text-gray-900 underline"
              >
                Reset to default
              </button>
            </div>
          )}
        </div>
      )}
    >
      <span
        title={title}
        onClick={(e) => {
          if (stopPropagation) e.stopPropagation();
        }}
        className="inline-flex items-center cursor-pointer"
      >
        {trigger}
      </span>
    </ColorPicker>
  );
}
