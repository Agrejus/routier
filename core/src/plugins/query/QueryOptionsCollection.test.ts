import { describe, it, expect } from '@jest/globals';
import { QueryOptionsCollection } from './QueryOptionsCollection';
import { QueryOrdering } from './types';
import { toExpression } from '../../expressions/parser';
import { s as schemaBuilder } from '../../schema';

const reportSchema = schemaBuilder.define('report_cascade', {
    id: schemaBuilder.string().key(),
    price: schemaBuilder.number(),
}).compile();

/** A database-target filter: an unparsable one is sent to memory and never carries a report. */
const parsableExpression = () =>
    toExpression(reportSchema as never, ((row: any) => row.price > 20) as never, undefined as never);

describe('QueryOptionsCollection', () => {
    it('should create an empty collection', () => {
        const collection = QueryOptionsCollection.EMPTY();
        expect(collection).toBeInstanceOf(QueryOptionsCollection);
        expect(QueryOptionsCollection.isEmpty(collection)).toBe(true);
    });

    it('should add a skip option', () => {
        const collection = QueryOptionsCollection.EMPTY();
        collection.add('skip', 5);
        expect(collection.has('skip')).toBe(true);
        expect(collection.get('skip')).toHaveLength(1);
        expect(collection.get('skip')[0].option.value).toBe(5);
    });

    it('should add a take option', () => {
        const collection = QueryOptionsCollection.EMPTY();
        collection.add('take', 10);
        expect(collection.has('take')).toBe(true);
        expect(collection.get('take')).toHaveLength(1);
        expect(collection.get('take')[0].option.value).toBe(10);
    });

    it('should add a sort option', () => {
        const collection = QueryOptionsCollection.EMPTY<any>();
        const selector = (item: any) => item.id;
        collection.add('sort', { selector, direction: QueryOrdering.Ascending, propertyName: 'id' });
        expect(collection.has('sort')).toBe(true);
        expect(collection.get('sort')).toHaveLength(1);
        expect(collection.get('sort')[0].option.value.direction).toBe(QueryOrdering.Ascending);
    });

    it('should add a map option', () => {
        const collection = QueryOptionsCollection.EMPTY();
        const selector = (item: any) => ({ id: item.id });
        collection.add('map', { selector, fields: [] });
        expect(collection.has('map')).toBe(true);
        expect(collection.get('map')).toHaveLength(1);
        expect(collection.get('map')[0].option.value.selector).toBe(selector);
    });

    it('should add multiple options of the same type', () => {
        const collection = QueryOptionsCollection.EMPTY();
        collection.add('skip', 5);
        collection.add('skip', 10);
        expect(collection.get('skip')).toHaveLength(2);
        expect(collection.get('skip')[0].option.value).toBe(5);
        expect(collection.get('skip')[1].option.value).toBe(10);
    });

    it('should assign sequential indices to options', () => {
        const collection = QueryOptionsCollection.EMPTY<any>();
        collection.add('skip', 5);
        collection.add('take', 10);
        collection.add('sort', { selector: (item: any) => item.id, direction: QueryOrdering.Ascending, propertyName: 'id' });
        expect(collection.get('skip')[0].index).toBe(0);
        expect(collection.get('take')[0].index).toBe(1);
        expect(collection.get('sort')[0].index).toBe(2);
    });

    it('forEach iterates options in index order across types', () => {
        const collection = QueryOptionsCollection.EMPTY<any>();

        collection.add('skip', 1);
        collection.add('take', 2);
        collection.add('sort', { selector: (i: any) => i.id, direction: QueryOrdering.Descending, propertyName: 'id' });
        collection.add('skip', 3);
        collection.add('take', 4);

        const namesInOrder: string[] = [];
        collection.forEach((opt) => {
            namesInOrder.push(opt.name);
        });

        const expectedByIndex = [...collection.items.values()]
            .flat()
            .sort((a, b) => a.index - b.index)
            .map(i => i.option.name);

        expect(namesInOrder).toEqual(expectedByIndex);
    });

    describe('reporting more than one missing capability', () => {

        const build = () => {
            const collection = QueryOptionsCollection.EMPTY<any>();
            collection.add('filter', { filter: () => true, params: null, expression: parsableExpression() } as never);
            collection.add('filter', { filter: () => true, params: null, expression: parsableExpression() } as never);
            collection.add('take', 5 as never);

            return collection;
        };

        const reasons = (collection: QueryOptionsCollection<any>) => {
            const found: string[] = [];
            collection.forEach(option => found.push(`${option.name}:${option.reason}`));

            return found;
        };

        const expected = ['filter:missing-capability', 'filter:missing-capability', 'take:not-reached'];

        it('keeps every reported option named, whichever order they arrive in', () => {
            const ascending = build();
            ascending.reportMissingCapability(ascending.get('filter')[0]);
            ascending.reportMissingCapability(ascending.get('filter')[1]);

            const descending = build();
            descending.reportMissingCapability(descending.get('filter')[1]);
            descending.reportMissingCapability(descending.get('filter')[0]);

            expect(reasons(ascending)).toEqual(expected);
            expect(reasons(descending)).toEqual(expected);
        });

        it('is unchanged by reporting the same option twice', () => {
            const collection = build();
            collection.reportMissingCapability(collection.get('filter')[0]);
            collection.reportMissingCapability(collection.get('filter')[0]);

            expect(reasons(collection)).toEqual([
                'filter:missing-capability', 'filter:not-reached', 'take:not-reached'
            ]);
        });
    });

    describe('a report made on a derived half', () => {

        it('cascades over the whole dispatch, not just the half', () => {
            const collection = QueryOptionsCollection.EMPTY<any>();
            collection.add('filter', { filter: () => true, params: null, expression: parsableExpression() } as never);
            collection.add('join', { schema: reportSchema, key: 'id', joinKey: 'id' } as never);

            const { before, at } = collection.splitAt('join');
            before.reportMissingCapability(before.get('filter')[0]);

            expect(collection.getLast('filter')!.reason).toBe('missing-capability');
            expect(at!.reason).toBe('not-reached');
        });

        it('cascades from the database half of a split', () => {
            const collection = QueryOptionsCollection.EMPTY<any>();
            collection.add('filter', { filter: () => true, params: null, expression: parsableExpression() } as never);
            collection.add('take', 5 as never);

            const { database } = collection.split();
            database.reportMissingCapability(database.get('filter')[0]);

            expect(collection.getLast('take')!.reason).toBe('not-reached');
        });
    });
});
