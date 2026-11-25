import { describe, expect, it } from '@jest/globals';
import { dexieQuery, dexieTable, readNote } from './explainQuery';

describe('dexieTable', () => {
    it('is a property of db for a table name that is an identifier', () => {
        expect(dexieTable('orders')).toBe('db.orders');
    });

    it('is db.table(...) for one that is not', () => {
        expect(['1st', 'a b', 'full-text'].map(dexieTable)).toEqual(['db.table("1st")', 'db.table("a b")', 'db.table("full-text")']);
    });
});

describe('readNote', () => {
    it.each([
        [1, false, false, 'an IndexedDB index seek'],
        [1, false, true, 'an IndexedDB index seek, then a JavaScript filter over the rows it found'],
        [3, false, false, '3 IndexedDB index seeks'],
        [0, true, false, 'an IndexedDB index walk in key order'],
        [0, true, true, 'an IndexedDB index walk in key order, with a JavaScript filter'],
        [0, false, false, 'a full table walk, no index'],
        [0, false, true, 'a full table walk, no index, with a JavaScript filter'],
    ])('says %i seeks, index walk %s, filter %s as %s', (seeks, walksIndex, hasFilter, expected) => {
        expect(readNote(seeks, walksIndex, hasFilter)).toBe(expected);
    });
});

describe('dexieQuery', () => {
    it('chains the read, the filter, the steps and the terminal', () => {
        expect(dexieQuery({
            table: 'orders',
            read: 'where("status").equals(?)',
            filter: 'x.amount > ?',
            steps: ['offset(?)', 'limit(?)'],
            terminal: 'toArray()',
            parameters: ['paid', 10, 5, 20],
            seeks: 1,
            walksIndex: false,
        })).toEqual({
            text: 'db.orders.where("status").equals(?).filter(x => x.amount > ?).offset(?).limit(?).toArray()',
            parameters: ['paid', 10, 5, 20],
            language: 'dexie',
            note: 'an IndexedDB index seek, then a JavaScript filter over the rows it found',
        });
    });

    it('leaves out the filter and the parameters when there are none', () => {
        expect(dexieQuery({ table: 'orders', read: 'toCollection()', filter: null, steps: [], terminal: 'count()', parameters: [], seeks: 0, walksIndex: false })).toStrictEqual({
            text: 'db.orders.toCollection().count()',
            language: 'dexie',
            note: 'a full table walk, no index',
        });
    });
});
