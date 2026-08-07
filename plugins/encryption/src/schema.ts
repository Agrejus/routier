import type { PropertyInfo } from '@routier/core/schema';

/**
 * Marks a property as encrypted.
 *
 * ```ts
 * const userSchema = s.define('users', {
 *     id: s.string().key().identity(),
 *     email: encrypted(s.string(), { searchable: true }),
 *     notes: encrypted(s.string()),
 * }).compile();
 * ```
 *
 * The entity type does not change: an encrypted string is still a `string` to your
 * application. Only what reaches the database changes, and that is the wrapper's job rather
 * than the schema's — `crypto.subtle` is asynchronous and a property serializer is not, so
 * this cannot be a `.serialize()` and has to be a plugin that runs during `bulkPersist`.
 *
 * ## `searchable` is the whole decision
 *
 * Without it, a value is encrypted with a fresh IV each time. The same email written twice
 * produces two unrelated ciphertexts, the database learns nothing at all, and **no filter on
 * that property can run** — the plugin rejects one rather than returning wrong rows.
 *
 * With it, the IV is derived from the value, so the ciphertext is stable and an equality
 * filter still executes in the database against an index. The cost is unavoidable and is the
 * reason this is opt-in: anyone holding the stored data can see which rows share a value,
 * and for a low-cardinality column — a status, a country, a boolean-ish flag — that is close
 * to reading it.
 *
 * Use it for a lookup key such as an email. Do not use it for a diagnosis, a salary, or
 * anything whose frequency is itself the secret.
 */
export const encrypted = <T extends { tag(...tags: string[]): unknown }>(
    property: T,
    options: { searchable?: boolean } = {}
) => property.tag(
    options.searchable === true ? SEARCHABLE_TAG : ENCRYPTED_TAG
) as ReturnType<T['tag']>;

/** Randomised: nothing leaks, nothing is queryable. */
export const ENCRYPTED_TAG = 'routier:encrypted';

/** Deterministic: equality filters work, equal values are visibly equal. */
export const SEARCHABLE_TAG = 'routier:encrypted:searchable';

/** How a property is encrypted, or `null` when it is not. */
export type EncryptionMode = 'randomised' | 'deterministic';

export const encryptionMode = (property: PropertyInfo<any>): EncryptionMode | null => {
    if (property.tags.includes(SEARCHABLE_TAG)) {
        return 'deterministic';
    }

    return property.tags.includes(ENCRYPTED_TAG) ? 'randomised' : null;
};
