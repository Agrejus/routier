import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { s } from '../schema';
import { logger } from '../utilities';
import { toExpression } from './parser';

/**
 * The content of parse-failure messages.
 *
 * `toExpression` converts every parse error into NOT_PARSABLE, so the reason is invisible at
 * that boundary — which is why 85 mutants that blank an `ERROR_MESSAGES` body survived: no
 * test could tell an informative failure from an empty one. The message is still observable,
 * because `toExpression` hands the caught error to `logger.warn` before returning.
 *
 * These messages are the only diagnostic a developer gets when a filter silently falls back
 * to in-memory evaluation. "Error parsing expression" with an empty reason turns a five
 * second fix into an afternoon, so the wording is part of the contract, not decoration.
 */

const schema = s.define('parser_messages', {
    id: s.string().key(),
    name: s.string(),
    price: s.number(),
    other: s.string(),
}).compile();

const fromSource = (source: string, args = 'r') =>
    new Function(`return (${args}) => ${source};`)() as any;

/** For source the Function constructor would reject outright, so the tokenizer is what judges it. */
const withSource = (source: string) => {
    const fn: any = () => true;
    fn.toString = () => source;
    return fn;
};

let warn: any;

beforeEach(() => {
    warn = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
    warn.mockRestore();
});

/** The message of the error `toExpression` logged for the most recent failed parse. */
function failureMessage(fn: any, params?: any): string {
    warn.mockClear();

    if (params === undefined) {
        toExpression(schema as any, fn);
    } else {
        toExpression(schema as any, fn, params);
    }

    expect(warn).toHaveBeenCalled();
    const [, context] = warn.mock.calls[warn.mock.calls.length - 1] as [string, any];

    return String(context?.error?.message ?? '');
}

describe('parse failures report why', () => {
    it('never reports an empty reason', () => {
        // The weakest useful guarantee, asserted across a spread of failure kinds: whatever
        // went wrong, the developer gets words.
        // Sources are unique within this file: a repeated source would hit the
        // parse-failure cache, which logs only on first discovery.
        const failures = [
            fromSource('r.name.trim() === "y"'),
            fromSource('r.tags.some(t => t === "a")'),
            fromSource('2 === 2'),
            fromSource('r.name.trim() === "x"'),
            fromSource('r.name.padStart(4) === "x"'),
            fromSource('!(r.price > someVar)'),
        ];

        for (const failure of failures) {
            expect(failureMessage(failure).length).toBeGreaterThan(0);
        }
    });

    it('names an unterminated template interpolation', () => {
        expect(failureMessage(withSource('(r) => r.name === `x-${r.other'))).toMatch(/unterminated template interpolation/i);
    });

    it('names the missing schema property requirement', () => {
        expect(failureMessage(fromSource('1 === 1'))).toMatch(/schema property/i);
    });

    it('names the at-least-one-side requirement when neither side is a property', () => {
        expect(failureMessage(fromSource('1 === 2'))).toMatch(/at least one side/i);
    });


    it('names the unsupported method', () => {
        // The method name has to appear, or the developer cannot tell which call to change.
        expect(failureMessage(fromSource('r.name.padStart(3) === "x"'))).toMatch(/padStart/);
    });

    it("names the negation restriction for '!' on a constant", () => {
        expect(failureMessage(fromSource('!true'))).toMatch(/'!' on this expression/);
    });

    it('names property access after a transform method', () => {
        expect(failureMessage(fromSource('r.name.toLowerCase().length === 3')))
            .toMatch(/after a transform method/i);
    });

    it('names comparing a method call to a non-boolean', () => {
        expect(failureMessage(fromSource('r.name.startsWith("a") === "yes"')))
            .toMatch(/non-boolean/i);
    });

    it('names the offending property path', () => {
        // The path is interpolated into the message; a mutant blanking it leaves the
        // developer with "unsupported" and no location.
        expect(failureMessage(fromSource('r.name.notAProperty === "x"'))).toMatch(/notAProperty/);
    });

    it('names the block-body restriction', () => {
        const blockBody = new Function('return (r) => { const x = r.price; };')();

        expect(failureMessage(blockBody)).toMatch(/block body/i);
    });

    it('names an unterminated string literal', () => {
        expect(failureMessage({ toString: () => '(r) => r.name === "unterminated' }))
            .toMatch(/unterminated string/i);
    });

    it('names an expression that ends early', () => {
        expect(failureMessage({ toString: () => '(r) => r.price >' }))
            .toMatch(/unexpected end/i);
    });

    it('reports the missing params path', () => {
        expect(failureMessage(fromSource('r.name === p.missing.deeper', '[r, p]'), { term: 'A' }))
            .toMatch(/missing/);
    });
});

describe('logging context', () => {
    it('includes the collection name so the schema is identifiable', () => {
        warn.mockClear();
        toExpression(schema as any, fromSource('3 === 3'));

        const [, context] = warn.mock.calls[0] as [string, any];

        expect(context.collectionName).toBe('parser_messages');
    });

    it('includes the offending selector source', () => {
        warn.mockClear();
        toExpression(schema as any, fromSource('4 === 4'));

        const [, context] = warn.mock.calls[0] as [string, any];

        // Without the source text the log names a failure but not which filter caused it.
        expect(String(context.selector)).toContain('4 === 4');
    });

    it('does not log for a filter that parses', () => {
        warn.mockClear();
        toExpression(schema as any, fromSource('r.name === "x"'));

        expect(warn).not.toHaveBeenCalled();
    });
});
