import { isPropertyExpression } from "../../assertions";
import { Expression } from "../../expressions/types";
import { forEach } from "../../expressions/utils";
import { PropertyInfo } from "../../schema";
import { QueryOptionsCollection } from "./QueryOptionsCollection";
import { QueryField } from "./types";

/**
 * The options that name a property by what the caller wrote, and so can name a renamed one.
 *
 * `sum`, `min`, `max` and `distinct` are not among them: they carry no property, and read what the
 * `map` in front of them projected. A report on that `map` ends the database phase, so they run in
 * memory behind it.
 */
export type PropertyReadingOption = "filter" | "sort" | "nearest" | "map" | "group";

const PROPERTY_READING_OPTIONS: readonly PropertyReadingOption[] = ["filter", "sort", "nearest", "map", "group"];

const namesRenamedProperty = (expression: Expression | undefined): boolean => {
    let found = false;

    if (expression == null) {
        return found;
    }

    forEach(expression, node => {
        if (isPropertyExpression(node) && node.property.hasRenamedSegments) {
            found = true;

            return false;
        }

        return true;
    });

    return found;
};

const isRenamed = (property: PropertyInfo<any> | null | undefined) => property != null && property.hasRenamedSegments;

type SelectorReads = {
    property?: PropertyInfo<any> | null,
    reads?: PropertyInfo<any>[]
};

/**
 * Whether a selector's value is read from a renamed property, whether it is that property or computed
 * from it: `r => r.dueDate.getTime()` reads `dueDate` all the same. Every property it reads when the
 * selector was parsed, and otherwise the property recorded for it.
 */
const readsRenamedValue = (value: SelectorReads | undefined) =>
    value != null && (value.reads != null ? value.reads.some(isRenamed) : isRenamed(value.property));

const readsRenamedField = (fields: QueryField[] | undefined) => fields != null && fields.some(readsRenamedValue);

type PropertyReadingValue = SelectorReads & {
    expression?: Expression,
    key?: QueryField,
    fields?: QueryField[]
};

const readsRenamedProperty = (name: PropertyReadingOption, value: PropertyReadingValue): boolean => {
    switch (name) {
        case "filter":
            return namesRenamedProperty(value.expression);
        case "map":
            // A projection reads each field it selects
            return readsRenamedField(value.fields);
        case "group":
            // A group reads its key, then copies every field of the row into its members: every schema
            // property, or what a `map` before it selected
            return readsRenamedValue(value.key) || readsRenamedField(value.fields);
        default:
            return readsRenamedValue(value);
    }
};

/**
 * Hands back every option over a property stored under a `.from()` name, for the datastore to run
 * in memory.
 *
 * Core keeps such an option with the database, because only the plugin knows whether its backend
 * reads storage names. One that translates the option — SQL renders the column from
 * `getResolvedName()` — needs nothing from here. One that runs the caller's lambda over rows as it
 * stores them reads a key the row does not have, and answers wrongly without an error: that plugin
 * calls this before it reads anything, and the datastore finishes the query after deserialization,
 * where the in-memory names exist.
 *
 * Reported as `missing-capability`: the backend cannot express the option as written, and like
 * every capability, that is only knowable by the plugin.
 *
 * @param names Which options to check, for a plugin that resolves some of them itself — Mongo renders
 * filters and sorts through the stored path, and runs `nearest`, `map` and `group` in JavaScript.
 */
export const reportRenamedProperties = (
    options: QueryOptionsCollection<any>,
    names: readonly PropertyReadingOption[] = PROPERTY_READING_OPTIONS
): void => {
    for (const name of names) {
        for (const item of options.get(name)) {
            if (readsRenamedProperty(name, item.option.value as PropertyReadingValue)) {
                options.reportMissingCapability(item);
            }
        }
    }
};
