// Inline SVG icons for the mobile experience. The product bans emoji in the UI
// (tests/canonical.test.ts), and the mobile prototype leaned on them (sun,
// lightbulb, camera, etc.), so every glyph is a real icon here. One <Svg>
// wrapper keeps them DRY; stroke icons pass `stroke`, fill icons don't.
import React from 'react';

function Svg({ children, size = 20, stroke = false }: { children: React.ReactNode; size?: number; stroke?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={stroke ? 'none' : 'currentColor'}
      stroke={stroke ? 'currentColor' : undefined}
      strokeWidth={stroke ? 1.8 : undefined}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

type IconProps = { size?: number };

export const MenuIcon = ({ size }: IconProps) => (
  <Svg size={size} stroke><path d="M3 6h18" /><path d="M3 12h18" /><path d="M3 18h18" /></Svg>
);
export const ChevronStartIcon = ({ size }: IconProps) => (
  // logical "back" chevron — points toward the inline-start (right in RTL)
  <Svg size={size} stroke><path d="M9 6l6 6-6 6" /></Svg>
);
export const PlusIcon = ({ size }: IconProps) => (
  <Svg size={size} stroke><path d="M12 5v14" /><path d="M5 12h14" /></Svg>
);
export const CloseIcon = ({ size }: IconProps) => (
  <Svg size={size} stroke><path d="M6 6l12 12" /><path d="M18 6L6 18" /></Svg>
);
export const InsightIcon = ({ size }: IconProps) => (
  <Svg size={size} stroke><path d="M9 18h6" /><path d="M10 21h4" /><path d="M12 3a6 6 0 0 0-4 10.5c.6.6 1 1.5 1 2.5h6c0-1 .4-1.9 1-2.5A6 6 0 0 0 12 3z" /></Svg>
);
export const AttachIcon = ({ size }: IconProps) => (
  <Svg size={size} stroke><path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" /><path d="M14 2v5h5" /></Svg>
);
export const MicIcon = ({ size }: IconProps) => (
  <Svg size={size} stroke><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10v1a7 7 0 0 0 14 0v-1" /><path d="M12 18v4" /></Svg>
);
export const PauseIcon = ({ size }: IconProps) => (
  <Svg size={size} stroke><path d="M9 5v14" /><path d="M15 5v14" /></Svg>
);
export const PlayIcon = ({ size }: IconProps) => (
  <Svg size={size}><path d="M8 5v14l11-7z" /></Svg>
);
export const CameraIcon = ({ size }: IconProps) => (
  <Svg size={size} stroke><path d="M4 7h3l2-2h6l2 2h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z" /><circle cx="12" cy="13" r="3.5" /></Svg>
);
export const ImageIcon = ({ size }: IconProps) => (
  <Svg size={size} stroke><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9.5" r="1.5" /><path d="M21 16l-5-5L5 20" /></Svg>
);
export const FolderIcon = ({ size }: IconProps) => (
  <Svg size={size} stroke><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></Svg>
);
export const SunIcon = ({ size }: IconProps) => (
  <Svg size={size} stroke><circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="M4 12H2" /><path d="M22 12h-2" /><path d="M5.6 5.6 4.2 4.2" /><path d="M19.8 19.8l-1.4-1.4" /><path d="M18.4 5.6l1.4-1.4" /><path d="M4.2 19.8l1.4-1.4" /></Svg>
);
