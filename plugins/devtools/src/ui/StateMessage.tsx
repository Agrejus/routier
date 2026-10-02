import type { ComponentChildren } from "preact";

interface StateMessageProps {
  children: ComponentChildren;
  tone?: "error";
}

export function StateMessage({ children, tone }: StateMessageProps) {
  return tone === "error" ? (
    <p class="state-message error" role="alert">
      {children}
    </p>
  ) : (
    <p class="state-message" role="status">
      {children}
    </p>
  );
}
