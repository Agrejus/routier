import {
    assertTransferVersion,
    EncodedChunk,
    TransferColumn,
    TransferEncoding,
    TransferPlan,
} from './types';

/**
 * Turning a chunk back into row objects, with a generated function rather than a loop over
 * column descriptors.
 *
 * A reflective loop assigning `row[column.name]` onto a fresh object builds dictionary-mode
 * objects and measured 2.3-4x slower — most of the codec's win is here. A generated function
 * emits one object literal per row, in plan column order, so every row of a result shares one
 * hidden class. This is the same technique `core/src/codegen/handlers` uses for `clone`, `hash`
 * and `compare`, and not the same registry: a chunk layout is a result shape, and joins,
 * projections and `RETURNING` layouts have no schema behind them.
 */

/** A generated decoder. `json` carries one parsed array per JSON column, by column index. */
type ChunkDecoder = (chunk: EncodedChunk, json: readonly unknown[][]) => unknown[];

/**
 * A chunk's JSON document did not parse.
 *
 * Reported as its own shape so a caller can retry the request WITHOUT a plan and get today's
 * clone path, which parses row by row and tolerates a field holding text that is not JSON.
 * Every other decode failure is a real error.
 *
 * Read structurally rather than with `instanceof`: an error constructed in another realm — Jest
 * gives each test file its own — fails the prototype test for exactly the cases this classifies.
 */
export type TransferJsonError = Error & { readonly transferJsonColumn: string };

export const isTransferJsonError = (error: unknown): error is TransferJsonError =>
    typeof (error as { transferJsonColumn?: unknown } | null)?.transferJsonColumn === 'string';

const jsonError = (column: string, cause: unknown): TransferJsonError =>
    Object.assign(
        new Error(
            `The transferred JSON document for column '${column}' did not parse, so this column holds ` +
            `text that is not JSON. Retry the request without a transfer plan. Cause: ` +
            `${(cause as Error)?.message ?? String(cause)}`
        ),
        { transferJsonColumn: column }
    );

/**
 * What each column's encoding turned out to be, which is NOT always what the plan asked for.
 *
 * A column that met a value it could not type fell back to `clone` in the worker, and said so on
 * the chunk. The chunk's tag is the truth; the plan only fixes the order and the names.
 */
type EffectiveColumn = { readonly name: string; readonly encoding: TransferEncoding };

const effectiveColumns = (plan: TransferPlan, chunk: EncodedChunk): EffectiveColumn[] =>
    plan.columns.map((column: TransferColumn) => {
        // An own-property test, not a truthiness one: a name like `__proto__` or `toString`
        // resolves to something inherited on a plain object, which would pass a null check and
        // then be decoded as a column.
        if (Object.prototype.hasOwnProperty.call(chunk.columns, column.name) === false) {
            throw new Error(`The transferred chunk has no column '${column.name}', which the plan lists.`);
        }

        const encoded = chunk.columns[column.name];

        return { name: column.name, encoding: encoded.encoding };
    });

/**
 * The serialized layout IS the key.
 *
 * Content-keyed, never by collection name: a migration changes the columns under one name, one
 * worker serves every database on the page, and joins and projections produce many shapes per
 * collection. Names are quoted so a name containing the separator cannot collide with a
 * different layout — a collision would hand a result the wrong decoder, silently.
 */
const cacheKey = (columns: readonly EffectiveColumn[]): string =>
    'v1|' + columns.map(column => `${JSON.stringify(column.name)}:${column.encoding}`).join('|');

/** Retains a compiled function per entry, so it is bounded. */
const CACHE_CAPACITY = 64;

const cache = new Map<string, ChunkDecoder>();

const cached = (key: string): ChunkDecoder | undefined => {
    const decoder = cache.get(key);

    if (decoder == null) {
        return undefined;
    }

    // Re-inserted so the eviction below drops the least recently USED entry, not the oldest.
    cache.delete(key);
    cache.set(key, decoder);

    return decoder;
};

const remember = (key: string, decoder: ChunkDecoder): void => {
    cache.set(key, decoder);

    if (cache.size > CACHE_CAPACITY) {
        const oldest = cache.keys().next();

        if (oldest.done === false) {
            cache.delete(oldest.value);
        }
    }
};

/** Emptied between tests. Not part of the decoding contract. */
export const clearDecoderCache = (): void => cache.clear();

const rowValue = (column: EffectiveColumn, index: number): string => {
    const nulled = `(u${index}[b] & m) !== 0`;

    switch (column.encoding) {
        case 'float64':
            return `${nulled} ? null : d${index}[i]`;
        case 'date-f64':
            return `${nulled} ? null : new Date(d${index}[i])`;
        case 'boolean-byte':
            return `${nulled} ? null : d${index}[i] !== 0`;
        case 'json':
            return `j${index}[i]`;
        case 'clone':
            return `d${index}[i]`;
    }
};

