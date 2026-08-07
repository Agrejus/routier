import { describe, expect, it } from '@jest/globals';
import { createKeyring } from '../keyring';
import { decrypt, encrypt, isEnvelope } from '../cipher';

const secret = () => crypto.getRandomValues(new Uint8Array(32));

describe('the cipher', () => {
    it('is stable in deterministic mode', async () => {
        const keyring = await createKeyring({ activeKeyId: 'k', keys: { k: secret() } });

        const a = await encrypt(keyring, 'grace@example.com', { deterministic: true });
        const b = await encrypt(keyring, 'grace@example.com', { deterministic: true });

        expect(a).toBe(b);
    });

    it('varies in randomised mode', async () => {
        const keyring = await createKeyring({ activeKeyId: 'k', keys: { k: secret() } });

        const a = await encrypt(keyring, 'same', { deterministic: false });
        const b = await encrypt(keyring, 'same', { deterministic: false });

        expect(a).not.toBe(b);
    });

    it('round-trips both modes', async () => {
        const keyring = await createKeyring({ activeKeyId: 'k', keys: { k: secret() } });

        for (const deterministic of [true, false]) {
            const envelope = await encrypt(keyring, 'value ünïcode 😀', { deterministic });
            expect(isEnvelope(envelope)).toBe(true);
            expect(await decrypt(keyring, envelope)).toBe('value ünïcode 😀');
        }
    });

    it('gives different values different ciphertexts, deterministically', async () => {
        const keyring = await createKeyring({ activeKeyId: 'k', keys: { k: secret() } });

        const a = await encrypt(keyring, 'one', { deterministic: true });
        const b = await encrypt(keyring, 'two', { deterministic: true });

        expect(a).not.toBe(b);
    });
});
