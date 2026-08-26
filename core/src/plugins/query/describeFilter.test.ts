import { describe, expect, it } from '@jest/globals';
import { s } from '../../schema';
import { CallExpression, ComparatorExpression, PropertyExpression, ValueExpression } from '../../expressions';
import { toExpression } from '../../expressions';
import { describeFilterAsJs, describeUnparsableFilter, parameter, parameteriseDocument } from './describeFilter';
import type { Expression } from '../../expressions';

/**
 * What a backend reports it was asked to do.
 *
 * Every case asserts the TEXT and the PARAMETERS together. Text alone would pass while the values
 * lined up against the wrong placeholders, which is the failure worth guarding: a reader comparing
 * two runs would see identical queries and different results and have nothing to go on.
 */

const schema = s.define('described', {
    id: s.string().key(),
    name: s.string(),
    age: s.number(),
    active: s.boolean(),
}).compile();

/** The expression a real filter parses to — the same call the datastore makes. */
const expressionOf = (filter: (entity: any) => boolean, params?: {}): Expression =>
    toExpression(schema as never, filter as never, params as never);

describe('describeFilterAsJs', () => {

    it('renders a comparison with the value pulled out', () => {
        expect(describeFilterAsJs(expressionOf((x: any) => x.age > 18)))
            .toEqual({ text: 'age > ?', parameters: [18] });
    });

    it('pulls out a value that arrived through params, the same as a literal', () => {
        // The whole point of `?`: a caller cannot tell from the text where the value came from,
        // and neither should a reader comparing two runs of the same query.
        expect(describeFilterAsJs(expressionOf(([x, p]: any) => x.age > p.minimum, { minimum: 21 })))
            .toEqual({ text: 'age > ?', parameters: [21] });
    });

    it('keeps parameters in reading order across an && ', () => {
        const described = describeFilterAsJs(expressionOf((x: any) => x.age > 18 && x.name === 'ada'));

        expect(described.text).toBe('(age > ? && name === ?)');
        expect(described.parameters).toEqual([18, 'ada']);
    });

    it('renders || as ||', () => {
        expect(describeFilterAsJs(expressionOf((x: any) => x.age < 5 || x.age > 90)).text)
            .toBe('(age < ? || age > ?)');
    });

    it.each([
        ['startsWith', (x: any) => x.name.startsWith('a'), 'name.startsWith(?)'],
        ['endsWith', (x: any) => x.name.endsWith('z'), 'name.endsWith(?)'],
        ['includes', (x: any) => x.name.includes('d'), 'name.includes(?)'],
    ])('renders %s as the method call it was written as', (_, filter, expected) => {
        expect(describeFilterAsJs(expressionOf(filter)).text).toBe(expected);
    });

    it('renders a negated comparison with the opposite operator', () => {
        expect(describeFilterAsJs(expressionOf((x: any) => x.age !== 18)).text).toBe('age !== ?');
    });

    it('renders a property transformer as the call that produced it', () => {
        expect(describeFilterAsJs(expressionOf((x: any) => x.name.length > 3)))
            .toEqual({ text: 'name.length > ?', parameters: [3] });
    });

    it('renders a casing call on a relational comparator, which the parser used to refuse', () => {
        expect(describeFilterAsJs(expressionOf((x: any) => x.name.toLowerCase() === 'ada')))
            .toEqual({ text: 'name.toLowerCase() === ?', parameters: ['ada'] });
    });

    it('says a filter is not parsable rather than inventing a rendering for it', () => {
        expect(describeFilterAsJs(expressionOf((x: any) => x.name === outside())))
            .toEqual({ text: '(not parsable)', parameters: [] });
    });

    it.each([
        ['to-lower-case', 'name.toLowerCase()'],
        ['length', 'name.length'],
        ['trim', 'name.trim()'],
        ['absolute', 'Math.abs(name)'],
        ['type-of', 'typeof name'],
        ['to-number', 'Number(name)'],
    ])('renders the %s call as the JavaScript that produced it', (call, expected) => {
        const expression = new CallExpression({
            call: call as never,
            expression: new PropertyExpression({ property: schema.getProperty('name')! }),
        });

        expect(describeFilterAsJs(expression).text).toBe(expected);
    });

    it('renders a call argument as a parameter, so a value never lands in the text', () => {
        const expression = new CallExpression({
            call: 'substring',
            expression: new PropertyExpression({ property: schema.getProperty('name')! }),
            arguments: [new ValueExpression({ value: 0 }), new ValueExpression({ value: 2 })],
        });

        expect(describeFilterAsJs(expression)).toEqual({ text: 'name.substring(?, ?)', parameters: [0, 2] });
    });

    it('renders an arithmetic call with its operator', () => {
        const expression = new CallExpression({
            call: 'add',
            expression: new PropertyExpression({ property: schema.getProperty('age')! }),
            arguments: [new ValueExpression({ value: 1 })],
        });

        expect(describeFilterAsJs(expression)).toEqual({ text: 'age + ?', parameters: [1] });
    });

    it('renders a call on both sides of a comparator', () => {
        const lower = (property: string) => new CallExpression({
            call: 'to-lower-case',
            expression: new PropertyExpression({ property: schema.getProperty(property)! }),
        });

        const described = describeFilterAsJs(new ComparatorExpression({
            comparator: 'equals', negated: false, strict: true, left: lower('name'), right: lower('id'),
        }));

        expect(described.text).toBe('name.toLowerCase() === id.toLowerCase()');
    });

    it('does not call an unrecognised node not-parsable, which would name the wrong problem', () => {
        expect(describeFilterAsJs({ type: 'quantifier' } as never).text).toBe('(unsupported: quantifier)');
    });

    it('says so when there is no filter at all', () => {
        expect(describeFilterAsJs({ type: 'empty' } as Expression).text).toBe('(no filter)');
    });
});

