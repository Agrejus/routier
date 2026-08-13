import { describe, it, expect } from '@jest/globals';
import { EmptyExpression, Expression, NotParsableExpression, ValueExpression } from './types';

/**
 * The static helpers on Expression are the sentinels the parser and every caller branch on
 * (NOT_PARSABLE is what routes a filter to in-memory execution), so their exact semantics
 * are pinned directly — nothing else in the mutation set exercises them.
 */
describe('Expression sentinels', () => {
    it('EMPTY is a fresh EmptyExpression', () => {
        expect(Expression.EMPTY).toBeInstanceOf(EmptyExpression);
        expect(Expression.EMPTY.type).toBe('empty');
        // A getter returning a shared instance would let one caller's mutation leak into
        // every other caller.
        expect(Expression.EMPTY).not.toBe(Expression.EMPTY);
    });

    it('NOT_PARSABLE is a fresh NotParsableExpression', () => {
        expect(Expression.NOT_PARSABLE).toBeInstanceOf(NotParsableExpression);
        expect(Expression.NOT_PARSABLE.type).toBe('not-parsable');
        expect(Expression.NOT_PARSABLE).not.toBe(Expression.NOT_PARSABLE);
    });

    describe('isEmpty', () => {
        it('accepts an EmptyExpression instance', () => {
            expect(Expression.isEmpty(new EmptyExpression())).toBe(true);
        });

        it('accepts a duck-typed expression carrying type "empty"', () => {
            // Either side of the check must be sufficient on its own — expressions that
            // crossed a structured-clone boundary keep the type but lose the prototype.
            expect(Expression.isEmpty({ type: 'empty' } as Expression)).toBe(true);
        });

        it('accepts an EmptyExpression whose type field is missing', () => {
            // The mirror case: prototype intact, type field absent.
            expect(Expression.isEmpty(Object.create(EmptyExpression.prototype))).toBe(true);
        });

        it('rejects other expressions', () => {
            expect(Expression.isEmpty(new ValueExpression({ value: 1 }))).toBe(false);
            expect(Expression.isEmpty(new NotParsableExpression())).toBe(false);
        });
    });

    describe('isNotParsable', () => {
        it('accepts a NotParsableExpression instance', () => {
            expect(Expression.isNotParsable(new NotParsableExpression())).toBe(true);
        });

        it('accepts a duck-typed expression carrying type "not-parsable"', () => {
            expect(Expression.isNotParsable({ type: 'not-parsable' } as Expression)).toBe(true);
        });

        it('accepts a NotParsableExpression whose type field is missing', () => {
            expect(Expression.isNotParsable(Object.create(NotParsableExpression.prototype))).toBe(true);
        });

        it('rejects other expressions', () => {
            expect(Expression.isNotParsable(new ValueExpression({ value: 1 }))).toBe(false);
            expect(Expression.isNotParsable(new EmptyExpression())).toBe(false);
        });
    });
});
