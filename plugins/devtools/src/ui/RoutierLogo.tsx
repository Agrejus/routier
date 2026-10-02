interface RoutierLogoProps {
  size: number;
}

const BOLT = "M72 45 49 80h17l-8 25 27-38H68l4-22Z";
const body = "routier-logo-body";
const top = "routier-logo-top";
const cutout = "routier-logo-cutout";

export function RoutierLogo({ size }: RoutierLogoProps) {
  return (
    <svg width={size} height={size} viewBox="16 8 96 116" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={body} x1="64" y1="23" x2="64" y2="116" gradientUnits="userSpaceOnUse">
          <stop stop-color="#14B8A6" />
          <stop offset="1" stop-color="#087F75" />
        </linearGradient>
        <linearGradient id={top} x1="38" y1="15" x2="91" y2="38" gradientUnits="userSpaceOnUse">
          <stop stop-color="#5EEAD4" />
          <stop offset="1" stop-color="#14B8A6" />
        </linearGradient>
        <mask id={cutout} x="0" y="0" width="128" height="128" maskUnits="userSpaceOnUse">
          <rect width="128" height="128" fill="white" />
          <path d={BOLT} fill="black" stroke="black" stroke-width="2" stroke-linejoin="round" />
        </mask>
      </defs>
      <g mask={`url(#${cutout})`}>
        <path
          d="M25 25v76c0 8.3 17.5 15 39 15s39-6.7 39-15V25H25Z"
          fill={`url(#${body})`}
          stroke="#075E58"
          stroke-width="3"
          stroke-linejoin="round"
        />
        <ellipse cx="64" cy="25" rx="39" ry="14" fill={`url(#${top})`} stroke="#075E58" stroke-width="3" />
        <path d="M25 50c0 8.3 17.5 15 39 15s39-6.7 39-15" stroke="#5EEAD4" stroke-opacity="0.72" stroke-width="3" />
        <path d="M25 76c0 8.3 17.5 15 39 15s39-6.7 39-15" stroke="#5EEAD4" stroke-opacity="0.58" stroke-width="3" />
      </g>
      <path d={BOLT} stroke="#075E58" stroke-width="4" stroke-linejoin="round" />
    </svg>
  );
}
