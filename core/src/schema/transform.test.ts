import { describe, expect, it } from '@jest/globals';
import { s } from './index';
import { SchemaTypes } from './types';
import type { InferCreateType, InferType } from './types';

/**
 * A transform declared in `.modify()`, beside `computed` and `function`.
 *
 * The library ships no transform of its own. Encryption is one thing a caller might write
 * here; compression, redaction and a custom codec are others. All core does is carry what you
 * supply and hand it to the layer that runs it.
 */

/**
 * A caller's own cipher, deliberately trivial to make the point that it is theirs.
 *
 * Note what the CALLER writes at the schema: `x.transform(cipher)`. The `stores` and
 * `comparable` settings live in the cipher, written once by whoever provides it.
 */
const makeCipher = (salt: string) => ({
    to: (value: string) => `${salt}:${[...value].reverse().join('')}`,
    from: (stored: unknown) => [...String(stored).slice(salt.length + 1)].reverse().join(''),
    stores: SchemaTypes.String,
    comparable: 'equality' as const,
});

const cipher = makeCipher('my-salt');

const userSchema = s.define('users', {
    id: s.string().key().identity(),
    name: s.string(),
    ssn: s.string(),
}).modify(x => ({
    ssn: x.transform(cipher),
})).compile();

describe('a transform declared in modify()', () => {

    it('is carried on the property as a live reference', () => {
        const property = userSchema.properties.find(p => p.name === 'ssn');

        expect(property?.transform).not.toBeNull();
        expect(typeof property?.transform?.to).toBe('function');
        expect(typeof property?.transform?.from).toBe('function');
    });

    it('is not stringified, so it can close over a caller value', () => {
        // The distinction from `computed`, which is `toString()`d into generated code and
        // therefore cannot capture anything. A live reference round-trips through a closure.
        const captured = 'captured-by-closure';
        const schema = s.define('closures', {
            id: s.string().key().identity(),
            value: s.string(),
        }).modify(x => ({
            value: x.transform({
                to: (v: string) => `${captured}|${v}`,
                from: (stored: unknown) => String(stored).split('|')[1],
            }),
        })).compile();

        const transform = schema.properties.find(p => p.name === 'value')!.transform!;

        expect(transform.to('secret', {})).toBe('captured-by-closure|secret');
    });

    it('keeps the underlying property intact', () => {
        // A transform replaces a property with a transformed version of ITSELF, so the type,
        // the key flags and every modifier survive.
        const property = userSchema.properties.find(p => p.name === 'ssn');

        expect(property?.type).toBe(SchemaTypes.String);
    });

    it('round-trips through the caller functions', async () => {
        const property = userSchema.properties.find(p => p.name === 'ssn')!;
        const stored = await property.transform!.to('123-45-6789', {});

        expect(stored).toBe('my-salt:9876-54-321');
        expect(await property.transform!.from!(stored)).toBe('123-45-6789');
    });

    it('declares what the column becomes', () => {
        const property = userSchema.properties.find(p => p.name === 'ssn');

        expect(property?.transform?.stores).toBe(SchemaTypes.String);
        expect(property?.transform?.comparable).toBe('equality');
    });

    it('supports an async transform, which computed cannot', async () => {
        const schema = s.define('async', {
            id: s.string().key().identity(),
            value: s.string(),
        }).modify(x => ({
            value: x.transform({
                to: async (v: string) => `async:${v}`,
                from: async (stored: unknown) => String(stored).slice(6),
            }),
        })).compile();

        const transform = schema.properties.find(p => p.name === 'value')!.transform!;

        expect(await transform.to('x', {})).toBe('async:x');
    });

    it('leaves the entity type alone', () => {
        // A transform changes how a value is STORED, never what it is.
        const check = (entity: InferType<typeof userSchema>, draft: InferCreateType<typeof userSchema>) => {
            const ssn: string = entity.ssn;
            const name: string = entity.name;
            const written: string = draft.ssn;

            return [ssn, name, written];
        };

        expect(typeof check).toBe('function');
    });

    it('leaves untransformed properties untouched', () => {
        expect(userSchema.properties.find(p => p.name === 'name')?.transform).toBeNull();
    });
});
