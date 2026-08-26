import { Expression } from "../../expressions/types";
import { DatabaseExecutionReason, MemoryExecutionReason, QueryOption, QueryOptionExecutionTarget, QueryOptionName } from "./types";
import { QueryOptionsCollection } from "./QueryOptionsCollection";

/**
 * One sentence per reason code, written for someone meeting pushdown for the first time.
 *
 * Beside the codes rather than in the formatter, so console output, a failing test and the
 * docs all say the same thing.
 */
export const MEMORY_EXECUTION_EXPLANATIONS: Record<MemoryExecutionReason, string> = {
    "not-parsable": "A filter could not be parsed into an expression tree, so it and every option after it run in memory.",
    "unmapped-property": "The property is not stored in the database, so it can only be read after deserialization.",
    "renamed-property": "The property is stored under a different name, and selectors use the in-memory name, so it can only be read after deserialization.",
    "map-rename": "A map renames or drops properties, so every option after it refers to names the database does not have.",
    "after-nearest": "A similarity search orders and limits rows, and the plugin cannot report whether it performed the search, so every option after it runs in memory.",
    "after-join": "A join produces [outer, inner] tuples rather than entities, and the plugin cannot report how it joined, so every option after it runs in memory.",
    "cross-plugin-join": "The two sides of this join live on different plugins, so neither can read the other's rows and the join runs in the datastore."
};

/**
 * One thing a backend actually executed, in the backend's own language.
 *
 * A plugin pushes these onto `DbPluginQueryEvent.executedQueries` as it runs them, so a join —
 * which reads twice — reports both, in execution order. `text` is not required to be SQL: a
 * key-value store describes what it did in whatever terms it has.
 */
export type ExecutedQuery = {
    text: string;
    parameters?: unknown[];
};

export type ExplainedOption = {
    index: number;
    name: QueryOptionName;
    detail?: Record<string, unknown>;
};

export const EXECUTED_QUERIES_UNSUPPORTED =
    "This plugin did not report what it executed. It may not support explain.";

/**
 * Why an option planned for the database did not run there. `executed` has no sentence: it needs no
 * explaining, and a step made of executed options is a database step like any other.
 */
export const DATABASE_EXECUTION_EXPLANATIONS: Record<Exclude<DatabaseExecutionReason, "executed">, string> = {
    "missing-capability": "The plugin's engine cannot express this option, so it runs in memory over the rows the plugin did return. Only the plugin can know this — an engine's capabilities are not visible from here.",
    "not-reached": "The database stopped at an option it could not express, so this one runs in memory too. Carrying on would apply it to rows the earlier option had not filtered."
};

export type ExecutionStep = {
    step: number;
    of: number;
    executedIn: QueryOptionExecutionTarget;
    description: string;
    options: ExplainedOption[];
    /** Set on database steps once the plugin has reported. */
    executedQueries?: ExecutedQuery[];
    /** Set on the first database step instead, when the plugin reported nothing. */
    executedQueriesUnsupported?: string;
    /** Set on memory steps only. */
    /** Why this step is not in the database — core planned it, or the plugin could not do it. */
    reason?: MemoryExecutionReason | Exclude<DatabaseExecutionReason, "executed">;
    explanation?: string;
};

export type QueryExplanationSummary = {
    database: number;
    memory: number;
    /** Deduped, in first-seen order. Empty when the whole query pushed down. */
    reasons: NonNullable<ExecutionStep["reason"]>[];
    explanation: string;
};

export type QueryExplanation = {
    collection: string;
    database: string;
    summary: QueryExplanationSummary;
    executionSteps: ExecutionStep[];
    plugin: { kind: string };
};

export type ExplainContext = {
    collection: string;
    database: string;
    pluginKind: string;
};

const DATABASE_STEP_DESCRIPTION = "These options are sent to the plugin.";
const MEMORY_STEP_DESCRIPTION = "Routier runs these over the rows the database returned, after deserializing them.";
const UNNARROWED_READ_DESCRIPTION = "No option could be pushed down, so the plugin reads the whole collection.";

/**
 * The reportable shape of one option's value.
 *
 * Serializable facts only, never the live selector functions — an explanation is a document a
 * caller may log, diff in a test, or send to a server, and a closure survives none of that.
 */