describe('parameteriseDocument', () => {

    /** A document language carries values inline, so the dialect marks which parts are data. */
    it('replaces a marked value with a placeholder and collects it', () => {
        expect(parameteriseDocument({ age: { $gt: parameter(18) } }))
            .toEqual({ text: '{ "age": { "$gt": ? } }', parameters: [18] });
    });

    it('leaves operators and field paths alone, because they are structure not data', () => {
        const described = parameteriseDocument({ $and: [{ age: { $gt: parameter(18) } }, { name: parameter('ada') }] });

        expect(described.text).toBe('{ "$and": [{ "age": { "$gt": ? } }, { "name": ? }] }');
        expect(described.parameters).toEqual([18, 'ada']);
    });

    it('collects parameters in the order they are written', () => {
        expect(parameteriseDocument({ a: parameter(1), b: parameter(2), c: parameter(3) }).parameters)
            .toEqual([1, 2, 3]);
    });

    it('parameterises inside an array, which is where $in values live', () => {
        expect(parameteriseDocument({ kind: { $in: [parameter('a'), parameter('b')] } }))
            .toEqual({ text: '{ "kind": { "$in": [?, ?] } }', parameters: ['a', 'b'] });
    });

    it('renders an unmarked value literally, so a structural constant is still readable', () => {
        expect(parameteriseDocument({ deleted: false }))
            .toEqual({ text: '{ "deleted": false }', parameters: [] });
    });

    it('renders an empty document, which is the match-everything filter', () => {
        expect(parameteriseDocument({})).toEqual({ text: '{  }', parameters: [] });
    });

    /** A value that would otherwise be printed — the reason `parameter` exists. */
    it('keeps a marked null out of the text', () => {
        expect(parameteriseDocument({ deletedAt: parameter(null) }))
            .toEqual({ text: '{ "deletedAt": ? }', parameters: [null] });
    });
});

describe('describeUnparsableFilter', () => {

    /**
     * The case where the source matters most: an unparsable filter is WHY the query did not push
     * down, and the reason codes say that it happened without showing what it was.
     */
    it('shows the predicate as written, and says why it is being shown', () => {
        const described = describeUnparsableFilter((x: any) => x.name === outside());

        expect(described.text).toContain('x.name === outside()');
        expect(described.text).toContain('could not be parsed');
        expect(described.parameters).toEqual([]);
    });

    it('does not pretend to have extracted parameters it never understood', () => {
        expect(describeUnparsableFilter((x: any) => x.age > 1).parameters).toEqual([]);
    });

    it('falls back for something that is not a function at all', () => {
        expect(describeUnparsableFilter(undefined).text).toBe('(not parsable)');
    });
});

function outside(): string {
    return 'ada';
}
