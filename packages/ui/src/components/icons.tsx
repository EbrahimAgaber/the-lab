import type { ReactNode } from 'react';

const base = {
  className: 'icon',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

function Svg({ children, mirror }: { children: ReactNode; mirror?: boolean }) {
  return (
    <svg {...base} className={mirror ? 'icon icon-mirror' : 'icon'}>
      {children}
    </svg>
  );
}

/** "Forward" chevron, drawn pointing to inline-end in LTR; mirrored in RTL. */
export const ChevronForward = () => (
  <Svg mirror>
    <polyline points="9 6 15 12 9 18" />
  </Svg>
);
export const ChevronBack = () => (
  <Svg mirror>
    <polyline points="15 6 9 12 15 18" />
  </Svg>
);
export const IconMenu = () => (
  <Svg>
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </Svg>
);
export const IconFlask = () => (
  <Svg>
    <path d="M9 3h6M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2h12.4a1.5 1.5 0 0 0 1.3-2L14 9V3" />
  </Svg>
);
export const IconGauge = () => (
  <Svg>
    <path d="M12 14l4-4" />
    <path d="M3.3 19a10 10 0 1 1 17.4 0" />
  </Svg>
);
export const IconFactory = () => (
  <Svg>
    <path d="M2 21V9l6 4V9l6 4V5h4l2 16z" />
  </Svg>
);
export const IconBox = () => (
  <Svg>
    <path d="M21 8l-9-5-9 5 9 5 9-5z" />
    <path d="M3 8v8l9 5 9-5V8" />
  </Svg>
);
export const IconLayers = () => (
  <Svg>
    <polygon points="12 2 2 7 12 12 22 7 12 2" />
    <polyline points="2 17 12 22 22 17" />
    <polyline points="2 12 12 17 22 12" />
  </Svg>
);
export const IconSettings = () => (
  <Svg>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
  </Svg>
);
export const IconSun = () => (
  <Svg>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
  </Svg>
);
export const IconMoon = () => (
  <Svg>
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </Svg>
);
