import { describe, expect, it } from '@jest/globals';
import { s } from '../schema';
import { CALL_SOURCE } from './callSource';
import { evaluate } from './evaluate';
import { FOLDABLE, foldConstantCalls } from './fold';
import { parseFragment, toExpression } from './parser';
import { Call, CallExpression, ComparatorExpression, Expression, PropertyExpression, ValueExpression } from './types';
import { childrenOf } from './utils';

const schema = s.define('fold_probe', {
    id: s.string().key(),
    name: s.string(),
    age: s.number(),
}).compile();

const treeFor = (source: string, params?: unknown) =>
    toExpression(schema as never, new Function(`return ${source};`)() as never, params as never);

const property = (name: string) => new PropertyExpression({
    property: schema.properties.find(w => w.getAssignmentPath() === name)!
});

const callOn = (call: Call, operand: Expression, args: Expression[] = []) =>
    new CallExpression({ call, expression: operand, arguments: args });

const holdsACall = (expression: Expression): boolean =>
    expression.type === 'call' || childrenOf(expression).some(holdsACall);

describe('a call over literals is computed before the tree leaves core', () => {

    it.each([
        ['casing', '(x) => "ADA".toLowerCase() === x.name', 'ada'],
        ['exponent', '(x) => (2 ** 3) === x.age', 8],
        ['bitwise and', '(x) => (6 & 4) === x.age', 4],
        ['a shift', '(x) => (1 << 3) === x.age', 8],
        ['arithmetic', '(x) => (2 + 3) === x.age', 5],
        ['nested arithmetic', '(x) => ((2 + 3) * 4) === x.age', 20],
        ['coalescing', '(x) => (null ?? "z") === x.name', 'z'],
    ])('folds %s to its result', (_, source, expected) => {
        const tree = treeFor(source) as ComparatorExpression;

        expect(holdsACall(tree)).toBe(false);
        const value = [tree.left, tree.right].find(side => side instanceof ValueExpression) as ValueExpression;
        expect(value.value).toBe(expected);
    });

    it('folds an interpolated template once its params are bound', () => {
        const tree = treeFor('([x, p]) => x.name === `${p.prefix}a`', { prefix: 'z' }) as ComparatorExpression;

        expect(holdsACall(tree)).toBe(false);
        expect((tree.right as ValueExpression).value).toBe('za');
    });

    it('rebinds the same source to a different constant for different params', () => {
        const source = '([x, p]) => x.name === `${p.prefix}a`';

        expect(((treeFor(source, { prefix: 'y' }) as ComparatorExpression).right as ValueExpression).value).toBe('ya');
        expect(((treeFor(source, { prefix: 'z' }) as ComparatorExpression).right as ValueExpression).value).toBe('za');
    });

    it('leaves a call on a property alone, because only a row settles it', () => {
        expect(holdsACall(treeFor('(x) => x.name.toLowerCase() === "ada"'))).toBe(true);
    });

    it('leaves a call it cannot compute alone, rather than inventing a value', () => {
        const tree = treeFor('(x) => ("abc" * 2) === x.age');

        expect(holdsACall(tree)).toBe(true);
    });

    it('answers the same as the closure for every folded predicate', () => {
        const cases: Array<[string, {}, boolean]> = [
            ['(x) => "ADA".toLowerCase() === x.name', { name: 'ada' }, true],
            ['(x) => "ADA".toLowerCase() === x.name', { name: 'ADA' }, false],
            ['(x) => (2 ** 3) === x.age', { age: 8 }, true],
            ['(x) => (6 & 4) === x.age', { age: 4 }, true],
            ['(x) => (null ?? "z") === x.name', { name: 'z' }, true],
        ];

        for (const [source, row, expected] of cases) {
            const closure = new Function(`return ${source};`)();

            expect(evaluate(treeFor(source) as never, row as never)).toBe(closure(row));
            expect(closure(row)).toBe(expected);
        }
    });
});

