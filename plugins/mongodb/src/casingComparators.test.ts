import { describe, expect, it } from '@jest/globals';
import { toExpression } from '@routier/core/expressions';
import { s } from '@routier/core/schema';
import { toMql } from './mql';

/**
 * The Mongo half of the evidence for lifting the parser's casing guards.
 *
 * A property-side call cannot be a field key, so every one of these takes the `$expr` path. The
 * predicate list is shared with `core/src/expressions/casingComparators.test.ts` and
 * `plugins/sql-core/src/casingComparators.test.ts`.
 */

const schema = s.define('casing', {
    id: s.string().key(),
    name: s.string(),
    other: s.string(),
}).compile();

const mql = (filter: (entity: any) => boolean) =>
    toMql(toExpression(schema as never, filter as never, undefined as never));

describe('a casing call on a relational comparator', () => {

    it('takes the $expr path with $toLower', () => {
        expect(mql((x: any) => x.name.toLowerCase() === 'ada'))
            .toEqual({ $expr: { $eq: [{ $toLower: '$name' }, { $literal: 'ada' }] } });
    });

    it.each([
        ['greater-than', (x: any) => x.name.toUpperCase() > 'M', '$gt', '$toUpper', 'M'],
        ['greater-than-equals', (x: any) => x.name.toUpperCase() >= 'M', '$gte', '$toUpper', 'M'],
        ['less-than', (x: any) => x.name.toLowerCase() < 'b', '$lt', '$toLower', 'b'],
        ['less-than-equals', (x: any) => x.name.toLowerCase() <= 'b', '$lte', '$toLower', 'b'],
    ])('renders %s, which was unreachable while the guard stood', (_, filter, operator, fold, value) => {
        expect(mql(filter)).toEqual({ $expr: { [operator]: [{ [fold]: '$name' }, { $literal: value }] } });
    });

    it('renders a call on both sides of a property-to-property comparison', () => {
        expect(mql((x: any) => x.name.toLowerCase() === x.other.toLowerCase()))
            .toEqual({ $expr: { $eq: [{ $toLower: '$name' }, { $toLower: '$other' }] } });
    });

    it('renders a called property against a plain one', () => {
        expect(mql((x: any) => x.name === x.other.toLowerCase()))
            .toEqual({ $expr: { $eq: ['$name', { $toLower: '$other' }] } });
    });

    /** The regression that a defaulted `calls` parameter caused: the fold vanished from `input`. */
    it('keeps the fold in $regexMatch for a pattern against a called property', () => {
        expect(mql((x: any) => x.name.toLowerCase().startsWith('ad')))
            .toEqual({ $expr: { $regexMatch: { input: { $toLower: '$name' }, regex: '^ad' } } });
    });

    it('folds a call on the VALUE side into the literal, leaving a plain field predicate', () => {
        expect(mql((x: any) => x.name === 'ADA'.toLowerCase())).toEqual({ name: { $eq: 'ada' } });
    });
});
