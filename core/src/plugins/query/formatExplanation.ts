import { ExecutionStep, ExplainedOption, QueryExplanation } from "./explain";
import { renderCallAsJs } from "../../expressions/callSource";

const OPTION_LABEL_WIDTH = 8;
const WRAP_WIDTH = 68;

/** Wraps `text` to `WRAP_WIDTH`, prefixing every line with `indent`. */
const wrap = (text: string, indent: string): string[] => {
    const lines: string[] = [];
    let line = "";

    for (const word of text.split(" ")) {
        if (line.length > 0 && line.length + word.length + 1 > WRAP_WIDTH) {
            lines.push(indent + line);
            line = word;
            continue;
        }

        line = line.length === 0 ? word : `${line} ${word}`;
    }

    if (line.length > 0) {
        lines.push(indent + line);
    }

    return lines;
};

const COMPARATOR_SYMBOLS: Record<string, string> = {
    "equals": "===",
    "greater-than": ">",
    "greater-than-equals": ">=",
    "less-than": "<",
    "less-than-equals": "<="
};

const describeValue = (value: any): string => {
    if (value == null) {
        return "?";
    }

    if (value.k === "raw") {
        return typeof value.v === "string" ? `"${value.v}"` : String(value.v);
    }

    if (value.k === "date") {
        return value.v;
    }

    if (value.k === "array") {
        return `[${(value.v as unknown[]).map(describeValue).join(", ")}]`;
    }

    return value.k === "undefined" ? "undefined" : String(value.v);
};

/** Renders a serialized expression back to something close to the source predicate. */
const describeExpression = (expression: any): string => {

    if (expression == null) {
        return "?";
    }

    if (expression.t === "operator") {
        return `${describeExpression(expression.left)} ${expression.operator} ${describeExpression(expression.right)}`;
    }

    if (expression.t === "comparator") {
        const left = describeExpression(expression.left);
        const right = describeExpression(expression.right);
        const symbol = COMPARATOR_SYMBOLS[expression.comparator];

        if (symbol == null) {
            return `${left}.${expression.comparator}(${right})${expression.negated === true ? " === false" : ""}`;
        }

        return `${left} ${expression.negated === true ? "!==" : symbol} ${right}`;
    }

    if (expression.t === "property") {
        return expression.path;
    }

    if (expression.t === "value") {
        return describeValue(expression.value);
    }

    if (expression.t === "call") {
        return renderCallAsJs(
            expression.call,
            describeExpression(expression.expression),
            (expression.arguments ?? []).map(describeExpression)
        );
    }

    if (expression.t === "empty") {
        return "(no filter)";
    }

    // Distinguishable from "(not parsable)", which means the parser gave up and this runs in memory
    return expression.t === "not-parsable" ? "(not parsable)" : `(unsupported: ${expression.t})`;
};

const describeOption = (option: ExplainedOption): string => {
    const detail = option.detail;

    if (detail == null) {
        return "";
    }

    if (option.name === "filter") {
        return detail.expression == null
            ? String(detail.expressionUnavailable ?? "")
            : describeExpression(detail.expression);
    }

    if (option.name === "sort") {
        return `${detail.propertyName} ${detail.direction}`;
    }

    if (option.name === "skip" || option.name === "take") {
        return String(detail.value);
    }

    if (option.name === "join") {
        return `${detail.kind} → ${detail.outerKey} = ${detail.innerKey}`;
    }

    if (option.name === "nearest") {
        return `${detail.propertyName}, ${detail.count} nearest`;
    }

    if (option.name === "map" || option.name === "group") {
        const fields = detail.fields as { from: string, to: string }[];

        return fields.map(x => x.from === x.to ? x.from : `${x.from} → ${x.to}`).join(", ");
    }

    return "";
};

const formatStep = (step: ExecutionStep, lines: string[]) => {
    const reason = step.reason == null ? "" : `  [${step.reason}]`;

    lines.push(`  STEP ${step.step} of ${step.of} — ${step.executedIn}${reason}`);
    lines.push(...wrap(step.description, "    "));

    if (step.explanation != null) {
        lines.push(...wrap(step.explanation, "    "));
    }

    lines.push("");

    for (const option of step.options) {
        lines.push(`    ${option.name.padEnd(OPTION_LABEL_WIDTH)} ${describeOption(option)}`.trimEnd());
    }

    for (const executed of step.executedQueries ?? []) {
        lines.push("");
        lines.push(...executed.text.split("\n").map(line => `    ${line}`));

        if (executed.parameters != null && executed.parameters.length > 0) {
            lines.push(`    parameters: ${JSON.stringify(executed.parameters)}`);
        }
    }

    if (step.executedQueriesUnsupported != null) {
        lines.push("");
        lines.push(...wrap(step.executedQueriesUnsupported, "    "));
    }

    lines.push("");
};

/**
 * Renders an explanation for a terminal.
 *
 * The STEP headers carry the whole lesson: a reader who has never heard of pushdown still sees
 * that the statement in step 1 is not the entire query. Nobody should have to notice a missing
 * ORDER BY to work that out.
 */
export const formatExplanation = (explanation: QueryExplanation): string => {
    const { collection, database, summary, executionSteps } = explanation;
    const stepCount = `${executionSteps.length} ${executionSteps.length === 1 ? "step" : "steps"}`;
    const lines: string[] = [`${collection} · ${database} · ${stepCount}`, ""];

    for (const step of executionSteps) {
        formatStep(step, lines);
    }

    lines.push(...wrap(summary.explanation, "  "));

    return lines.join("\n");
};