describe('every call either folds over literals or survives for a plugin to decline', () => {

    /** Calls `applyCall` implements, with the result they compute over literals. */
    const FOLDS: Partial<Record<Call, { operand: unknown, args?: unknown[], folded: unknown }>> = {
        'to-lower-case': { operand: 'ADA', folded: 'ada' },
        'to-upper-case': { operand: 'ada', folded: 'ADA' },
        'length': { operand: 'abc', folded: 3 },
        'bit-not': { operand: 6, folded: -7 },
        'matches': { operand: 'abc', args: [/a/], folded: true },
        'to-string': { operand: 2, folded: '2' },
        'concat': { operand: 'a', args: ['b'], folded: 'ab' },
        'add': { operand: 2, args: [3], folded: 5 },
        'subtract': { operand: 5, args: [3], folded: 2 },
        'multiply': { operand: 2, args: [3], folded: 6 },
        'divide': { operand: 6, args: [3], folded: 2 },
        'modulo': { operand: 5, args: [3], folded: 2 },
        'power': { operand: 2, args: [3], folded: 8 },
        'bit-and': { operand: 6, args: [4], folded: 4 },
        'bit-or': { operand: 4, args: [1], folded: 5 },
        'bit-xor': { operand: 6, args: [3], folded: 5 },
        'shift-left': { operand: 1, args: [3], folded: 8 },
        'shift-right': { operand: 8, args: [2], folded: 2 },
        'shift-right-unsigned': { operand: -8, args: [1], folded: 2147483644 },
        'coalesce': { operand: null, args: ['z'], folded: 'z' },
    };

    /** Calls the evaluator does not implement. A plugin declines them; fold must not invent a value. */
    const SURVIVES: Partial<Record<Call, unknown>> = {
        'trim': ' a ', 'trim-start': ' a', 'trim-end': 'a ', 'index-of': 'abc',
        'substring': 'abc', 'replace': 'abc', 'replace-all': 'abc',
        'absolute': -2, 'floor': 2.5, 'ceiling': 2.5, 'round': 2.5, 'sign': -2, 'square-root': 4,
        'utc-year': new Date(0), 'utc-month': new Date(0), 'utc-day-of-month': new Date(0),
        'utc-day-of-week': new Date(0), 'utc-hour': new Date(0), 'utc-minute': new Date(0),
        'utc-second': new Date(0), 'utc-millisecond': new Date(0), 'epoch-ms': new Date(0),
        'to-number': '2', 'to-boolean': 1, 'type-of': 'a',
        'some': ['a'], 'every': ['a'],
    };

    it.each(Object.entries(FOLDS))('%s folds to its result', (call, { operand, args = [], folded: expected }) => {
        const tree = callOn(call as Call,
            new ValueExpression({ value: operand }),
            args.map(value => new ValueExpression({ value })));

        const folded = foldConstantCalls(tree);

        expect(folded).toBeInstanceOf(ValueExpression);
        expect((folded as ValueExpression).value).toBe(expected);
    });

    it.each(Object.entries(SURVIVES))('%s keeps its call node', (call, operand) => {
        const tree = callOn(call as Call, new ValueExpression({ value: operand }));

        expect(foldConstantCalls(tree).type).toBe('call');
    });

    it('folds a conditional through its comparator condition', () => {
        const tree = callOn('conditional', new ComparatorExpression({
            comparator: 'equals', negated: false, strict: false,
            left: new ValueExpression({ value: 1 }), right: new ValueExpression({ value: 1 })
        }), [new ValueExpression({ value: 'a' }), new ValueExpression({ value: 'b' })]);

        const folded = foldConstantCalls(tree);

        expect(folded).toBeInstanceOf(ValueExpression);
        expect((folded as ValueExpression).value).toBe('a');
    });

    it('folds exactly the calls the allowlist names', () => {
        expect(Object.keys(FOLDS).toSorted()).toEqual([...FOLDABLE].filter(call => call !== 'conditional').toSorted());
    });

    it('accounts for every call', () => {
        const covered = [...Object.keys(FOLDS), ...Object.keys(SURVIVES), 'conditional'];

        expect(covered.toSorted()).toEqual(Object.keys(CALL_SOURCE).toSorted());
    });

    it('never folds a call whose argument reads a row', () => {
        const tree = callOn('index-of', new ValueExpression({ value: 'abc' }), [property('name')]);

        expect(foldConstantCalls(tree).type).toBe('call');
    });
});

describe('what fold must not compute', () => {

    it('leaves a Date coerced to text alone, so no host freezes its timezone into the tree', () => {
        // specs/filter-expressions.md, "Refusal reasons": environment.
        const tree = treeFor('([x, p]) => x.name === `${p.when}`', { when: new Date(0) });

        expect(holdsACall(tree)).toBe(true);
    });

    it('leaves a template containing a Date alone', () => {
        const tree = treeFor('([x, p]) => x.name === `${p.when}-x`', { when: new Date(0) });

        expect(holdsACall(tree)).toBe(true);
    });

    it('still folds a template over a primitive param', () => {
        const tree = treeFor('([x, p]) => x.name === `${p.who}-x`', { who: 'ada' }) as any;

        expect(holdsACall(tree)).toBe(false);
        expect(tree.right.value).toBe('ada-x');
    });

    it('honours an explicit locale rather than the host default', () => {
        const folded = foldConstantCalls(callOn('to-lower-case',
            new ValueExpression({ value: 'TITLE' }),
            [new ValueExpression({ value: 'tr' })]));

        expect((folded as ValueExpression).value).toBe('t\u0131tle');
    });

    it('has no answer for a locale it cannot read, rather than the host default', () => {
        const folded = foldConstantCalls(callOn('to-lower-case',
            new ValueExpression({ value: 'TITLE' }),
            [new ValueExpression({ value: 'not a language tag' })]));

        expect(folded.type).toBe('call');
    });
});

describe('a parsed fragment', () => {

    it('folds its constants, so a join can still be pushed down', () => {
        const fragment = parseFragment(schema as never, 'x.age > 5 + 3', 'x') as any;

        expect(holdsACall(fragment)).toBe(false);
        expect(fragment.right.value).toBe(8);
    });
});

describe('a stateful pattern', () => {

    it('answers the same on every parse of one source, the way a fresh literal does', () => {
        // `test` advances `lastIndex` on a global pattern, and the pattern is shared with the cache.
        const folded = Array.from({ length: 6 }, () =>
            (treeFor('(x) => /a/g.test("aaa") && x.age > 1') as any).left.left.value);

        expect(folded).toEqual([true, true, true, true, true, true]);
    });

    it('answers the same for a sticky pattern', () => {
        const folded = Array.from({ length: 6 }, () =>
            (treeFor('(x) => /a/y.test("aaa") && x.age > 1') as any).left.left.value);

        expect(folded).toEqual([true, true, true, true, true, true]);
    });
});
