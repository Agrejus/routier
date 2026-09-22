interface IconProps {
  size?: number;
}

function Icon({ size = 16, path }: IconProps & { path: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}

export const CloseIcon = ({ size }: IconProps) => <Icon size={size} path="M18 6 6 18M6 6l12 12" />;

export const ChevronLeftIcon = ({ size }: IconProps) => <Icon size={size} path="m15 18-6-6 6-6" />;

export const ChevronRightIcon = ({ size }: IconProps) => <Icon size={size} path="m9 18 6-6-6-6" />;

export const BugIcon = ({ size }: IconProps) => (
  <Icon
    size={size}
    path="M8 2l1.9 1.9M16 2l-1.9 1.9M9 7.1V6a3 3 0 1 1 6 0v1.1M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6zM12 20v-9M6.5 13H3M21 13h-3.5M6 9 3 7M18 9l3-2M6 17l-3 2M18 17l3 2"
  />
);
