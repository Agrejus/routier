import { describe, expect, it } from '@jest/globals';
import { s } from '../schema';
import { QueryField } from '../plugins/query/types';
import { PropertyInfo } from '../schema/PropertyInfo';
import { mappedResultColumns, ResultColumn } from '../plugins/resultShape';
import {
    buildTransferPlan,
    rawStorageTransferTypes,
    transferEncodingFor,
} from './plan';
import { TRANSFER_VERSION } from './types';

/**
 * Which encoding each column gets, and when a result gets no plan at all.
 *
 * The rule under every case: uncertainty means `clone`. A wrong encoding is not slow, it is
 * wrong, and `clone` is what happens with no plan anyway — so a conservative choice only ever
 * costs the speed-up it declines.
 */

const schema = s.define('plan_target', {
    id: s.string().key(),
    name: s.string(),
    price: s.number(),
    active: s.boolean(),
    createdAt: s.date(),
    nested: s.object({ inner: s.string() }),
    tags: s.array(s.string()),
    embedding: s.vector(3),
}).compile();

/**
 * Root properties as result columns.
 *
 * Spelled out here rather than imported: `entityResultColumns` lives in `@routier/sql-plugin-core`
 * because the root-only rule is a fact about flat tables, and this module must not depend on it.
 */
const columnsOf = (compiled: { properties: readonly PropertyInfo<any>[] }): ResultColumn[] =>
    compiled.properties
        .filter((property: PropertyInfo<any>) => property.parent == null)
        .map((property: PropertyInfo<any>) => ({ name: property.getResolvedName(), property }));

const encodings = (columns: readonly ResultColumn[]) =>
    Object.fromEntries(columns.map(column => [column.name, transferEncodingFor(column, rawStorageTransferTypes)]));

const columnNamed = (name: string): ResultColumn => {
    const found = columnsOf(schema as any).find(column => column.name === name);

    if (found == null) {
        throw new Error(`the fixture schema has no column '${name}'`);
    }

    return found;
};

describe('transferEncodingFor', () => {

    it('maps each schema type to the encoding a raw stored value allows', () => {
        expect(encodings(columnsOf(schema as any))).toEqual({
            id: 'clone',
            name: 'clone',
            price: 'float64',
            active: 'boolean-byte',
            createdAt: 'date-f64',
            nested: 'json',
            tags: 'json',
            embedding: 'json',
        });
    });

    it('clones a column with no property behind it, because an expression has no provable type', () => {
        expect(transferEncodingFor({ name: 'total', property: null }, rawStorageTransferTypes)).toBe('clone');
    });

    it('clones a type the mapping does not name, rather than guessing at one', () => {
        expect(transferEncodingFor(columnNamed('price'), {})).toBe('clone');
    });

    /**
     * A property that serializes or deserializes itself owns its storage shape, and this layer
     * cannot know what it is. Handing an already-parsed value to a property carrying
     * `.deserialize(x => JSON.parse(String(x)))` throws, from a schema that was working.
     */
    it.each([
        ['a value serializer', s.define('ser', { id: s.string().key(), when: s.date().serialize(v => String(v)) }).compile()],
        ['a value deserializer', s.define('des', { id: s.string().key(), when: s.date().deserialize(v => new Date(String(v))) }).compile()],
    ])('clones a date column carrying %s', (_, custom) => {
        expect(encodings(columnsOf(custom as any)).when).toBe('clone');
    });

    it('clones a number column even though its type maps, when the property has a serializer', () => {
        const custom = s.define('ser_num', {
            id: s.string().key(),
            price: s.number().serialize(v => String(v)),
        }).compile();

        expect(encodings(columnsOf(custom as any)).price).toBe('clone');
    });
});

describe('mappedResultColumns', () => {

    const field = (sourceName: string, property?: unknown): QueryField => ({
        sourceName,
        destinationName: sourceName,
        isRename: false,
        property: property as QueryField['property'],
        getter: ((): undefined => undefined) as QueryField['getter'],
    });

    it('names a projection by its source name, because the rename happens after decoding', () => {
        const columns = mappedResultColumns([
            field('price', columnNamed('price').property),
            field('createdAt', columnNamed('createdAt').property),
        ]);

        expect(columns.map(column => column.name)).toEqual(['price', 'createdAt']);
        expect(encodings(columns)).toEqual({ price: 'float64', createdAt: 'date-f64' });
    });

    it('clones a projected field that carries no property', () => {
        expect(encodings(mappedResultColumns([field('computed')]))).toEqual({ computed: 'clone' });
    });
});

describe('buildTransferPlan', () => {

    it('stamps the version the codec reads', () => {
        expect(buildTransferPlan(columnsOf(schema as any), rawStorageTransferTypes)?.version).toBe(TRANSFER_VERSION);
    });

    it('keeps the plan order identical to the column order it was given', () => {
        const columns = columnsOf(schema as any);
        const plan = buildTransferPlan(columns, rawStorageTransferTypes);

        expect(plan?.columns.map(column => column.name)).toEqual(columns.map(column => column.name));
    });

    it('declines to plan a result with no columns', () => {
        expect(buildTransferPlan([], rawStorageTransferTypes)).toBeUndefined();
    });

    /**
     * A result naming one column twice works without a plan: the row object keeps the last value.
     * A chunk carries one entry per column name, so it cannot round-trip that — and this is a
     * speed-up, so the answer is to decline the plan, not to reject the query.
     */
    it('declines to plan a result that names one column twice', () => {
        const price = columnNamed('price');

        expect(buildTransferPlan([price, price], rawStorageTransferTypes)).toBeUndefined();
    });
});
