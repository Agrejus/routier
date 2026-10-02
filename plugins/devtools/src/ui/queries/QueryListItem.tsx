import type { InspectedQuery } from "@routier/datastore";
import { formatClock, formatDuration } from "../../format/clock";

interface QueryListItemProps {
  store: string;
  query: InspectedQuery;
  selected: boolean;
  onSelect: () => void;
}

export function QueryListItem({ store, query, selected, onSelect }: QueryListItemProps) {
  const { summary } = query.explanation;
  const failed = query.outcome.status === "error";

  return (
    <li>
      <button type="button" class={failed ? "query-item failed" : "query-item"} aria-pressed={selected} onClick={onSelect}>
        <span class="query-time">{formatClock(query.at)}</span>
        <span class="query-target">
          <span class="query-collection">{query.collection}</span>
          <span class="query-store">{store}</span>
        </span>
        {query.live && <span class="live-badge">live</span>}
        {failed && <span class="error-badge">failed</span>}
        <span class="pushdown">
          <span class="pushdown-database" title="Options run in the database">
            DB {summary.database}
          </span>
          {summary.memory > 0 && (
            <span class="pushdown-memory" title="Options run in memory">
              Memory {summary.memory}
            </span>
          )}
        </span>
        <span class="query-duration">{formatDuration(query.durationMs)}</span>
      </button>
    </li>
  );
}
