import type { Keyring } from './keyring';

/**
 * Encrypting one value, and the envelope it becomes.
 *
 * A stored value looks like this, and the shape is deliberate:
 *
 * ```
 * renc1.k2.qX7f…iv….  yTn2…ciphertext…
 * │     │  │            └── AES-GCM output, including its authentication tag
 * │     │  └── the initialisation vector
 * │     └── which key produced this, so rotation is possible
 * └── format version, so this can change without guessing
 * ```
 *
 * The prefix matters as much as the payload. Without it there is no way to tell an encrypted
 * value from a plaintext one that happens to be base64, which makes a partial migration
 * unreadable in both directions.
 */

const PREFIX = 'renc1';
const SEPARATOR = '.';
const IV_BYTES = 12;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** base64url, so an envelope is safe in a URL, a filename, and a JSON string alike. */
const toBase64Url = (bytes: Uint8Array) => {
    let binary = '';

    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }

    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (value: string) => {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, '='));
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }

    return bytes;
};

/** Whether a stored value is one of ours. Cheap, and checked before anything is decrypted. */
export const isEnvelope = (value: unknown): value is string =>
    typeof value === 'string' && value.startsWith(`${PREFIX}${SEPARATOR}`);

/**
 * The IV for a value.
 *
 * Randomised is the default and the safe one: a fresh IV per write, so the same plaintext
 * encrypts differently every time and the ciphertext reveals nothing, not even which rows
 * share a value.
 *
 * Deterministic derives the IV from the plaintext instead, with an HMAC under a key derived
 * separately from the cipher key. The same plaintext then always produces the same ciphertext,
 * which is what lets an equality filter run in the database — and which necessarily reveals
 * that two rows hold the same value. That is the whole trade, and it is opt-in per property
 * for exactly that reason.
 */
const initialisationVector = async (
    plaintext: Uint8Array,
    key: { synthetic: CryptoKey },
    deterministic: boolean
): Promise<Uint8Array> => {
    if (deterministic === false) {
        return crypto.getRandomValues(new Uint8Array(IV_BYTES));
    }

    const mac = await crypto.subtle.sign('HMAC', key.synthetic, plaintext as unknown as BufferSource);

    return new Uint8Array(mac).slice(0, IV_BYTES);
};

/** Encrypts one string into an envelope. */
export const encrypt = async (
    keyring: Keyring,
    value: string,
    options: { deterministic: boolean }
): Promise<string> => {
    const key = await keyring.active();
    const plaintext = encoder.encode(value);
    const iv = await initialisationVector(plaintext, key, options.deterministic);

    const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv as unknown as BufferSource },
        key.cipher,
        plaintext as unknown as BufferSource
    );

    return [PREFIX, key.id, toBase64Url(iv), toBase64Url(new Uint8Array(ciphertext))].join(SEPARATOR);
};

/** Reads an envelope back, using whichever key wrote it. */
export const decrypt = async (keyring: Keyring, envelope: string): Promise<string> => {
    const parts = envelope.split(SEPARATOR);

    if (parts.length !== 4 || parts[0] !== PREFIX) {
        throw new Error(
            'Malformed encrypted value. Expected `renc1.<keyId>.<iv>.<ciphertext>`, got ' +
            `'${envelope.slice(0, 24)}…'.`
        );
    }

    const [, keyId, iv, ciphertext] = parts;
    const key = await keyring.get(keyId);

    let plaintext: ArrayBuffer;

    try {
        plaintext = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: fromBase64Url(iv) as unknown as BufferSource },
            key.cipher,
            fromBase64Url(ciphertext) as unknown as BufferSource
        );
    } catch {
        // AES-GCM authenticates as well as encrypts, so a failure here means the value was
        // altered or the key is wrong. Both are worth saying out loud rather than returning
        // something that looks like data.
        throw new Error(
            `Could not decrypt a value written with key '${keyId}'. Either the stored value ` +
            'was modified, or the key material behind that id is not the one that wrote it.'
        );
    }

    return decoder.decode(plaintext);
};
