import { describe, expect, it } from '@jest/globals';
import { CALL_SOURCE, CallExpression, ComparatorExpression, PropertyExpression, ValueExpression } from '@routier/core/expressions';
import type { Call } from '@routier/core/expressions';
import { s } from '@routier/core/schema';
import { canRenderInMql, toMql } from './mql';

/**
 * Whatever `canRenderInMql` claims, `toMql` must render.
 *
 * The check used to be a denylist, which claimed every call the tree gained next — and the renderer
 * throws on a call it has no branch for. `to-string` reached that state the moment a lone template
 * interpolation started producing one.
 */

const schema = s.define('claimed_calls', {
    id: s.string().key(),
    name: s.string(),
    age: s.number(),
}).compile();

const property = (name: string) => new PropertyExpression({
    property: schema.properties.find(w => w.getAssignmentPath() === name)!
});

/** A boolean condition, which is the only thing the parser puts in a conditional's operand slot. */
const condition = () => new ComparatorExpression({
    comparator: 'greater-than',
    negated: false,
    strict: false,
    left: property('age'),
    right: new ValueExpression({ value: 1 })
});

/** One comparison per call, shaped the way the parser shapes it: the call on the left, a value right. */
const comparisonUsing = (call: Call) => new ComparatorExpression({
    comparator: 'equals',
    negated: false,
    strict: false,
    left: new CallExpression({
        call,
        expression: call === 'conditional' ? condition() : property(call === 'matches' ? 'name' : 'age'),
        arguments: call === 'matches'
            ? [new ValueExpression({ value: /^a/ })]
            : [new ValueExpression({ value: 2 }), new ValueExpression({ value: 3 })]
    }),
    right: new ValueExpression({ value: 1 })
});

const everyCall = Object.keys(CALL_SOURCE) as Call[];

describe('the calls MQL claims', () => {

    it.each(everyCall)('renders %s whenever it claims it', call => {
        const expression = comparisonUsing(call);

        if (canRenderInMql(expression) === false) {
            return;
        }

        expect(() => toMql(expression)).not.toThrow();
    });

    it('declines a call it has no branch for, rather than throwing on it', () => {
        expect(canRenderInMql(comparisonUsing('to-string'))).toBe(false);
        expect(canRenderInMql(comparisonUsing('trim'))).toBe(false);
        expect(canRenderInMql(comparisonUsing('some'))).toBe(false);
    });

    it('still claims the calls it does render', () => {
        expect(canRenderInMql(comparisonUsing('to-lower-case'))).toBe(true);
        expect(canRenderInMql(comparisonUsing('modulo'))).toBe(true);
        expect(canRenderInMql(comparisonUsing('bit-and'))).toBe(true);
    });

    it('still declines the shifts, which have no aggregation operator', () => {
        expect(canRenderInMql(comparisonUsing('shift-left'))).toBe(false);
        expect(canRenderInMql(comparisonUsing('shift-right'))).toBe(false);
        expect(canRenderInMql(comparisonUsing('shift-right-unsigned'))).toBe(false);
    });
});
