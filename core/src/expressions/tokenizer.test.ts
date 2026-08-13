import { describe, expect, it } from '@jest/globals';
import { s } from '../schema';
import { toExpression } from './parser';
import { ComparatorExpression, Expression, ValueExpression } from './types';

/**
 * Tokenizer edge cases, asserted directly against `toExpression`.
 *
 * These same forms are covered behaviorally in `datastore/.../filterForms.test.ts`, but that
 * route cannot see a tokenizer defect: a filter that fails to parse falls back to in-memory
 * evaluation and still returns the right rows. Only a direct assertion distinguishes
 * "parsed correctly" from "failed to parse and was rescued by the fallback".
 *
 * Targets the three largest surviving-mutant clusters:
 *   parser.ts:88-90 — the block comment scanner (25 mutants)
 *   parser.ts:45    — MULTI_CHARACTER_PUNCTUATION (12 mutants)
 *   parser.ts:111   — template literal interpolation detection (6 mutants)
 */

const schema = s.define('tokenizer_target', {
    id: s.string().key(),
    name: s.string(),
    price: s.number(),
    active: s.boolean(),
}).compile();

const fromSource = (source: string) => new Function(`return (r) => ${source};`)() as any;

const parse = (source: string) => toExpression(schema as any, fromSource(source));

/** Asserts the source parsed into a comparator carrying the expected right-hand value. */
function expectComparison(source: string, value: unknown) {
    const result = parse(source);

    expect(result).not.toStrictEqual(Expression.NOT_PARSABLE);
    expect(result).toBeInstanceOf(ComparatorExpression);
    expect((((result as ComparatorExpression).right) as ValueExpression)?.value).toEqual(value);
}

const expectNotParsable = (source: string) =>
    expect(parse(source)).toStrictEqual(Expression.NOT_PARSABLE);

describe('block comments', () => {
    it('skips a comment between operand and operator', () => {
        expectComparison('r.price /* note */ === 5', 5);
    });

    it('skips a comment before the whole expression', () => {
        expectComparison('/* leading */ r.price === 5', 5);
    });

    it('skips a comment after the whole expression', () => {
        expectComparison('r.price === 5 /* trailing */', 5);
    });

    it('skips an empty comment', () => {
        // `/**/` — the terminator appears immediately, so the scan must not overrun.
        expectComparison('r.price ===/**/5', 5);
    });

    it('skips a comment containing a lone asterisk', () => {
        // A `*` not followed by `/` must not end the comment. Mutating the terminator check
        // to look at only one of the two characters shows up here.
        expectComparison('r.price === /* a * b */ 5', 5);
    });

    it('skips a comment containing a lone slash', () => {
        expectComparison('r.price === /* a / b */ 5', 5);
    });

    it('skips a comment containing an inner comment opener', () => {
        // Block comments do not nest: the first `*/` closes it.
        expectComparison('r.price === /* /* still inside */ 5', 5);
    });

    it('skips a comment containing operator characters', () => {
        expectComparison('r.price === /* && || === !== */ 5', 5);
    });

    it('skips a multi-line comment', () => {
        expectComparison('r.price ===\n/*\n spanning\n lines\n*/\n5', 5);
    });

    it('skips several comments in one expression', () => {
        expectComparison('/*a*/ r.price /*b*/ === /*c*/ 5 /*d*/', 5);
    });

    it('does not treat a division slash as a comment opener', () => {
        // `/` not followed by `*` is not a comment. Weakening the second half of the check
        // would make this swallow the rest of the expression.
        expectNotParsable('r.price === 10 / 2');
    });

    it('terminates on an unterminated block comment rather than looping', () => {
        // `new Function` cannot build this — an unterminated comment is invalid JS — so the
        // source is supplied directly via toString, which is also how a minifier or an
        // unusual toString implementation could hand the parser malformed input.
        //
        // The scan is bounded by source length. Without that bound it reads past the end
        // forever, so the real assertion is that this call returns at all.
        const result = toExpression(schema as any, { toString: () => '(r) => r.price === 5 /* never closed' } as any);

        expect(result).toBeDefined();
    });

    it('skips a line comment terminated by a newline', () => {
        expectComparison('r.price === 5 // trailing\n', 5);
    });

    it('resumes parsing after a line comment', () => {
        expectComparison('r.price // the price\n=== 5', 5);
    });
});

