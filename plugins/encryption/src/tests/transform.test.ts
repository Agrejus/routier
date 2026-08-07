import { describe, expect, it } from '@jest/globals';
import { s, SchemaTypes } from '@routier/core/schema';
import { createKeyring, encryption, isEnvelope } from '../index';

/**
 * Encryption as a transform, with no plugin anywhere.
 *
 * What a schema says is `x.transform(cipher)`. Everything else — that a ciphertext is text,
 * that only the deterministic mode can be compared — is declared by the cipher, once, by
 * whoever wrote it. Nothing in this package is privileged: a transform of your own with the
 * same two functions works identically.
 *
 * These test the transform itself. Applying one during a save is the datastore's job and is
 * not built yet.
 */

const secret = () => crypto.getRandomValues(new Uint8Array(32));
const keyring = () => createKeyring({ activeKeyId: 'k1', keys: { k1: secret() } });

describe('encryption as a transform', () => {

    it('is what a schema carries', async () => {
        const cipher = encryption(await keyring());

        const schema = s.define('users', {
            id: s.string().key().identity(),
            ssn: s.string(),
        }).modify(x => ({
            ssn: x.transform(cipher),
        })).compile();

        const property = schema.properties.find(p => p.name === 'ssn');

        expect(property?.transform).toBe(cipher);
        expect(property?.type).toBe(SchemaTypes.String);
    });

    it('declares that it stores text and cannot be compared', async () => {
        const cipher = encryption(await keyring());

        expect(cipher.stores).toBe(SchemaTypes.String);
        expect(cipher.comparable).toBe('none');
    });

    it('declares that it can be compared when searchable', async () => {
        const cipher = encryption(await keyring(), { searchable: true });

        expect(cipher.comparable).toBe('equality');
    });

    it('round-trips a string', async () => {
        const cipher = encryption(await keyring());
        const stored = await cipher.to('123-45-6789', {});

        expect(isEnvelope(stored)).toBe(true);
        expect(String(stored)).not.toContain('123-45-6789');
        expect(await cipher.from!(stored)).toBe('123-45-6789');
    });

    it('round-trips a number, a boolean and an object as themselves', async () => {
        const cipher = encryption(await keyring());

        for (const value of [125000.5, 0, true, false, { city: 'London', score: 9.5 }]) {
            const stored = await cipher.to(value, {});

            expect(isEnvelope(stored)).toBe(true);
            expect(await cipher.from!(stored)).toEqual(value);
        }
    });

    it('gives the same value the same ciphertext only when searchable', async () => {
        const shared = await keyring();
        const randomised = encryption(shared);
        const searchable = encryption(shared, { searchable: true });

        expect(await randomised.to('same', {})).not.toBe(await randomised.to('same', {}));
        expect(await searchable.to('same', {})).toBe(await searchable.to('same', {}));
    });

    it('does not encrypt an already-encrypted value twice', async () => {
        const cipher = encryption(await keyring());
        const once = await cipher.to('secret', {});

        expect(await cipher.to(once, {})).toBe(once);
    });

    it('passes through a value written before encryption was switched on', async () => {
        // What makes a partial migration readable in both directions.
        const cipher = encryption(await keyring());

        expect(await cipher.from!('plain text from before')).toBe('plain text from before');
    });

    it('leaves null alone', async () => {
        const cipher = encryption(await keyring());

        expect(await cipher.to(null, {})).toBeNull();
    });

    it('works with a transform that is not ours at all', async () => {
        // The point of the design: nothing about this package is special.
        const rot13 = {
            to: (v: string) => v.replace(/[a-z]/g, c => String.fromCharCode((c.charCodeAt(0) - 84) % 26 + 97)),
            from: (v: unknown) => String(v).replace(/[a-z]/g, c => String.fromCharCode((c.charCodeAt(0) - 84) % 26 + 97)),
        };

        const schema = s.define('rot', {
            id: s.string().key().identity(),
            value: s.string(),
        }).modify(x => ({ value: x.transform(rot13) })).compile();

        const transform = schema.properties.find(p => p.name === 'value')!.transform!;

        expect(transform.to('hello', {})).toBe('uryyb');
        expect(transform.from!('uryyb')).toBe('hello');
    });
});
