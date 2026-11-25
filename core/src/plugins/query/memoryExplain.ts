import type { ParameterisedQuery } from "./describeFilter";
import type { ExecutedQuery } from "./explain";

/** A collection name as a JavaScript expression: the name itself when it is an identifier. */
export const javascriptName = (name: string): string =>
    /^[A-Za-z_$][\w$]*$/.test(name) ? name : `collections[${JSON.stringify(name)}]`;

const records = (count: number) => `${count} in-memory ${count === 1 ? "record" : "records"}`;

/** What an in-memory read ran: the collection, filtered by the predicate when there is one. */
export const memoryReadQuery = (collectionName: string, filter: ParameterisedQuery, returned: number): ExecutedQuery => {
    const name = javascriptName(collectionName);

    return {
        text: filter.text === "" ? name : `${name}.filter(x => ${filter.text})`,
        ...(filter.parameters.length > 0 ? { parameters: filter.parameters } : {}),
        language: "javascript",
        note: `returned ${records(returned)}`,
    };
};

/** What an in-memory read of a join's inner side ran, narrowed to the outer keys when there are any. */
export const memoryJoinQuery = (collectionName: string, keyColumn: string, returned: number, outerKeyCount: number | null): ExecutedQuery => {
    const name = javascriptName(collectionName);

    if (outerKeyCount == null) {
        return { text: name, language: "javascript", note: `the join's inner side: returned ${records(returned)}, a full scan` };
    }

    return {
        text: `${name}.filter(x => outerKeys.has(x.${keyColumn}))`,
        language: "javascript",
        note: `the join's inner side: returned ${records(returned)}, narrowed by ${outerKeyCount} outer ${outerKeyCount === 1 ? "key" : "keys"}`,
    };
};
