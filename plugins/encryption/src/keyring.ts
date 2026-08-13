/**
 * Keys, and the ability to rotate them.
 *
 * Every encrypted value records the id of the key that produced it, so a rotation adds a key
 * rather than replacing one: new writes use the active key, old rows stay readable, and a
 * re-encryption pass can run whenever you choose. A design with a single key cannot do that —
 * changing it makes every existing row unreadable at the instant of the swap.
 *
 * ```ts
 * const keyring = await createKeyring({
 *     activeKeyId: 'k2',
 *     keys: { k1: oldSecret, k2: newSecret },
 * });
 * ```
 *
 * `crypto.subtle` is standard in Node 18+ and in browsers, so there is one implementation
 * rather than a Node branch and a web branch that can disagree about what a ciphertext is.
 */

/** Raw key material. 32 bytes of real entropy — not a password, not a passphrase. */
export type KeySecret = Uint8Array;

export type KeyringOptions = {
    /** The key new writes use. Must be present in `keys`. */
    activeKeyId: string;

    /**
     * Every key that might have produced a stored value, by id.
     *
     * Keep a retired key here until nothing references it. Removing it early does not fail a
     * write; it fails a READ, later, on whichever rows still carry that id.
     */
    keys: Record<string, KeySecret>;
};

/** The two keys derived from one secret, plus the id they belong to. */
type DerivedKey = {
    id: string;
    /** AES-GCM, for the value itself. */
    cipher: CryptoKey;
    /**
     * HMAC-SHA256, used only to derive a synthetic IV for deterministic encryption.
     *
     * Separate from the cipher key on purpose. Using one key for two algorithms is how
     * constructions become unsound in ways nobody notices until someone looks properly.
     */
    synthetic: CryptoKey;
};

export type Keyring = {
    /** The key new writes use. */
    active(): Promise<DerivedKey>;
    /** A key by id, for reading a value written earlier. */
    get(keyId: string): Promise<DerivedKey>;
    /** Every id the keyring can read, for a re-encryption pass to reason about. */
    readonly keyIds: string[];
    /** The id new writes use. */
    readonly activeKeyId: string;
};

/** Key ids appear verbatim in the stored envelope, so they may not contain its delimiter. */
const KEY_ID = /^[A-Za-z0-9_-]{1,64}$/;

const MINIMUM_SECRET_BYTES = 32;

/**
 * Derives the two working keys from one secret with HKDF.
 *
 * The secret is never used directly. Deriving with distinct `info` strings means the cipher
 * key and the synthetic-IV key are independent even though they come from one input.
 */
const derive = async (id: string, secret: KeySecret): Promise<DerivedKey> => {
    if (secret.byteLength < MINIMUM_SECRET_BYTES) {
        throw new Error(
            `Key '${id}' is ${secret.byteLength} bytes. Encryption keys must be at least ` +
            `${MINIMUM_SECRET_BYTES} bytes of real entropy — use crypto.getRandomValues, not a ` +
            'password. If you need a key from a password, run it through a KDF first.'
        );
    }

    const material = await crypto.subtle.importKey('raw', copyOf(secret), 'HKDF', false, ['deriveKey']);

    const hkdf = (info: string, algorithm: AlgorithmIdentifier | HmacKeyGenParams, usages: KeyUsage[]) =>
        crypto.subtle.deriveKey(
            {
                name: 'HKDF',
                hash: 'SHA-256',
                // No salt: the secret is already a uniformly random key rather than a
                // password, which is the case HKDF-Expand alone is meant for. The `info`
                // string is what separates the two derived keys.
                salt: new Uint8Array(0),
                info: new TextEncoder().encode(`routier-encryption:${info}`),
            },
            material,
            algorithm,
            false,
            usages
        );

    const [cipher, synthetic] = await Promise.all([
        hkdf('cipher', { name: 'AES-GCM', length: 256 } as unknown as AlgorithmIdentifier, ['encrypt', 'decrypt']),
        hkdf('synthetic-iv', { name: 'HMAC', hash: 'SHA-256' }, ['sign']),
    ]);

    return { id, cipher, synthetic };
};

/** A copy, so a caller who zeroes or reuses their buffer cannot change a derived key. */
const copyOf = (bytes: Uint8Array) => {
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);

    return copy;
};

export const createKeyring = async (options: KeyringOptions): Promise<Keyring> => {
    const ids = Object.keys(options.keys);

    if (ids.length === 0) {
        throw new Error('A keyring needs at least one key.');
    }

    for (const id of ids) {
        if (KEY_ID.test(id) === false) {
            throw new Error(
                `'${id}' is not a usable key id. Ids are stored verbatim in every encrypted ` +
                'value, so they must match /^[A-Za-z0-9_-]{1,64}$/.'
            );
        }
    }

    if (options.keys[options.activeKeyId] == null) {
        throw new Error(
            `activeKeyId '${options.activeKeyId}' is not in the keyring. Available: ` +
            `${ids.join(', ')}.`
        );
    }

    // Derived once. HKDF on every value would be a per-row cost for a result that never
    // changes.
    const derived = new Map<string, DerivedKey>(
        await Promise.all(ids.map(async id => [id, await derive(id, options.keys[id])] as const))
    );

    return {
        keyIds: ids,
        activeKeyId: options.activeKeyId,

        async active() {
            return derived.get(options.activeKeyId)!;
        },

        async get(keyId: string) {
            const key = derived.get(keyId);

            if (key == null) {
                throw new Error(
                    `No key '${keyId}' in the keyring, so a value written with it cannot be ` +
                    `read. Available: ${ids.join(', ')}. A retired key must stay in the ` +
                    'keyring until nothing references it.'
                );
            }

            return key;
        },
    };
};
