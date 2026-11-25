import { describe, expect, it } from '@jest/globals';
import { isRecord } from './records';

describe('isRecord', () => {
    it('is true for a plain object', () => {
        expect(isRecord({ id: 'a' })).toBe(true);
    });

    it.each([['null', null], ['an array', [1]], ['a string', 'x'], ['a number', 1], ['a function', () => 1], ['undefined', undefined]])('is false for %s', (_, value) => {
        expect(isRecord(value)).toBe(false);
    });
});
