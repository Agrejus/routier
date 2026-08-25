import { SchemaTypes } from '../schema/types';
import type { PropertyInfo } from '../schema/PropertyInfo';
import type { ResultColumn } from '../plugins/resultShape';
import { TransferEncoding, TransferPlan, TRANSFER_VERSION } from './types';

/**
 * Deciding how each column of a result crosses the boundary.
 *
 * Separate from the codec beside it because of WHO imports it, not because of what it knows: the
 * encoder is bundled into a worker, and this runs on the main thread only. `SchemaTypes` is the
 * one runtime import — the enum's own module is type-only imports throughout — so a bundler that
 * does pull this in still does not pull in the schema machinery.
 *
 * Nothing here is SQL. A plan is a list of result columns and the property behind each one, and
 * both of those are data-model facts. What varies by engine is which values it hands back — one
 * that stores a date as ISO text needs `Date.parse`, one that parses before returning does not —
 * and that variation is a mapping the caller passes in rather than a table this module owns.
 *
 * The rule throughout is that uncertainty means `clone`. A wrong encoding is not slow, it is
 * wrong, and `clone` is exactly what happens without a plan — so the worst a conservative choice
 * costs is the speed-up it declines.
 */

/**
 * Which encoding each schema type can take on one engine.
 *
 * A type with no entry gets `clone`. That is the safe direction: a missing entry is a type this
 * mapping has not considered, and guessing at one is how a column starts decoding wrongly.
 */
export type TransferTypeMapping = Readonly<Partial<Record<SchemaTypes, TransferEncoding>>>;

/**
 * Full control over one column's encoding, for an engine whose answer is not a function of the
 * schema type alone.
 *
 * Returning `undefined` defers to the type mapping, so a resolver can decide the few columns it
 * cares about and leave the rest. It CANNOT override the serializer rule — a property that owns
 * its own storage shape stays on `clone` whatever a resolver says, because that rule is about the
 * schema's contract rather than about the engine.
 */
export type TransferEncodingResolver = (column: ResultColumn) => TransferEncoding | undefined;

/**
 * How a caller says which encoding a column takes: a table by schema type, a resolver, or both.
 *
 * The table covers every engine measured so far. The resolver exists because "the schema type" is
 * this module's guess at what varies, and an engine is entitled to disagree — a store that keeps
 * one property in a different representation from its siblings has no way to say so in a table
 * keyed by type.
 */
export type TransferEncodingStrategy =
    | TransferTypeMapping
    | TransferEncodingResolver
    | { readonly resolve?: TransferEncodingResolver; readonly types?: TransferTypeMapping };

/**
 * For an engine that returns a column as the raw text or number it stored.
 *
 * SQLite is the case this was measured against — a date is TEXT holding ISO-8601 and a boolean is
 * INTEGER holding 0 or 1 — but the mapping is about the STORED shape, not about SQL. Any engine
 * that keeps those encodings uses it; one that parses values before returning them (PGlite) needs
 * its own.
 *
 * `String` is deliberately absent, so strings cross in a plain array. Cloning a V8 string is a
 * native memcpy and encoding one measured slower: 14.0ms against 8.3ms for 4,000 rows of 2KB text.
 */
export const rawStorageTransferTypes: TransferTypeMapping = {
    [SchemaTypes.Number]: 'float64',
    [SchemaTypes.Boolean]: 'boolean-byte',
    [SchemaTypes.Date]: 'date-f64',
    [SchemaTypes.Object]: 'json',
    [SchemaTypes.Array]: 'json',
    [SchemaTypes.Vector]: 'json',
};

/**
 * For an engine that returns values already parsed — a document store, a key-value store holding
 * decoded records, or a driver with type parsers registered.
 *
 * Differs from {@link rawStorageTransferTypes} in ONE place: a nested structure arrives as a live
 * object, so it is stringified on the way out rather than passed through as text. Dates and
 * booleans need no separate entry, because those fillers accept either shape.
 *
 * Whether `json-stringify` beats `clone` for a given payload is unmeasured — see the encoding's
 * own note. An engine unsure of that should map its nested types to `clone` and keep today's
 * behaviour.
 */
export const parsedValueTransferTypes: TransferTypeMapping = {
    [SchemaTypes.Number]: 'float64',
    [SchemaTypes.Boolean]: 'boolean-byte',
    [SchemaTypes.Date]: 'date-f64',
    [SchemaTypes.Object]: 'json-stringify',
    [SchemaTypes.Array]: 'json-stringify',
    [SchemaTypes.Vector]: 'json-stringify',
};

/**
 * True when this layer must not touch the column, whatever its declared type says.
 *
 * A property that serializes, deserializes or transforms itself owns its storage shape, and this
 * has no way to know what that shape is. Handing an already-parsed value to a property carrying
 * `.deserialize(x => JSON.parse(String(x)))` throws, from a schema that was working.
 */
const ownsItsShape = (property: PropertyInfo<any>): boolean =>
    property.valueSerializer != null
    || property.valueDeserializer != null
    || property.transform != null
    || property.functionBody != null;

/**
 * The encoding for one column.
 *
 * A schema type alone does not prove what the engine will return — a migration or an external
 * writer can put anything in a column — so this is a starting point the encoder still validates
 * per value.
 */
export const transferEncodingFor = (
    column: ResultColumn,
    strategy: TransferEncodingStrategy
): TransferEncoding => {
    const property = column.property;

    // Checked BEFORE the resolver, and not overridable by it. A property carrying its own
    // serializer owns its storage shape; pre-shaping it throws from a schema that was working,
    // and that is true on every engine.
    if (property == null || ownsItsShape(property)) {
        return 'clone';
    }

    const { resolve, types } = normalize(strategy);

    return resolve?.(column) ?? types?.[property.type] ?? 'clone';
};

const normalize = (strategy: TransferEncodingStrategy):
    { resolve?: TransferEncodingResolver; types?: TransferTypeMapping } => {

    if (typeof strategy === 'function') {
        return { resolve: strategy };
    }

    if ('resolve' in strategy || 'types' in strategy) {
        return strategy as { resolve?: TransferEncodingResolver; types?: TransferTypeMapping };
    }

    return { types: strategy as TransferTypeMapping };
};

/**
 * Builds the plan for an ordered result column list, or `undefined` when there is nothing to plan.
 *
 * `undefined` is not a failure — it means this result takes the ordinary clone path. Two shapes
 * get it:
 *
 * - **No columns.** There is no row to decode.
 * - **A repeated column name.** One chunk carries one entry per name, and a row object holds one
 *   value per key, so a result naming a column twice cannot round-trip through a plan. That is a
 *   legal result that works without the codec, so it keeps working rather than becoming an error.
 */
export const buildTransferPlan = (
    columns: readonly ResultColumn[],
    strategy: TransferEncodingStrategy
): TransferPlan | undefined => {
    if (columns.length === 0) {
        return undefined;
    }

    const names = new Set(columns.map(column => column.name));

    if (names.size !== columns.length) {
        return undefined;
    }

    return {
        version: TRANSFER_VERSION,
        columns: columns.map(column => ({
            name: column.name,
            encoding: transferEncodingFor(column, strategy),
        })),
    };
};
