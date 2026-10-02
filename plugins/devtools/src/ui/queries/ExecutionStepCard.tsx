import { isDatabaseStep, type ExecutionStep } from "@routier/core/plugins";
import { formatValue } from "../../format/formatValue";

interface ExecutionStepCardProps {
  step: ExecutionStep;
}

function where(step: ExecutionStep): string {
  return isDatabaseStep(step) ? `Database · ${step.executedIn.plugin}` : "Memory";
}

function DatabaseWork({ step }: ExecutionStepCardProps) {
  if (!isDatabaseStep(step)) return <p class="step-note">{step.explanation ?? "Runs in memory over the rows the database returned."}</p>;
  if (step.executedQueries.length === 0) return <p class="step-note">{step.executedQueriesUnsupported ?? "No statements were reported."}</p>;
  return (
    <>
      {step.executedQueries.map((query, index) => (
        <div key={index} class="statement">
          <pre class="statement-text">{query.text}</pre>
          {query.parameters !== undefined && query.parameters.length > 0 && (
            <pre class="statement-parameters">{formatValue(query.parameters)}</pre>
          )}
        </div>
      ))}
    </>
  );
}

export function ExecutionStepCard({ step }: ExecutionStepCardProps) {
  return (
    <section class={`step step-${step.executedIn.kind}`} aria-label={`Step ${step.step} of ${step.of}`}>
      <header class="step-header">
        <span class="step-number">
          Step {step.step} of {step.of}
        </span>
        <span class="step-where">{where(step)}</span>
      </header>
      {step.options.length > 0 && (
        <ul class="step-options">
          {step.options.map((option) => (
            <li key={option.index} class="step-option">
              {option.name}
            </li>
          ))}
        </ul>
      )}
      <DatabaseWork step={step} />
    </section>
  );
}
