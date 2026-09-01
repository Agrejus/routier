import { ExecutionStep, ExplainedOption, QueryExplanation, isDatabaseStep } from "./explain";
import { renderCallAsJs } from "../../expressions/callSource";
import { SerializedExpression, SerializedValue } from "../../expressions/types";

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

/** Typed against the union so a new OBJECT tag is a compile error here, not an "undefined" in output. */
const describeValue = (value: SerializedValue | undefined): string => {
    if (value === null) {
        return "null";
    }

    if (value === undefined) {
        return "?";
    }

    if (Array.isArray(value)) {
        return `[${value.map(describeValue).join(", ")}]`;
    }

    if (typeof value !== "object") {
        return typeof value === "string" ? `"${value}"` : String(value);
    }

    if ("date" in value) {
        return value.date;
    }

    if ("undefined" in value) {
        return "undefined";
    }

    if ("regex" in value) {
        return `/${value.regex.source}/${value.regex.flags}`;
    }

    if ("bigint" in value) {
        return `${value.bigint}n`;
    }

    return value.number;
};

/** Renders a serialized expression back to something close to the source predicate. */
const describeExpression = (expression: SerializedExpression): string => {

    if (expression == null) {
        return "?";
    }

    if (expression.type === "operator") {
        return `${describeExpression(expression.left)} ${expression.operator} ${describeExpression(expression.right)}`;
    }

    if (expression.type === "comparator") {
        const left = describeExpression(expression.left);
        const right = describeExpression(expression.right);
        const symbol = COMPARATOR_SYMBOLS[expression.comparator];

        if (symbol == null) {
            return `${left}.${expression.comparator}(${right})${expression.negated === true ? " === false" : ""}`;
        }

        return `${left} ${expression.negated === true ? "!==" : symbol} ${right}`;
    }

    if (expression.type === "property") {
        return expression.path;
    }

    if (expression.type === "value") {
        return describeValue(expression.value);
    }

    if (expression.type === "call") {
        return renderCallAsJs(
            expression.call,
            () => describeExpression(expression.expression),
            () => (expression.arguments ?? []).map(describeExpression)
        );
    }

    if (expression.type === "empty") {
        return "(no filter)";
    }

    // Distinguishable from "(not parsable)", which means the parser gave up and this runs in memory
    if (expression.type === "not-parsable") {
        return expression.reason == null ? "(not parsable)" : `(not parsable: ${expression.reason})`;
    }

    // Unreachable while the union is exhausted above; a payload from a newer sender is not.
    return `(unsupported: ${(expression as SerializedExpression).type})`;
};

const describeOption = (option: ExplainedOption): string => {
    const detail = option.detail;

    if (detail == null) {
        return "";
    }

    if (option.name === "filter") {
        return detail.expression == null
            ? String(detail.expressionUnavailable ?? "")
            : describeExpression(detail.expression as SerializedExpression);
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

/**
 * The sentence for a kind of step.
 *
 * Here rather than on the step: it is one of two constants keyed off `executedIn`, so carrying it in
 * the payload put prose beside the field it was derived from.
 */
const DATABASE_STEP_DESCRIPTION = "These options are sent to the plugin.";
const MEMORY_STEP_DESCRIPTION = "Routier runs these over the rows the database returned, after deserializing them.";
const UNNARROWED_READ_DESCRIPTION = "No option could be pushed down, so the plugin reads the whole collection.";

/** `database · orders.db · SqliteDbPlugin`, so a cross-plugin join says who ran what. */
const whereItRan = (step: ExecutionStep): string =>
    isDatabaseStep(step)
        ? `database · ${step.executedIn.database} · ${step.executedIn.plugin}`
        : "memory";

const formatStep = (step: ExecutionStep, lines: string[]) => {
    const reason = isDatabaseStep(step) || step.reason == null ? "" : `  [${step.reason}]`;

    lines.push(`  STEP ${step.step} of ${step.of} — ${whereItRan(step)}${reason}`);

    if (isDatabaseStep(step)) {
        lines.push(...wrap(step.options.length === 0 ? UNNARROWED_READ_DESCRIPTION : DATABASE_STEP_DESCRIPTION, "    "));
    } else {
        lines.push(...wrap(MEMORY_STEP_DESCRIPTION, "    "));

        if (step.explanation != null) {
            lines.push(...wrap(step.explanation, "    "));
        }
    }

    lines.push("");

    for (const option of step.options) {
        lines.push(`    ${option.name.padEnd(OPTION_LABEL_WIDTH)} ${describeOption(option)}`.trimEnd());
    }

    if (isDatabaseStep(step) === false) {
        lines.push("");
        return;
    }

    for (const executed of step.executedQueries) {
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
