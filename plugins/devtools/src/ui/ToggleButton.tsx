import { RoutierLogo } from "./RoutierLogo";
import { BugIcon } from "./icons";

interface ToggleButtonProps {
  onOpen: () => void;
}

export function ToggleButton({ onOpen }: ToggleButtonProps) {
  return (
    <button
      type="button"
      class="launcher"
      aria-expanded={false}
      aria-label="Open Routier devtools"
      title="Open Routier devtools"
      onClick={onOpen}
    >
      <RoutierLogo size={30} />
      <span class="launcher-badge">
        <BugIcon size={11} />
      </span>
    </button>
  );
}
