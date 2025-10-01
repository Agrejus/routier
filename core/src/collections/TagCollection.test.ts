import { describe, it, expect, beforeEach } from '@jest/globals';
import { TagCollection } from './TagCollection';

describe('TagCollection', () => {
    let tagCollection: TagCollection;

    beforeEach(() => {
        tagCollection = new TagCollection();
    });

    describe('constructor', () => {
        it('should create empty tag collection', () => {
            expect(tagCollection.size).toBe(0);
            expect(tagCollection.has('test')).toBe(false);
        });
    });

    describe('size', () => {
        it('should return 0 for empty collection', () => {
            expect(tagCollection.size).toBe(0);
        });

        it('should return correct size after adding items', () => {
            tagCollection.set('key1', 'value1');
            expect(tagCollection.size).toBe(1);

            tagCollection.set('key2', 'value2');
            expect(tagCollection.size).toBe(2);
        });

        it('should return correct size after deleting items', () => {
            tagCollection.set('key1', 'value1');
            tagCollection.set('key2', 'value2');
            expect(tagCollection.size).toBe(2);

            tagCollection.delete('key1');
            expect(tagCollection.size).toBe(1);
        });
    });

    describe('get', () => {
        it('should return undefined for non-existent key', () => {
            expect(tagCollection.get('non-existent')).toBeUndefined();
        });

        it('should return value for existing key', () => {
            const testValue = { data: 'test' };
            tagCollection.set('test-key', testValue);
            expect(tagCollection.get('test-key')).toBe(testValue);
        });

        it('should return different values for different keys', () => {
            const value1 = 'value1';
            const value2 = { nested: 'value2' };

            tagCollection.set('key1', value1);
            tagCollection.set('key2', value2);

            expect(tagCollection.get('key1')).toBe(value1);
            expect(tagCollection.get('key2')).toBe(value2);
        });
    });

    describe('has', () => {
        it('should return false for non-existent key', () => {
            expect(tagCollection.has('non-existent')).toBe(false);
        });

        it('should return true for existing key', () => {
            tagCollection.set('test-key', 'test-value');
            expect(tagCollection.has('test-key')).toBe(true);
        });

        it('should return false after deleting key', () => {
            tagCollection.set('test-key', 'test-value');
            expect(tagCollection.has('test-key')).toBe(true);

            tagCollection.delete('test-key');
            expect(tagCollection.has('test-key')).toBe(false);
        });
    });

    describe('set', () => {
        it('should add new key-value pair', () => {
            const result = tagCollection.set('new-key', 'new-value');
            expect(tagCollection.has('new-key')).toBe(true);
            expect(tagCollection.get('new-key')).toBe('new-value');
            expect(tagCollection.size).toBe(1);
        });

        it('should overwrite existing key and increment size', () => {
            tagCollection.set('key', 'old-value');
            expect(tagCollection.get('key')).toBe('old-value');
            expect(tagCollection.size).toBe(1);

            tagCollection.set('key', 'new-value');
            expect(tagCollection.get('key')).toBe('new-value');
            expect(tagCollection.size).toBe(2);
        });

        it('should handle different value types', () => {
            tagCollection.set('string', 'string-value');
            tagCollection.set('number', 42);
            tagCollection.set('object', { prop: 'value' });
            tagCollection.set('array', [1, 2, 3]);
            tagCollection.set('null', null);
            tagCollection.set('undefined', undefined);

            expect(tagCollection.get('string')).toBe('string-value');
            expect(tagCollection.get('number')).toBe(42);
            expect(tagCollection.get('object')).toEqual({ prop: 'value' });
            expect(tagCollection.get('array')).toEqual([1, 2, 3]);
            expect(tagCollection.get('null')).toBe(null);
            expect(tagCollection.get('undefined')).toBe(undefined);
            expect(tagCollection.size).toBe(6);
        });
    });

    describe('delete', () => {
        it('should return false for non-existent key', () => {
            expect(tagCollection.delete('non-existent')).toBe(false);
        });

        it('should return true and remove existing key', () => {
            tagCollection.set('test-key', 'test-value');
            expect(tagCollection.has('test-key')).toBe(true);

            const result = tagCollection.delete('test-key');
            expect(result).toBe(true);
            expect(tagCollection.has('test-key')).toBe(false);
            expect(tagCollection.get('test-key')).toBeUndefined();
        });

        it('should decrease size when deleting existing key', () => {
            tagCollection.set('key1', 'value1');
            tagCollection.set('key2', 'value2');
            expect(tagCollection.size).toBe(2);

            tagCollection.delete('key1');
            expect(tagCollection.size).toBe(1);
        });

        it('should not decrease size when deleting non-existent key', () => {
            tagCollection.set('key1', 'value1');
            expect(tagCollection.size).toBe(1);

            tagCollection.delete('non-existent');
            expect(tagCollection.size).toBe(1);
        });
    });

    describe('setMany', () => {
        it('should add multiple keys with same value', () => {
            const keys = ['key1', 'key2', 'key3'];
            const value = 'shared-value';

            tagCollection.setMany(keys, value);

            expect(tagCollection.size).toBe(6);
            expect(tagCollection.get('key1')).toBe(value);
            expect(tagCollection.get('key2')).toBe(value);
            expect(tagCollection.get('key3')).toBe(value);
        });

        it('should handle empty keys array', () => {
            tagCollection.setMany([], 'value');
            expect(tagCollection.size).toBe(0);
        });

        it('should handle single key', () => {
            tagCollection.setMany(['single-key'], 'single-value');
            expect(tagCollection.size).toBe(2);
            expect(tagCollection.get('single-key')).toBe('single-value');
        });

        it('should overwrite existing keys', () => {
            tagCollection.set('key1', 'old-value');
            tagCollection.set('key2', 'old-value');

            tagCollection.setMany(['key1', 'key2', 'key3'], 'new-value');

            expect(tagCollection.size).toBe(8);
            expect(tagCollection.get('key1')).toBe('new-value');
            expect(tagCollection.get('key2')).toBe('new-value');
            expect(tagCollection.get('key3')).toBe('new-value');
        });
    });

    describe('combine', () => {
        it('should combine two tag collections', () => {
            const otherCollection = new TagCollection();
            otherCollection.set('key1', 'value1');
            otherCollection.set('key2', 'value2');

            tagCollection.set('key3', 'value3');
            tagCollection.combine(otherCollection);

            expect(tagCollection.size).toBe(1);
            expect(tagCollection.get('key1')).toBe('value1');
            expect(tagCollection.get('key2')).toBe('value2');
            expect(tagCollection.get('key3')).toBe('value3');
        });

        it('should overwrite existing keys when combining', () => {
            tagCollection.set('key1', 'old-value');
            tagCollection.set('key2', 'old-value');

            const otherCollection = new TagCollection();
            otherCollection.set('key1', 'new-value');
            otherCollection.set('key3', 'new-value');

            tagCollection.combine(otherCollection);

            expect(tagCollection.size).toBe(2);
            expect(tagCollection.get('key1')).toBe('new-value');
            expect(tagCollection.get('key2')).toBe('old-value');
            expect(tagCollection.get('key3')).toBe('new-value');
        });

        it('should handle empty collection', () => {
            const emptyCollection = new TagCollection();
            tagCollection.set('key1', 'value1');

            tagCollection.combine(emptyCollection);

            expect(tagCollection.size).toBe(1);
            expect(tagCollection.get('key1')).toBe('value1');
        });

        it('should combine with empty target collection', () => {
            const otherCollection = new TagCollection();
            otherCollection.set('key1', 'value1');
            otherCollection.set('key2', 'value2');

            tagCollection.combine(otherCollection);

            expect(tagCollection.size).toBe(0);
            expect(tagCollection.get('key1')).toBe('value1');
            expect(tagCollection.get('key2')).toBe('value2');
        });
    });

    describe('values', () => {
        it('should return empty iterator for empty collection', () => {
            const values = Array.from(tagCollection.values());
            expect(values).toEqual([]);
        });

        it('should return all values', () => {
            tagCollection.set('key1', 'value1');
            tagCollection.set('key2', 'value2');
            tagCollection.set('key3', 'value3');

            const values = Array.from(tagCollection.values());
            expect(values).toHaveLength(3);
            expect(values).toEqual(expect.arrayContaining(['value1', 'value2', 'value3']));
        });

        it('should return unique values when keys have same value', () => {
            tagCollection.set('key1', 'shared-value');
            tagCollection.set('key2', 'shared-value');
            tagCollection.set('key3', 'different-value');

            const values = Array.from(tagCollection.values());
            expect(values).toHaveLength(3);
            expect(values).toEqual(expect.arrayContaining(['shared-value', 'shared-value', 'different-value']));
        });
    });

    describe('keys', () => {
        it('should return empty iterator for empty collection', () => {
            const keys = Array.from(tagCollection.keys());
            expect(keys).toEqual([]);
        });

        it('should return all keys', () => {
            tagCollection.set('key1', 'value1');
            tagCollection.set('key2', 'value2');
            tagCollection.set('key3', 'value3');

            const keys = Array.from(tagCollection.keys());
            expect(keys).toHaveLength(3);
            expect(keys).toEqual(expect.arrayContaining(['key1', 'key2', 'key3']));
        });
    });

    describe('iterator', () => {
        it('should iterate over key-value pairs', () => {
            tagCollection.set('key1', 'value1');
            tagCollection.set('key2', 'value2');

            const entries = Array.from(tagCollection);
            expect(entries).toHaveLength(2);
            expect(entries).toEqual(expect.arrayContaining([
                ['key1', 'value1'],
                ['key2', 'value2']
            ]));
        });

        it('should return empty iterator for empty collection', () => {
            const entries = Array.from(tagCollection);
            expect(entries).toEqual([]);
        });

        it('should iterate in insertion order', () => {
            tagCollection.set('key1', 'value1');
            tagCollection.set('key2', 'value2');
            tagCollection.set('key3', 'value3');

            const entries = Array.from(tagCollection);
            expect(entries[0]).toEqual(['key1', 'value1']);
            expect(entries[1]).toEqual(['key2', 'value2']);
            expect(entries[2]).toEqual(['key3', 'value3']);
        });
    });

    describe('dispose', () => {
        it('should clear data when disposed', () => {
            tagCollection.set('key1', 'value1');
            tagCollection.set('key2', 'value2');

            tagCollection[Symbol.dispose]();

            expect(tagCollection.size).toBe(2);
            expect(() => tagCollection.has('key1')).toThrow();
            expect(() => tagCollection.has('key2')).toThrow();
        });

        it('should handle multiple dispose calls', () => {
            tagCollection.set('key1', 'value1');
            tagCollection[Symbol.dispose]();
            tagCollection[Symbol.dispose]();

            expect(tagCollection.size).toBe(1);
        });
    });

    describe('Edge Cases and Error Handling', () => {
        it('should handle null and undefined keys', () => {
            tagCollection.set(null as any, 'null-value');
            tagCollection.set(undefined as any, 'undefined-value');

            expect(tagCollection.has(null as any)).toBe(true);
            expect(tagCollection.has(undefined as any)).toBe(true);
            expect(tagCollection.get(null as any)).toBe('null-value');
            expect(tagCollection.get(undefined as any)).toBe('undefined-value');
            expect(tagCollection.size).toBe(2);
        });

        it('should handle object keys', () => {
            const objKey1 = { id: 1 };
            const objKey2 = { id: 2 };

            tagCollection.set(objKey1, 'object-value-1');
            tagCollection.set(objKey2, 'object-value-2');

            expect(tagCollection.has(objKey1)).toBe(true);
            expect(tagCollection.has(objKey2)).toBe(true);
            expect(tagCollection.get(objKey1)).toBe('object-value-1');
            expect(tagCollection.get(objKey2)).toBe('object-value-2');
        });

        it('should handle function keys', () => {
            const funcKey = () => { };
            tagCollection.set(funcKey, 'function-value');

            expect(tagCollection.has(funcKey)).toBe(true);
            expect(tagCollection.get(funcKey)).toBe('function-value');
        });

        it('should handle large number of items', () => {
            const largeNumber = 1000;
            for (let i = 0; i < largeNumber; i++) {
                tagCollection.set(`key${i}`, `value${i}`);
            }

            expect(tagCollection.size).toBe(largeNumber);
            expect(tagCollection.get('key0')).toBe('value0');
            expect(tagCollection.get(`key${largeNumber - 1}`)).toBe(`value${largeNumber - 1}`);
        });

        it('should handle rapid add and delete operations', () => {
            for (let i = 0; i < 100; i++) {
                tagCollection.set(`key${i}`, `value${i}`);
                tagCollection.delete(`key${i}`);
            }

            expect(tagCollection.size).toBe(0);
        });
    });

    describe('Integration Tests', () => {
        it('should handle complex workflow', () => {
            tagCollection.set('initial', 'initial-value');
            expect(tagCollection.size).toBe(1);

            tagCollection.setMany(['batch1', 'batch2', 'batch3'], 'batch-value');
            expect(tagCollection.size).toBe(7);

            const otherCollection = new TagCollection();
            otherCollection.set('external1', 'external-value1');
            otherCollection.set('external2', 'external-value2');

            tagCollection.combine(otherCollection);
            expect(tagCollection.size).toBe(7);

            tagCollection.delete('initial');
            expect(tagCollection.size).toBe(6);

            const values = Array.from(tagCollection.values());
            expect(values).toHaveLength(5);
            expect(values).toEqual(expect.arrayContaining([
                'batch-value',
                'external-value1',
                'external-value2'
            ]));
        });

        it('should maintain consistency after multiple operations', () => {
            const keys = ['key1', 'key2', 'key3', 'key4', 'key5'];
            const values = ['value1', 'value2', 'value3', 'value4', 'value5'];

            for (let i = 0; i < keys.length; i++) {
                tagCollection.set(keys[i], values[i]);
            }

            expect(tagCollection.size).toBe(5);

            tagCollection.delete('key2');
            tagCollection.delete('key4');

            expect(tagCollection.size).toBe(3);
            expect(tagCollection.has('key1')).toBe(true);
            expect(tagCollection.has('key2')).toBe(false);
            expect(tagCollection.has('key3')).toBe(true);
            expect(tagCollection.has('key4')).toBe(false);
            expect(tagCollection.has('key5')).toBe(true);

            const remainingValues = Array.from(tagCollection.values());
            expect(remainingValues).toEqual(expect.arrayContaining(['value1', 'value3', 'value5']));
        });
    });
}); 