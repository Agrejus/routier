import { SchemaTypes } from '@routier/core';
import { CompiledSchema, PropertyInfo } from '@routier/core/schema';
import type { SqlDialect } from './sql';

/**
 * Turning a partial entity into column assignments.
 *
 * `@routier/core` hands plugins an `EntityDelta` — what changed, shaped like the entity.
 * That is a statement about the data model and nothing else; it does not know what a column
 * is. This is where it becomes SQL, and it is the only place that decides a nested object
 * or array is stored as JSON.
 *
 * Before this existed each SQL plugin read `Object.keys(delta)` directly and bound the raw
 * value as a parameter. That worked only because the delta type promised
 * `string | number | Date` — a promise the schema never made. A nested object reached the
 * driver as an object and either threw or was coerced to `"[object Object]"`.
 */

export type ColumnAssignment = {
    /** Storage-side column name, already resolved through any `.from()` rename. */
    readonly column: string;
    /** Parameter value, JSON-encoded when the property is nested. */
    readonly value: unknown;
};

/**
 * Root properties only — nested children are reached through their parent's value.
 *
 * Exported because the whole table layout depends on it. `schema.properties` is flat: it
 * lists `nested`, `nested.inner`, and `nested.inner.value` side by side, and
 * `getResolvedName()` returns the LEAF name (`from ?? name`). So building columns from every
 * property gives a table with bogus `inner` and `value` columns that collide the moment two
 * nested objects share a child name — and no way to bind a value to them, because the entity
 * has no top-level `value` key.
 *
 * A nested subtree is one JSON column, named for its root. That is the only layout that
 * round-trips.
 */
export const sqlColumnProperties = <T extends {}>(schema: CompiledSchema<T>) =>
    schema.properties.filter(p => p.parent == null);

const rootProperties = sqlColumnProperties;

/**
 * Finds the property a delta key refers to.
 *
 * Matched on the **resolved** (storage-side) name first, because a delta has already been
 * through `schema.serialize` and therefore carries wire names, then on the declared name so
 * a caller-built delta also works. Getting this backwards is how renamed properties end up
 * writing to a column that does not exist.
 */
const propertyFor = <T extends {}>(schema: CompiledSchema<T>, key: string): PropertyInfo<T> | undefined => {
    const roots = rootProperties(schema);

    return roots.find(p => p.getResolvedName() === key) ?? roots.find(p => p.name === key);
};

/**
 * True when the property's value is encoded as JSON rather than bound as a scalar.
 *
 * A vector belongs here even on an engine that gives it a native column type. The encoding
 * `JSON.stringify` produces for a list of numbers — `[1,2,3]` — is byte for byte the text
 * literal pgvector accepts, so one encode path serves both, and the DDL is the only place the
 * two engines differ. Reading is the same story in reverse: a JSON column comes back as that
 * text, and so does a pgvector column through a driver with no type parser registered for it.
 */
export const isJsonColumn = (property: PropertyInfo<any>) =>
    property.type === SchemaTypes.Object ||
    property.type === SchemaTypes.Array ||
    property.type === SchemaTypes.Vector;

/**
 * Whether this layer should JSON-encode the value, decided on its **runtime shape** rather
 * than on the property's declared type alone.
 *
 * The distinction is not pedantic — getting it wrong double-encodes. A delta has already
 * been through `schema.serialize`, so a property carrying an explicit
 * `.serialize(x => JSON.stringify(x))` arrives here as a *string* that is already JSON.
 * Encoding by declared type would turn `"[]"` into `"\"[]\""`, and the read side would
 * deserialize that back to the string `"[]"` instead of an array — which surfaces far away
 * as `Cannot create proxy with a non-object as target`.
 *
 * So: encode only what is still a structure. Schemas that already handle their own encoding
 * keep working untouched, and schemas that do not now get JSON storage for free.
 *
 * `null` is left alone deliberately. A JSON column holding SQL NULL is not the same as one
 * holding the four bytes `null`, and only the former is found by `IS NULL`.
 */
const needsJsonEncoding = (property: PropertyInfo<any>, value: unknown) =>
    isJsonColumn(property) && value != null && typeof value === "object";

/**
 * Binds a value for one column, letting the dialect rewrite the shapes its engine refuses.
 *
 * Two hooks, both gated on the DECLARED property type so a scalar column is never touched by
 * accident, and both leaving `null` alone — a NULL column is not the same as one holding an
 * encoded null, and only the former is found by `IS NULL`.
 */
const encodeForColumn = (property: PropertyInfo<any>, value: unknown, dialect: SqlDialect): unknown => {
    if (needsJsonEncoding(property, value)) {
        return dialect.encodeJson(value);
    }

    if (property.type === SchemaTypes.Date && value != null) {
        return dialect.encodeDate(value);
    }

    if (property.type === SchemaTypes.Boolean && value != null) {
        return dialect.encodeBoolean(value);
    }

    return value;
};

