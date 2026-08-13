import { SchemaTypes, type PropertyTransform } from '@routier/core/schema';
import { decrypt, encrypt, isEnvelope } from './cipher';
import type { Keyring } from './keyring';
import { fromText, toText } from './codec';

export type EncryptionOptions = {
    /**
     * Keeps equality filters working, by deriving the initialisation vector from the value so
     * the ciphertext is stable.
     *
     * The cost is that rows holding the same value are visibly equal in storage. Use it for a
     * lookup key such as an email. Do not use it for a diagnosis, a salary, or any
     * low-cardinality column, where seeing which rows match is close to reading them.
     */
    searchable?: boolean;
};

/**
 * AES-GCM encryption as a transform you hand to a schema.
 *
 * ```ts
 * const cipher = encryption(keyring);
 *
 * const userSchema = s.define('users', {
 *     id:    s.string().key().identity(),
 *     email: s.string(),
 *     notes: s.string(),
 * }).modify(x => ({
 *     email: x.transform(encryption(keyring, { searchable: true })),
 *     notes: x.transform(cipher),
 * })).compile();
 * ```
 *
 * This package is not a plugin and installs nothing. It returns `{ to, from }` and the schema
 * carries it; your database plugin never learns that encryption happened. Nothing here is
 * privileged — a transform of your own with the same two functions works identically, and
 * that is the point.
 *
 * `stores` and `comparable` are set here rather than by the caller: a ciphertext is always
 * text, and only the deterministic mode can be compared. A schema that uses this says
 * `x.transform(cipher)` and nothing else.
 */
export const encryption = (keyring: Keyring, options: EncryptionOptions = {}): PropertyTransform<any> => {
    const deterministic = options.searchable === true;

    return {
        // A ciphertext is text, whatever the property was. Declaring it here is what lets a
        // plugin build a TEXT column for an encrypted number without knowing why.
        stores: SchemaTypes.String,

        // Only a stable ciphertext can be matched in the database. A randomised one cannot,
        // and saying so is what stops a filter silently returning nothing.
        comparable: deterministic ? 'equality' : 'none',

        async to(value: unknown) {
            if (value == null || isEnvelope(value)) {
                // Already encrypted: an entity read back and saved again must not be wrapped
                // twice, which would leave a value nothing can read without unwrapping layers.
                return value;
            }

            return encrypt(keyring, toText(value), { deterministic });
        },

        async from(value: unknown) {
            if (isEnvelope(value) === false) {
                // Written before encryption was switched on. Returning it as-is is what makes
                // a partial migration readable in both directions.
                return value;
            }

            return fromText(await decrypt(keyring, value));
        },
    };
};
