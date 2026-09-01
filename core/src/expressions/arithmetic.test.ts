import { describe, expect, it } from '@jest/globals';
import { s } from '../schema';
import { evaluate } from './evaluate';
import { toExpression } from './parser';
import { peelCalls } from './utils';

/**
 * Arithmetic in a filter. The tree always carried it — `Call` has had `add` through `modulo` since
 * the node existed — so this is the grammar learning to read `%`, and the answers it produces.
 *
 * The predicate list is shared with `plugins/sql-core/src/arithmetic.test.ts` and
 * `plugins/mongodb/src/arithmetic.test.ts`.
 */

const schema = s.define('arithmetic', {
    id: s.string().key(),
    age: s.number(),
    price: s.number(),
    other: s.number(),
}).compile();

const answers = (filter: (entity: any) => boolean, row: {}): boolean | undefined =>
    evaluate(toExpression(schema as never, filter as never, undefined as never), row as never);

const treeFor = (filter: (entity: any) => boolean) =>
    toExpression(schema as never, filter as never, undefined as never) as any;

describe('arithmetic operators', () => {

    it.each([
        ['modulo, even', (x: any) => x.age % 2 === 0, { age: 4 }, true],
        ['modulo, odd', (x: any) => x.age % 2 === 0, { age: 5 }, false],
        ['addition', (x: any) => x.age + 1 > 3, { age: 3 }, true],
        ['addition, below', (x: any) => x.age + 1 > 3, { age: 2 }, false],
        ['subtraction', (x: any) => x.age - 1 === 4, { age: 5 }, true],
        ['multiplication with a float', (x: any) => x.price * 1.2 > 100, { price: 90 }, true],
        ['multiplication, below', (x: any) => x.price * 1.2 > 100, { price: 50 }, false],
        ['division', (x: any) => x.price / 2 === 5, { price: 10 }, true],
    ])('answers %s', (_, filter, row, expected) => {
        expect(answers(filter, row)).toBe(expected);
    });

    it('binds two properties together', () => {
        expect(answers((x: any) => x.age + x.other === 7, { age: 3, other: 4 })).toBe(true);
        expect(answers((x: any) => x.age + x.other === 7, { age: 3, other: 5 })).toBe(false);
    });

    it('gives multiplication precedence over addition, as JavaScript does', () => {
        // 2 + 3 * 4 is 14, not 20
        expect(answers((x: any) => x.age + 3 * 4 === 14, { age: 2 })).toBe(true);
        expect(answers((x: any) => x.age + 3 * 4 === 20, { age: 2 })).toBe(false);
    });

    it('is left-associative, so a - b - c is (a - b) - c', () => {
        // 10 - 3 - 2 is 5; right-associative would be 9
        expect(answers((x: any) => x.age - 3 - 2 === 5, { age: 10 })).toBe(true);
    });

    it('nests the tree the way precedence demands', () => {
        // The multiplied operand is a property: a constant one folds away before the tree is read.
        const outer = treeFor((x: any) => x.age + x.other * 4 === 14);

        expect(outer.left.call).toBe('add');
        expect(outer.left.arguments[0].call).toBe('multiply');
    });

    it('reads the operand beneath the arithmetic, so orientation still finds the property', () => {
        expect(peelCalls(treeFor((x: any) => x.age % 2 === 0).left)?.operand.type).toBe('property');
    });

    // A call on an absent value has no answer, and 0 would be an invented one
    it('has no answer when the property is absent', () => {
        expect(answers((x: any) => x.age + 1 > 3, {})).toBeUndefined();
    });

    it('refuses arithmetic that names no schema property, which is a constant', () => {
        expect(treeFor((x: any) => 1 + 1 === 2).type).toBe('not-parsable');
    });

    it('refuses arithmetic used as a condition rather than compared', () => {
        expect(treeFor((x: any) => (x.age + 1) as never).type).toBe('not-parsable');
    });
});
