import { ComparatorExpression, Filter, PropertyExpression, ValueExpression } from "@routier/core/expressions";
import { CompiledSchema, PropertyInfo, SchemaTypes } from "@routier/core/schema";
import { GenericFunction } from "@routier/core/types";

/**
 * Soft delete, wired from a collection declaration.
 *
 * ```ts
 * products = this.collection(productSchema)
 *     .softDelete(x => x.deletedAt)
 *     .proxy()
 *     .create();
 * ```
 *
 * Two halves, and both are needed or the feature is worse than not having it. A remove stamps
 * the chosen property instead of deleting the row, and every read is scoped to rows where that
 * property is still empty. Half of this — stamping without scoping — leaves deleted rows
 * showing up in results, which is the failure that makes people distrust soft delete.
 *
 * ## Why the caller picks the property
 *
 * `ConcurrencyDbPlugin` appends a hidden `__version` column and no schema mentions it. That is
 * right for a token nobody reads. A deletion timestamp is the opposite: it is the answer to
 * "when did this go?", and hiding it means the one query you eventually want — show me what was
 * deleted last week — cannot be written. So the property is declared in the schema, typed, and
 * queryable like anything else.
 *
 * It also makes the mechanism inspectable. `deletedAt` in a table is a thing a person reading
 * the database can understand without knowing this library exists.
 */

/** How a collection soft-deletes: which property, and what to write into it. */
export type SoftDeleteConfiguration<TEntity extends {}> = {
    /** Declared property name, resolved from the selector. */
    readonly propertyName: string;
    readonly property: PropertyInfo<TEntity>;
    /** The value written on removal — a `Date` for a date property, `true` for a boolean. */
    readonly stamp: () => unknown;
};

/**
 * Pulls `deletedAt` out of `x => x.deletedAt`.
 *
 * Source-text parsing, the same technique `.sort()` and `.map()` already use for their
 * selectors — the alternative is asking for a string, which no editor can rename with the
 * property and no compiler can check.
 */
const propertyNameFrom = <TEntity extends {}>(selector: GenericFunction<TEntity, unknown>): string => {
    const stringified = selector.toString();
    const arrowIndex = stringified.indexOf("=>");

    if (arrowIndex < 0) {
        throw new Error("Only arrow functions are allowed in .softDelete()");
    }

    const [, ...path] = stringified.substring(arrowIndex + 2).trim().split(".");

    return path.join(".");
};

/**
 * What gets written when a row is removed.
 *
 * A date records WHEN, which is what makes a soft delete useful later. A boolean records only
 * that it happened, and is supported because plenty of existing tables have one.
 */
const stampFor = (property: PropertyInfo<any>): (() => unknown) => {
    if (property.type === SchemaTypes.Date) {
        return () => new Date();
    }

    if (property.type === SchemaTypes.Boolean) {
        return () => true;
    }

    throw new Error(
        `.softDelete() needs a date or boolean property.  Property: ${property.name}, Type: ${property.type}.  ` +
        `A date is preferred: it records when the row was removed, which a boolean cannot.`
    );
};

export const resolveSoftDelete = <TEntity extends {}>(
    schema: CompiledSchema<TEntity>,
    selector: GenericFunction<TEntity, unknown>
): SoftDeleteConfiguration<TEntity> => {
    const propertyName = propertyNameFrom(selector);
    const property = schema.getProperty(propertyName);

    if (property == null) {
        throw new Error(`.softDelete() names a property the schema does not declare.  Property: ${propertyName}`);
    }

    if (property.isNullable === false && property.isOptional === false) {
        // A row that has never been deleted has nothing to put here, so the property must be
        // able to hold that. Without this the first insert fails on a NOT NULL column, far
        // from the declaration that caused it.
        throw new Error(
            `.softDelete() needs a nullable or optional property, or a row that was never deleted has no value to store.  ` +
            `Property: ${propertyName}`
        );
    }

    return { propertyName, property, stamp: stampFor(property) };
};

/**
 * The scope that hides deleted rows: `property == null`.
 *
 * The expression is built by hand rather than parsed from a generated arrow. Generating source
 * would mean `new Function`, which a Content-Security-Policy blocks — and this library runs in
 * browsers. Building the tree is also simply more honest: the shape is known here, so there is
 * nothing to parse.
 *
 * Loose equality on purpose. A row written before the property existed has it absent rather
 * than null, and a strict comparison would treat those rows as deleted and hide every one of
 * them — which is how enabling soft delete on an existing table makes the data disappear.
 */
export const softDeleteScope = <TEntity extends {}>(configuration: SoftDeleteConfiguration<TEntity>) => {
    const { propertyName, property } = configuration;

    const expression = new ComparatorExpression({
        comparator: "equals",
        negated: false,
        strict: false,
        left: new PropertyExpression({ property }),
        right: new ValueExpression({ value: null }),
    });

    // The runtime predicate for whatever cannot be pushed down. It is never re-parsed — the
    // expression above is supplied directly — so it does not have to be arrow-shaped source.
    const filter = ((entity: Record<string, unknown>) => entity[propertyName] == null) as unknown as Filter<TEntity>;

    return { filter, expression };
};
