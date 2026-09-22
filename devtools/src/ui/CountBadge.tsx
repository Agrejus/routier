import type { LiveState } from "../live/liveState";

interface CountBadgeProps {
  count: LiveState<number>;
}

export function CountBadge({ count }: CountBadgeProps) {
  if (count.status === "loading") {
    return (
      <span class="count" aria-label="counting">
        …
      </span>
    );
  }
  if (count.status === "error") {
    return (
      <span class="count error" title={count.message} aria-label={`count failed: ${count.message}`}>
        error
      </span>
    );
  }
  return <span class="count">{count.value}</span>;
}