/**
 * The key to write in the emitted object literal.
 *
 * A quoted `"__proto__"` in an object literal sets the row's prototype instead of defining a
 * property (Annex B.3.1), so that one name needs a computed key. Every other name keeps the
 * constant form: computed keys throughout measured 9% slower over a 4,096-row chunk, and decode
 * speed is what this whole module is for.
 */
const literalKey = (name: string): string =>
    name === '__proto__' ? `[${JSON.stringify(name)}]` : JSON.stringify(name);

const isTyped = (encoding: TransferEncoding): boolean =>
    encoding === 'float64' || encoding === 'date-f64' || encoding === 'boolean-byte';

const decoderSource = (columns: readonly EffectiveColumn[]): string => {
    const lines: string[] = ['"use strict";', 'var n = chunk.rowCount;', 'var rows = new Array(n);'];

    columns.forEach((column, index) => {
        if (column.encoding === 'json') {
            lines.push(`var j${index} = json[${index}];`);
            return;
        }

        lines.push(`var c${index} = chunk.columns[${JSON.stringify(column.name)}];`);
        lines.push(`var d${index} = c${index}.data;`);

        if (isTyped(column.encoding)) {
            lines.push(`var u${index} = c${index}.nulls;`);
        }
    });

    lines.push('for (var i = 0; i < n; i++) {');
    lines.push('var b = i >> 3, m = 1 << (i & 7);');
    // One object literal per row, properties in plan order, so all rows share a hidden class.
    lines.push('rows[i] = {');

    columns.forEach((column, index) => {
        lines.push(`${literalKey(column.name)}: ${rowValue(column, index)},`);
    });

    lines.push('};');
    lines.push('}');
    lines.push('return rows;');

    return lines.join('\n');
};

/**
 * Whether this environment allows generated functions at all.
 *
 * `new Function` needs `unsafe-eval`, which a Content-Security-Policy can withhold. A caller
 * asks once at startup and stops sending plans if the answer is no, which falls back to the
 * transport's ordinary clone — a known-good path. There is deliberately no reflective decoder to
 * fall back to: one was measured and never beat the clone it would replace.
 */
let generationSupported: boolean | null = null;

export const isTransferCodecSupported = (): boolean => {
    if (generationSupported == null) {
        try {
            new Function('return 1')();
            generationSupported = true;
        } catch {
            generationSupported = false;
        }
    }

    return generationSupported;
};

const buildDecoder = (columns: readonly EffectiveColumn[]): ChunkDecoder =>
    new Function('chunk', 'json', decoderSource(columns)) as ChunkDecoder;

const decoderFor = (columns: readonly EffectiveColumn[]): ChunkDecoder => {
    const key = cacheKey(columns);
    const hit = cached(key);

    if (hit != null) {
        return hit;
    }

    const decoder = buildDecoder(columns);

    remember(key, decoder);

    return decoder;
};

/**
 * Parsed outside the generated function, so a failure can name its column.
 *
 * One parse per JSON column per chunk replaces one per row — worth about 16% of the codec's
 * total win, and it stacks with chunking.
 */
const parseJsonColumns = (columns: readonly EffectiveColumn[], chunk: EncodedChunk): unknown[][] => {
    const parsed: unknown[][] = new Array(columns.length);

    columns.forEach((column, index) => {
        if (column.encoding !== 'json') {
            return;
        }

        const encoded = chunk.columns[column.name];
        const doc = encoded.encoding === 'json' ? encoded.doc : '[]';

        try {
            parsed[index] = JSON.parse(doc) as unknown[];
        } catch (error) {
            throw jsonError(column.name, error);
        }
    });

    return parsed;
};

/**
 * Decodes one chunk into final-shape row objects — real booleans, `Date` objects, parsed JSON.
 *
 * Not the raw storage shape. The entity needs the final shape either way, and decoding to raw and
 * re-shaping afterwards measured slower (156ms against 140ms at 100,000 rows). An absent or null
 * value becomes JavaScript `null`, never `undefined` and never an absent property.
 *
 * A column that fell back to `clone` in the worker comes back RAW, and the caller still owes it
 * whatever shaping that column would otherwise have had.
 */
export const decodeChunk = (plan: TransferPlan, chunk: EncodedChunk): unknown[] => {
    assertTransferVersion(plan.version);
    assertTransferVersion(chunk.version);

    const columns = effectiveColumns(plan, chunk);

    return decoderFor(columns)(chunk, parseJsonColumns(columns, chunk));
};
