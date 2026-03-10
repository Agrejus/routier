import { describe, expect, it } from '@jest/globals';
import { Query } from './Query';
import { QueryOptionsCollection } from './QueryOptionsCollection';
import { QueryOrdering } from './types';

const mockSchema = {
    id: 42,
    collectionName: 'products',
} as any;

describe('Query', () => {
    it('EMPTY() creates an empty query and isEmpty() returns true', () => {
        const query = Query.EMPTY(mockSchema);
        expect(Query.isEmpty(query)).toBe(true);
    });

    it('changeTracking is true by default when no transforming options are present', () => {
        const options = QueryOptionsCollection.EMPTY<any>();
        const query = new Query(options, mockSchema);

        expect(query.changeTracking).toBe(true);
    });

    it('changeTracking can be explicitly overridden (true/false)', () => {
        const options = QueryOptionsCollection.EMPTY<any>();

        const enabled = new Query(options, mockSchema, true);
        const disabled = new Query(options, mockSchema, false);

        expect(enabled.changeTracking).toBe(true);
        expect(disabled.changeTracking).toBe(false);
    });

    it('changeTracking is false when map has projected fields', () => {
        const options = QueryOptionsCollection.EMPTY<any>();
        options.add('map', {
            selector: (x: any) => ({ id: x.id }),
            fields: [{ sourceName: 'id', destinationName: 'id', isRename: false } as any]
        });

        const query = new Query(options, mockSchema);
        expect(query.changeTracking).toBe(false);
    });

    it('changeTracking remains true for map with no fields', () => {
        const options = QueryOptionsCollection.EMPTY<any>();
        options.add('map', {
            selector: (x: any) => x,
            fields: []
        });

        const query = new Query(options, mockSchema);
        expect(query.changeTracking).toBe(true);
    });

    it('changeTracking is false for aggregate options count/max/min/sum', () => {
        const countOptions = QueryOptionsCollection.EMPTY<any>();
        countOptions.add('count', true);
        expect(new Query(countOptions, mockSchema).changeTracking).toBe(false);

        const maxOptions = QueryOptionsCollection.EMPTY<any>();
        maxOptions.add('map', { selector: (x: any) => x.price, fields: [] });
        maxOptions.add('max', true);
        expect(new Query(maxOptions, mockSchema).changeTracking).toBe(false);

        const minOptions = QueryOptionsCollection.EMPTY<any>();
        minOptions.add('map', { selector: (x: any) => x.price, fields: [] });
        minOptions.add('min', true);
        expect(new Query(minOptions, mockSchema).changeTracking).toBe(false);

        const sumOptions = QueryOptionsCollection.EMPTY<any>();
        sumOptions.add('map', { selector: (x: any) => x.price, fields: [] });
        sumOptions.add('sum', true);
        expect(new Query(sumOptions, mockSchema).changeTracking).toBe(false);
    });

    it('toString() includes schema identity and computed changeTracking', () => {
        const options = QueryOptionsCollection.EMPTY<any>();
        options.add('sort', {
            selector: (x: any) => x.id,
            direction: QueryOrdering.Ascending,
            propertyName: 'id'
        });

        const query = new Query(options, mockSchema);
        const parsed = JSON.parse(Query.toString(query));

        expect(parsed.schema).toEqual({ id: 42, collectionName: 'products' });
        expect(parsed.changeTracking).toBe(true);
        expect(parsed.options).toBeDefined();
    });
});
