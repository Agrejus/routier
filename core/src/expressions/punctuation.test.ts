import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { s } from '../schema';
import { logger } from '../utilities';
import { toExpression } from './parser';

/**
 * Single-character punctuation recognition.
 *
 * `SINGLE_CHARACTER_PUNCTUATION` lists characters the tokenizer emits as punctuation tokens.
 * Every entry is one mutant, and all twelve survived earlier rounds — plausibly equivalent,
 * since each of these characters appears only in syntax the parser rejects anyway, and
 * `toExpression` collapses every rejection to NOT_PARSABLE.
 *
 * They are not equivalent. The rejection message names the offending token
 * ("unexpected token '%'"), so a character dropped from the set cannot produce its own name
 * in the error. Asserting the token appears in the message distinguishes the original from
 * every mutant — and is worth having regardless, because a rejection that cannot say which
 * character it choked on is a poor diagnostic.
 */

const schema = s.define('punctuation_target', {
    id: s.string().key(),
    name: s.string(),
    price: s.number(),
}).compile();

let warn: any;

beforeEach(() => {
    warn = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
    warn.mockRestore();
});

/** The failure message for raw filter source, supplied via toString so invalid JS is allowed. */
function messageFor(source: string): string {
    warn.mockClear();
    toExpression(schema as any, { toString: () => source } as any);

    expect(warn).toHaveBeenCalled();
    const [, context] = warn.mock.calls[warn.mock.calls.length - 1] as [string, any];

    return String(context?.error?.message ?? '');
}

describe('rejections name the offending character', () => {
    const cases: [name: string, character: string, source: string][] = [
        ['modulo', '%', '(r) => r.price === 10 % 2'],
        ['asterisk', '*', '(r) => r.price === 10 * 2'],
        ['plus', '+', '(r) => r.price === 10 + 2'],
        ['minus', '-', '(r) => r.price === 10 - 2'],
        ['assignment', '=', '(r) => r.price = 10'],
        ['semicolon', ';', '(r) => r.price === 10;'],
        ['comma', ',', '(r) => r.price === 10, r.name === "x"'],
        ['open brace', '{', '(r) => r.price === 10 {'],
        ['close brace', '}', '(r) => r.price === 10 }'],
        ['question mark', '?', '(r) => r.price === 10 ? 1 : 2'],
        ['colon', ':', '(r) => r.price === 10 : 2'],
        ['ampersand', '&', '(r) => r.price === 10 & 2'],
        ['pipe', '|', '(r) => r.price === 10 | 2'],
    ];

    it.each(cases)('names %s in the rejection message', (_name, character, source) => {
        // The character has to be recognised as punctuation to be reported as a token.
        // Dropping it from the set changes what the parser can say about it.
        expect(messageFor(source)).toContain(character);
    });

    it.each(cases)('rejects rather than silently accepting %s', (_name, _character, source) => {
        expect(messageFor(source).length).toBeGreaterThan(0);
    });
});

/**
 * Bracket-access dispatch.
 *
 * `parser.ts:621` decides whether `r[...]` is a param-driven property (`r[p.field]`) or an
 * unsupported access, behind a four-part guard. Weakening any conjunct routes input down the
 * wrong branch — but both branches end in a rejection, and `toExpression` reports both as
 * NOT_PARSABLE, so only the message reveals which branch ran.
 */
describe('bracket access dispatch', () => {
    it('reports unsupported access for a bare identifier when params are supplied', () => {
        // The identifier is not the params name, so this is not a param path. Routing it to
        // the param branch instead would report a missing property rather than unsupported
        // access.
        expect(messageFor('([r, p]) => r[someVar] === "x"')).toMatch(/bracket access/i);
    });

    it('reports unsupported access for a bare identifier when no params exist', () => {
        // With no params name there is no param branch to take at all.
        expect(messageFor('(r) => r[someVar] === "x"')).toMatch(/bracket access/i);
    });

    it('reports unsupported access for a numeric index', () => {
        // A number token is neither a string key nor an identifier.
        expect(messageFor('(r) => r[0] === "x"')).toMatch(/bracket access/i);
    });

    it('names the offending token in the bracket-access message', () => {
        expect(messageFor('(r) => r[someVar] === "x"')).toContain('someVar');
    });
});
