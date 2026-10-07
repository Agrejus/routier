import { describe, expect, it } from '@jest/globals';
import { runInNewContext } from 'node:vm';
import { copyValue } from './copyValue';

describe('copyValue', () => {
    it.each([1, 'a', true, null, undefined])('returns %p as it is', value => {
        expect(copyValue(value)).toBe(value);
    });

    it('copies arrays and plain objects deeply', () => {
        const source = { a: [{ b: 1 }], c: { d: [2, 3] } };
        const copy = copyValue(source) as typeof source;

        expect(copy).toEqual(source);
        expect(copy).not.toBe(source);
        expect(copy.a[0]).not.toBe(source.a[0]);
        expect(copy.c.d).not.toBe(source.c.d);
    });

    it('copies a date into a new date', () => {
        const source = new Date(5);
        const copy = copyValue(source);

        expect(copy).toBeInstanceOf(Date);
        expect(copy).toEqual(source);
        expect(copy).not.toBe(source);
    });

    it('copies a date from another realm into a date of this realm', () => {
        const copy = copyValue(runInNewContext('new Date(5)'));

        expect(copy).toBeInstanceOf(Date);
        expect((copy as Date).getTime()).toBe(5);
    });

    it('copies a plain object from another realm', () => {
        expect(copyValue(runInNewContext('({ a: { b: 1 } })'))).toEqual({ a: { b: 1 } });
    });

    it('copies an object with no prototype', () => {
        expect(copyValue(Object.assign(Object.create(null), { a: 1 }))).toEqual({ a: 1 });
    });

    it('copies through a proxy into plain data', () => {
        const copy = copyValue(new Proxy({ a: [1] }, {}));

        expect(() => structuredClone(copy)).not.toThrow();
        expect(copy).toEqual({ a: [1] });
    });

    it('clones anything else structurally', () => {
        const source = new Map([['a', 1]]);
        const copy = copyValue(source);

        expect([...(copy as Map<string, number>).entries()]).toEqual([['a', 1]]);
        expect(copy).not.toBe(source);
    });

    it('copies an array holding proxies into plain data', () => {
        const copy = copyValue([new Proxy({ a: 1 }, {})]);

        expect(() => structuredClone(copy)).not.toThrow();
        expect(copy).toEqual([{ a: 1 }]);
    });
});
