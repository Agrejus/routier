import type { EncryptionMode, PropertyInfo } from '@routier/core/schema';

/**
 * How a property is encrypted, or `null` when it is not.
 *
 * Read straight off `PropertyInfo`, which core populates from `.encrypted()`. It used to be
 * derived from a string tag; a first-class field means a plugin reads a value rather than
 * parsing a convention, and it means core itself can tell that a schema needs an encryption
 * plugin at all.
 */
export const encryptionMode = (property: PropertyInfo<any>): EncryptionMode | null =>
    property.encryption;

export type { EncryptionMode };
