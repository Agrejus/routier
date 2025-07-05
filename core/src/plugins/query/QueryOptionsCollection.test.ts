import { describe, it, expect } from 'vitest';
import { QueryOptionsCollection } from './QueryOptionsCollection';
import { QueryOrdering } from './types';

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
}); 