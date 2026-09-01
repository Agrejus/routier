import type { PropertyInfo } from '../schema/PropertyInfo';
import type { QueryField } from './query/types';

/**
 * What a statement or command RETURNS, described before it runs.
 *
 * A plugin's builder knows this and nothing else knows it: the shape of a result comes from the
 * projection, the join aliases, or the `RETURNING` list, none of which survive into the SQL as
 * anything a reader could recover. So the builder states it, once, beside the statement it built.
 *
 * Deliberately says nothing about what anyone does with the result. It is a description, not an
 * instruction — the same description serves a driver that transfers rows across a worker
 * boundary, one that hands them straight back, and one that only wants to know the column order.
 * A consumer that needs more turns this into whatever it needs: `buildTransferPlan` in
 * `@routier/core/transfer` is one such consumer, and it is not privileged.
 */
export type ResultColumn = {
    /** Exact name the engine will return, including any projection or join alias. */
    readonly name: string;
    /**
     * The schema property behind the column, or `null`.
     *
     * `null` for an expression — a computed value, an aggregate, anything with no declared type
     * to reason from. A consumer that wants to treat the value specially needs the property; one
     * that only wants names does not.
     */
    readonly property: PropertyInfo<any> | null;
};

/**
 * The columns a `map` projection selects.
 *
 * Named by `sourceName`, which is what the statement actually emits; the rename to
 * `destinationName` happens in the translator, after the rows come back. A field with no
 * `property` is an expression.
 */
export const mappedResultColumns = (fields: readonly QueryField[]): ResultColumn[] =>
    fields.map(field => ({
        name: field.sourceName,
        property: (field.property as PropertyInfo<any> | undefined) ?? null,
    }));
