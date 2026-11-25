import { REDACTED, touchesSensitive } from "../../expressions/redact";
import { ExecutedQuery } from "./explain";
import { QueryOptionsCollection } from "./QueryOptionsCollection";

export const HIDDEN_QUERY_TEXT = "[hidden: this query filters on a sensitive property]";

export const filtersSensitive = <T>(options: QueryOptionsCollection<T>): boolean =>
    options.get("filter").some(item => touchesSensitive(item.option.value.expression));

const redactQuery = (query: ExecutedQuery): ExecutedQuery =>
    query.parameters == null
        ? { text: HIDDEN_QUERY_TEXT }
        : { text: query.text, parameters: query.parameters.map(() => REDACTED) };

/**
 * The statements a plugin ran, with their values hidden when the query filters on a sensitive
 * property. A statement with separate parameters keeps its text, whose placeholders show no
 * values. A statement without them carries its values inline, so its text is hidden.
 */
export const redactExecutedQueries = (queries: ExecutedQuery[], hide: boolean): ExecutedQuery[] =>
    hide ? queries.map(redactQuery) : queries;