const detailOf = (option: QueryOption<any, any>): Record<string, unknown> | undefined => {

    if (option.name === "filter") {
        const value = option.value as { expression?: Expression };

        if (value.expression == null) {
            return undefined;
        }

        try {
            return { expression: Expression.toJson(value.expression) };
        } catch {
            // `valueToJson` rejects a value no wire can carry. Reporting the rest of the
            // explanation beats taking the diagnostic down with the query it describes.
            return { expressionUnavailable: "This filter holds a value that cannot be serialized." };
        }
    }

    if (option.name === "sort") {
        const value = option.value as { propertyName: string, direction: string };

        return { propertyName: value.propertyName, direction: value.direction };
    }

    if (option.name === "skip" || option.name === "take") {
        return { value: option.value as number };
    }

    if (option.name === "nearest") {
        const value = option.value as { propertyName: string, vector: number[], count: number };

        return { propertyName: value.propertyName, dimensions: value.vector.length, count: value.count };
    }

    if (option.name === "join") {
        const value = option.value as {
            kind: string,
            outerKey: { propertyName: string },
            innerKey: { propertyName: string },
            crossPlugin: boolean,
            innerOptions: QueryOptionsCollection<any>
        };

        return {
            kind: value.kind,
            outerKey: value.outerKey.propertyName,
            innerKey: value.innerKey.propertyName,
            crossPlugin: value.crossPlugin,
            innerOptions: explainedOptionsOf(value.innerOptions)
        };
    }

    if (option.name === "map" || option.name === "group") {
        const value = option.value as { fields: { sourceName: string, destinationName: string }[] };

        return { fields: value.fields.map(x => ({ from: x.sourceName, to: x.destinationName })) };
    }

    return undefined;
};

const explainedOptionOf = (option: QueryOption<any, any>, index: number): ExplainedOption => {
    const detail = detailOf(option);

    return { index, name: option.name, ...(detail == null ? {} : { detail }) };
};

const explainedOptionsOf = (options: QueryOptionsCollection<any>): ExplainedOption[] => {
    const explained: ExplainedOption[] = [];
    let index = 0;

    options.forEach(option => explained.push(explainedOptionOf(option, index++)));

    return explained;
};

/** Every sentence, whoever decided — the summary reads the same either way. */
const EXPLANATIONS: Record<string, string> = { ...MEMORY_EXECUTION_EXPLANATIONS, ...DATABASE_EXECUTION_EXPLANATIONS };

const summarize = (steps: ExecutionStep[]): QueryExplanationSummary => {
    const reasons: NonNullable<ExecutionStep["reason"]>[] = [];
    let database = 0;
    let memory = 0;

    for (const step of steps) {
        if (step.executedIn === "database") {
            database += step.options.length;
            continue;
        }

        memory += step.options.length;

        if (step.reason != null && reasons.includes(step.reason) === false) {
            reasons.push(step.reason);
        }
    }

    const counts = `${database} ${database === 1 ? "option ran" : "options ran"} in the database, ${memory} ran in memory.`;
    const causes = reasons.map(reason => EXPLANATIONS[reason]).join(" ");

    return { database, memory, reasons, explanation: causes.length === 0 ? counts : `${counts} ${causes}` };
};

/**
 * Groups options into consecutive runs that execute in the same place.
 *
 * A step boundary is where execution moves, and a reader has to see the statement as step 1 OF
 * 2 to understand it is not the whole query. Cutting over to memory is a ratchet, so the
 * database options are always a prefix and there are at most two steps.
 *
 * A database step is emitted even when NO option pushed down, because the plugin is dispatched
 * either way — `createQueryPayload` always builds a database event. Without it, the worst case
 * the feature exists to expose reports "0 in the database" while the backend reads the whole
 * table, which is the opposite of the truth.
 */
/**
 * Where an option ran, and why — read off the option rather than off the plan.
 *
 * A database option is only reported as having run there if it did. `missing-capability` and
 * `not-reached` both mean the rows came back unfiltered and the datastore finished the job.
 */