/**
 * Maps a delta to the columns it assigns.
 *
 * Unknown keys are skipped rather than thrown on: a delta is data arriving from another
 * layer, and a property that no longer exists in the schema should not take down a save
 * that is otherwise valid. Callers that care can compare lengths.
 */
export function toColumnAssignments<T extends {}>(
    delta: Record<string, unknown>,
    schema: CompiledSchema<T>,
    dialect: SqlDialect,
    entity?: Record<string, unknown>
): ColumnAssignment[] {
    const assignments: ColumnAssignment[] = [];

    for (const key of Object.keys(delta)) {
        const property = propertyFor(schema, key);

        if (property == null) {
            continue;
        }

        const column = property.getResolvedName();

        // For a JSON column the delta selects the column; the ENTITY supplies the value.
        //
        // A nested subtree lives in one column, so writing the delta's partial subtree
        // overwrites the whole thing and silently drops the siblings that did not change:
        // patching `nested.inner.value` would write `{"inner":{"value":"after"}}` and lose
        // `nested.inner.count`. The entity already holds the fully merged subtree, so taking
        // the value from there writes the truth. Scalars are unaffected — for those the
        // delta value and the entity value are the same thing.
        const useEntityValue = entity != null && isJsonColumn(property) && column in entity;
        const value = useEntityValue ? entity[column] : delta[key];

        assignments.push({
            column,
            value: encodeForColumn(property, value, dialect),
        });
    }

    return assignments;
}

/**
 * `toColumnAssignments` as a column-keyed map, for callers building a `SET` clause that
 * needs to look values up by column rather than iterate in order.
 */
export function toColumnValueMap<T extends {}>(
    delta: Record<string, unknown>,
    schema: CompiledSchema<T>,
    dialect: SqlDialect,
    entity?: Record<string, unknown>
): Map<string, unknown> {
    const map = new Map<string, unknown>();

    for (const { column, value } of toColumnAssignments(delta, schema, dialect, entity)) {
        map.set(column, value);
    }

    return map;
}

/**
 * Reverses `toColumnAssignments` on the way back out of the database.
 *
 * Without this, writing a nested value as JSON is a one-way trip: the column holds
 * `'{"inner":{"value":"y"}}'` and the entity gets handed a string where an object belongs.
 *
 * **Only properties with no `valueDeserializer` are touched.** That is the mirror of the
 * encode rule and it is load-bearing, not defensive. A schema carrying
 * `.deserialize(x => JSON.parse(String(x)))` will parse the column itself; parsing it here
 * first would hand that deserializer an object, and `JSON.parse(String({}))` is
 * `JSON.parse("[object Object]")` — a throw, from a schema that was previously working.
 *
 * Unlike encoding there is no dialect hook. Encoding legitimately varies (a driver may
 * prefer binding a JS object straight to `jsonb`), but a JSON string decodes the same way
 * everywhere, and drivers that already return parsed objects are handled by the shape check
 * rather than by configuration.
 */
export function decodeJsonColumns<T extends {}>(rows: unknown, schema: CompiledSchema<T>): unknown {
    const roots = rootProperties(schema);
    const decodable = roots.filter(p => isJsonColumn(p) && p.valueDeserializer == null);
    /**
     * Booleans stored as 1 and 0 come back as numbers and have to become booleans again.
     *
     * The mirror of `encodeBoolean`, and dialect-free on purpose: an engine with a real boolean
     * type returns one, which the shape check below leaves alone. Only a number needs undoing,
     * and only SQLite produces one. Without this a `s.boolean()` property read back as `1`,
     * which is truthy but is not `true` — `compare` then reported every row as changed and the
     * change tracker rewrote them on every save.
     */
    const booleans = roots.filter(p => p.type === SchemaTypes.Boolean && p.valueDeserializer == null);

    if (decodable.length === 0 && booleans.length === 0) {
        return rows;
    }

    if (Array.isArray(rows) === false) {
        return rows;
    }

    for (const row of rows as Record<string, unknown>[]) {
        if (row == null || typeof row !== "object") {
            continue;
        }

        for (const property of booleans) {
            const column = property.getResolvedName();
            const value = row[column];

            if (typeof value === "number") {
                row[column] = value !== 0;
            }
        }

        for (const property of decodable) {
            // Aggregate and projection queries return rows that are not entities. A column
            // this schema does not appear in is simply absent, so nothing happens.
            const column = property.getResolvedName();
            const value = row[column];

            if (typeof value !== "string") {
                continue;
            }

            try {
                row[column] = JSON.parse(value);
            } catch {
                // Not JSON. Leaving the raw value alone is strictly better than throwing:
                // a column written before this encoding existed, or by another writer, is a
                // data-migration problem and not this function's to adjudicate.
            }
        }
    }

    return rows;
}
