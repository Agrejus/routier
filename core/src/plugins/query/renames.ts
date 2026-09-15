import { isPropertyExpression } from "../../assertions";
import { Expression } from "../../expressions/types";
import { forEach } from "../../expressions/utils";
import { PropertyInfo } from "../../schema";
import { QueryOptionsCollection } from "./QueryOptionsCollection";

/** The options that name a property by what the caller wrote, and so can name a renamed one. */
export type PropertyReadingOption = "filter" | "sort" | "nearest";

const PROPERTY_READING_OPTIONS: readonly PropertyReadingOption[] = ["filter", "sort", "nearest"];

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
 * filters and sorts through the stored path and only scores `nearest` in JavaScript.
 */
export const reportRenamedProperties = (
    options: QueryOptionsCollection<any>,
    names: readonly PropertyReadingOption[] = PROPERTY_READING_OPTIONS
): void => {
    for (const name of names) {
        for (const item of options.get(name)) {
            const value = item.option.value as { expression?: Expression, property?: PropertyInfo<any> | null };
            const renamed = name === "filter"
                ? namesRenamedProperty(value.expression)
                : isRenamed(value.property);

            if (renamed) {
                options.reportMissingCapability(item);
            }
        }
    }
};
