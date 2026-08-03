import { describe, it, expect } from '@jest/globals';
import { EXPRESSION_TYPES } from './constants';
import { isExpression } from '../assertions';

/**
 * EXPRESSION_TYPES is the whitelist behind the `isExpression` type guard, so each entry is
 * observable behavior: dropping or misspelling one makes the guard reject that expression
 * type everywhere it gates.
 */
describe('EXPRESSION_TYPES', () => {
    it.each([
        'operator',
        'comparator',
        'property',
        'value',
        'empty',
        'not-parsable',
    ] as const)('isExpression accepts type "%s"', type => {
        expect(isExpression({ type })).toBe(true);
    });

    it('isExpression rejects a type outside the list', () => {
        expect(isExpression({ type: 'no-such-type' })).toBe(false);
    });

    it('lists each type exactly once', () => {
        expect(new Set(EXPRESSION_TYPES).size).toBe(EXPRESSION_TYPES.length);
    });
});
