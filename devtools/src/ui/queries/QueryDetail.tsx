import type { InspectedQuery } from "@routier/datastore";
import { formatClock, formatDuration } from "../../format/clock";
import { StateMessage } from "../StateMessage";
import { ExecutionStepCard } from "./ExecutionStepCard";

interface QueryDetailProps {
  query: InspectedQuery;
}

export function QueryDetail({ query }: QueryDetailProps) {
  const { explanation } = query;

  return (
    <section class="query-detail" aria-label="Query detail">
      <header class="query-detail-header">
        <h3 class="query-detail-title">{query.collection}</h3>
        <span class="query-detail-meta">
          {formatClock(query.at)} · {formatDuration(query.durationMs)} · {explanation.plugin.kind} · {explanation.database}
        </span>
      </header>
      <div class="query-detail-body">
        {query.outcome.status === "error" && <StateMessage tone="error">The query failed: {query.outcome.error.message}</StateMessage>}
        <p class="query-summary">{explanation.summary.explanation}</p>
        {explanation.executionSteps.map((step) => (
          <ExecutionStepCard key={step.step} step={step} />
        ))}
      </div>
    </section>
  );
}