type Outcome = {
    executedIn: QueryOptionExecutionTarget;
    reason: MemoryExecutionReason | Exclude<DatabaseExecutionReason, "executed"> | null;
    explanation: string | null;
};

const outcomeOf = (option: QueryOption<any, any>): Outcome => {

    if (option.target === "memory") {
        return {
            executedIn: "memory",
            reason: option.reason,
            explanation: MEMORY_EXECUTION_EXPLANATIONS[option.reason]
        };
    }

    if (option.reason === "executed") {
        return { executedIn: "database", reason: null, explanation: null };
    }

    return {
        executedIn: "memory",
        reason: option.reason,
        explanation: DATABASE_EXECUTION_EXPLANATIONS[option.reason]
    };
};

const toExecutionSteps = (options: QueryOptionsCollection<any>): ExecutionStep[] => {
    const steps: ExecutionStep[] = [];
    let index = 0;

    options.forEach(option => {
        const explained = explainedOptionOf(option, index++);
        const current = steps[steps.length - 1];
        const outcome = outcomeOf(option);

        // Grouped by outcome, not by target: an option the database could not express and one core
        // sent to memory both run in memory, for different reasons a reader needs told apart.
        // `?? null` because a step with no reason omits the key entirely, and `undefined === null`
        // is false — without it every database option started a step of its own
        if (current != null && current.executedIn === outcome.executedIn && (current.reason ?? null) === outcome.reason) {
            current.options.push(explained);
            return;
        }

        steps.push({
            step: steps.length + 1,
            of: 0,
            executedIn: outcome.executedIn,
            description: outcome.executedIn === "database" ? DATABASE_STEP_DESCRIPTION : MEMORY_STEP_DESCRIPTION,
            options: [explained],
            ...(outcome.reason == null ? {} : { reason: outcome.reason, explanation: outcome.explanation })
        });
    });

    if (steps[0]?.executedIn !== "database") {
        steps.unshift({
            step: 0,
            of: 0,
            executedIn: "database",
            description: UNNARROWED_READ_DESCRIPTION,
            options: []
        });
    }

    for (let i = 0; i < steps.length; i++) {
        steps[i].step = i + 1;
        steps[i].of = steps.length;
    }

    return steps;
};

/**
 * Builds the explanation from the resolved options, with no plugin involvement.
 *
 * Takes the collection BEFORE `split()`, and throws otherwise. Splitting re-adds each half
 * into a fresh collection, which re-derives targets without the options that caused them — a
 * post-join filter alone in the memory half derives back to `"database"`, and the document
 * would report memory work as having run in the database.
 */
export const explainQuery = (options: QueryOptionsCollection<any>, context: ExplainContext): QueryExplanation => {

    const executionSteps = toExecutionSteps(options);

    return {
        collection: context.collection,
        database: context.database,
        summary: summarize(executionSteps),
        executionSteps,
        plugin: { kind: context.pluginKind }
    };
};

/**
 * Attaches what the backend reported to the step that was sent to it.
 *
 * Reporting is optional for a plugin, so an empty report is not an error: the step is marked
 * `executedQueriesUnsupported` instead, and the rest of the explanation stands — the pushdown
 * analysis comes from the options and is correct with or without the plugin's statements.
 *
 * Copies the steps rather than writing into them, so the explanation a caller already holds
 * does not gain statements after the fact. Options and their details are shared with the
 * original — nothing mutates them, and copying deeper would only look safer than it is.
 */
export const withExecutedQueries = (explanation: QueryExplanation, executedQueries: ExecutedQuery[]): QueryExplanation => {
    let attached = false;

    const executionSteps = explanation.executionSteps.map((step): ExecutionStep => {

        // Only the first database step: a plugin reports what IT ran, and everything it ran
        // was sent as one dispatch. Stamping the same statements onto a second database step
        // would claim they ran twice.
        if (step.executedIn !== "database" || attached === true) {
            return { ...step, options: [...step.options] };
        }

        attached = true;

        if (executedQueries.length === 0) {
            return { ...step, options: [...step.options], executedQueriesUnsupported: EXECUTED_QUERIES_UNSUPPORTED };
        }

        return { ...step, options: [...step.options], executedQueries: [...executedQueries] };
    });

    return { ...explanation, executionSteps };
};
