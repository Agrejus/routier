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

/** A caller's own "encryption" — deliberately trivial, to make the point that it is theirs. */
const reversibleCipher = {
    to: (value: string, salt: string) => `${salt}:${[...value].reverse().join('')}`,
    from: (stored: unknown, salt: string) => [...String(stored).slice(salt.length + 1)].reverse().join(''),
    stores: SchemaTypes.String,
    comparable: 'equality' as const,
};

const userSchema = s.define('users', {
    id: s.string().key().identity(),
    name: s.string(),
    ssn: s.string(),
}).modify(x => ({
    ssn: x.transform(s.string(), reversibleCipher, 'my-salt'),
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
            value: x.transform(s.string(), {
                to: (v: string) => `${captured}|${v}`,
                from: (stored: unknown) => String(stored).split('|')[1],
            }),
        })).compile();

        const transform = schema.properties.find(p => p.name === 'value')!.transform!;

        expect(transform.to('secret', undefined as never)).toBe('captured-by-closure|secret');
    });

    it('carries the injected value the caller supplied', () => {
        const property = userSchema.properties.find(p => p.name === 'ssn');

        expect(property?.injected).toBe('my-salt');
    });

    it('round-trips through the caller functions', async () => {
        const property = userSchema.properties.find(p => p.name === 'ssn')!;
        const stored = await property.transform!.to('123-45-6789', property.injected);

        expect(stored).toBe('my-salt:9876-54-321');
        expect(await property.transform!.from(stored, property.injected)).toBe('123-45-6789');
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
            value: x.transform(s.string(), {
                to: async (v: string) => `async:${v}`,
                from: async (stored: unknown) => String(stored).slice(6),
            }),
        })).compile();

        const transform = schema.properties.find(p => p.name === 'value')!.transform!;

        expect(await transform.to('x', undefined as never)).toBe('async:x');
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