describe('multi-character operators', () => {
    // Each operator is a separate entry in MULTI_CHARACTER_PUNCTUATION, and the table is
    // ordered longest-first so a prefix cannot win. Asserted directly, because through a
    // query these all return correct rows whether or not the parse succeeded.
    it('parses ===', () => expectComparison('r.price === 5', 5));
    it('parses !==', () => expectComparison('r.price !== 5', 5));
    it('parses >=', () => expectComparison('r.price >= 5', 5));
    it('parses <=', () => expectComparison('r.price <= 5', 5));
    it('parses >', () => expectComparison('r.price > 5', 5));
    it('parses <', () => expectComparison('r.price < 5', 5));

    // eslint-disable-next-line eqeqeq
    it('parses == without being consumed by ===', () => expectComparison('r.price == 5', 5));
    // eslint-disable-next-line eqeqeq
    it('parses != without being consumed by !==', () => expectComparison('r.price != 5', 5));

    it('parses && between two comparisons', () => {
        expect(parse('r.price === 5 && r.name === "x"')).not.toStrictEqual(Expression.NOT_PARSABLE);
    });

    it('parses || between two comparisons', () => {
        expect(parse('r.price === 5 || r.name === "x"')).not.toStrictEqual(Expression.NOT_PARSABLE);
    });

    it('distinguishes === from == in the resulting comparator', () => {
        const strict = parse('r.price === 5') as ComparatorExpression;
        // eslint-disable-next-line eqeqeq
        const loose = parse('r.price == 5') as ComparatorExpression;

        // Both are comparisons, and the strictness flag has to reflect which was written.
        expect(strict.comparator).toBe(loose.comparator);
        expect(strict.strict).toBe(true);
        expect(loose.strict).toBe(false);
    });

    it('distinguishes !== from === via negation', () => {
        const equals = parse('r.price === 5') as ComparatorExpression;
        const notEquals = parse('r.price !== 5') as ComparatorExpression;

        expect(notEquals.negated).not.toBe(equals.negated);
    });

    it('parses optional chaining in a property path', () => {
        // `?.` is a two-character entry that must not be split into `?` and `.`.
        expect(parse('r?.price === 5')).not.toStrictEqual(Expression.NOT_PARSABLE);
    });
});

describe('string literal delimiters', () => {
    it('parses a double-quoted string', () => expectComparison('r.name === "x"', 'x'));
    it('parses a single-quoted string', () => expectComparison("r.name === 'x'", 'x'));
    it('parses a backtick string without interpolation', () => expectComparison('r.name === `x`', 'x'));

    it('keeps a quote of the other kind as content', () => {
        expectComparison(`r.name === "it's"`, "it's");
    });

    it('honours an escaped quote inside a string', () => {
        expectComparison('r.name === "a\\"b"', 'a"b');
    });

    it('honours an escaped backslash inside a string', () => {
        expectComparison('r.name === "a\\\\b"', 'a\\b');
    });

    it('honours an escaped newline inside a string', () => {
        expectComparison('r.name === "a\\nb"', 'a\nb');
    });

    it('treats comment markers inside a string as content', () => {
        expectComparison('r.name === "/* not a comment */"', '/* not a comment */');
    });

    it('treats operator characters inside a string as content', () => {
        expectComparison('r.name === "a === b && c"', 'a === b && c');
    });
});

describe('template literal interpolation', () => {
    it('rejects interpolation in a backtick string', () => {
        expectNotParsable('r.name === `x-${r.id}`');
    });

    it('accepts a lone dollar sign in a backtick string', () => {
        // The guard is `$` followed by `{`; a `$` alone is ordinary content. Mutating the
        // second half of that check would reject this.
        expectComparison('r.name === `costs $5`', 'costs $5');
    });

    it('accepts a lone brace in a backtick string', () => {
        expectComparison('r.name === `a{b`', 'a{b');
    });

    it('accepts ${ inside a double-quoted string', () => {
        // Interpolation only applies to backticks. A guard that ignores the quote kind
        // would reject this valid literal.
        expectComparison('r.name === "${notInterpolated}"', '${notInterpolated}');
    });

    it('accepts ${ inside a single-quoted string', () => {
        expectComparison("r.name === '${notInterpolated}'", '${notInterpolated}');
    });
});

describe('numeric literals', () => {
    it('parses an integer', () => expectComparison('r.price === 42', 42));
    it('parses a decimal', () => expectComparison('r.price === 4.25', 4.25));
    it('parses a leading-zero decimal', () => expectComparison('r.price === 0.5', 0.5));
    it('parses zero', () => expectComparison('r.price === 0', 0));
    it('parses a negative integer', () => expectComparison('r.price === -7', -7));
    it('parses a negative decimal', () => expectComparison('r.price === -7.5', -7.5));
});

describe('boolean and null literals', () => {
    it('parses true', () => expectComparison('r.active === true', true));
    it('parses false', () => expectComparison('r.active === false', false));
    it('parses null', () => expectComparison('r.name === null', null));
});
