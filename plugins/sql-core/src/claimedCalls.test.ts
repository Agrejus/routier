import { describe, expect, it } from '@jest/globals';
import { CALL_SOURCE, CallExpression, ComparatorExpression, PropertyExpression, ValueExpression } from '@routier/core/expressions';
import type { Call } from '@routier/core/expressions';
import { s } from '@routier/core/schema';
import { canRenderInSql, toSql } from './sql';

/**
 * Whatever a dialect claims through `renders`, `toSql` must render.
 *
 * The counterpart of the MQL check. A claim the renderer cannot honour costs a thrown translation on
 * a query that would otherwise have run correctly in memory.
 */

const schema = s.define('claimed_calls', {
    id: s.string().key(),
    name: s.string(),
    age: s.number(),
}).compile();

const property = (name: string) => new PropertyExpression({
    property: schema.properties.find(w => w.getAssignmentPath() === name)!
});

const condition = () => new ComparatorExpression({
    comparator: 'greater-than',
    negated: false,
    strict: false,
    left: property('age'),
    right: new ValueExpression({ value: 1 })
});

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
const dialects = ['sqlite', 'postgresql', 'mysql', 'mssql'] as const;

describe('the calls each dialect claims', () => {

    it.each(dialects.flatMap(dialect => everyCall.map(call => [dialect, call] as const)))(
        '%s renders %s whenever it claims it',
        (dialect, call) => {
            const expression = comparisonUsing(call);

            if (canRenderInSql(expression, dialect) === false) {
                return;
            }

            expect(() => toSql(expression, dialect)).not.toThrow();
        }
    );

    it('declines a call no dialect implements', () => {
        for (const dialect of dialects) {
            expect(canRenderInSql(comparisonUsing('to-string'), dialect)).toBe(false);
            expect(canRenderInSql(comparisonUsing('some'), dialect)).toBe(false);
            expect(canRenderInSql(comparisonUsing('type-of'), dialect)).toBe(false);
        }
    });

    it('declines what each engine genuinely lacks', () => {
        expect(canRenderInSql(comparisonUsing('floor'), 'sqlite')).toBe(false);
        expect(canRenderInSql(comparisonUsing('floor'), 'postgresql')).toBe(true);
        expect(canRenderInSql(comparisonUsing('trim'), 'sqlite')).toBe(true);
        expect(canRenderInSql(comparisonUsing('power'), 'sqlite')).toBe(false);
        expect(canRenderInSql(comparisonUsing('power'), 'postgresql')).toBe(true);
        expect(canRenderInSql(comparisonUsing('shift-left'), 'mssql')).toBe(false);
        expect(canRenderInSql(comparisonUsing('shift-left'), 'mysql')).toBe(false);
    });
});
