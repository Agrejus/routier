import { SchemaBase } from "../property/base/SchemaBase";
import { PropertyTransform, SchemaModifiers, SchemaTypes } from "../types";

/**
 * A two-way transform between the value your application holds and the value that is stored.
 *
 * Declared in `.modify()`, beside `computed` and `function`, because it belongs to the same
 * family: a property whose stored form is derived rather than assigned. `computed` derives one
 * way and cannot come back; a transform declares both directions.
 *
 * ```ts
 * const userSchema = s.define('users', {
 *     id: s.string().key().identity(),
 *     ssn: s.string(),
 * }).modify(x => ({
 *     ssn: x.transform(s.string(), {
 *         to:   (value, keys) => encryptSomehow(value, keys),
 *         from: (text,  keys) => decryptSomehow(text, keys),
 *     }, myKeys),
 * })).compile();
 * ```
 *
 * `to` and `from` may be async, and they are held as LIVE references — never stringified into
 * generated code the way `computed` is. So they can close over whatever they like, and the
 * `injected` argument is there for when you would rather pass it explicitly than capture it.
 *
 * Nothing about this is encryption. Encryption is one thing a caller might write here;
 * compression, redaction, unit conversion and a custom codec are others. The library ships no
 * behaviour of its own for this — it only carries what you supply.
 */
export class SchemaTransform<T extends any, I, TModifiers extends SchemaModifiers = never> extends SchemaBase<T, TModifiers> {

    instance: T;
    private _schemaTransform = true;

    constructor(underlying: SchemaBase<T, TModifiers>, transform: PropertyTransform<T, I>, injected?: I) {
        super(underlying);

        // The underlying property keeps its type, its key/identity flags and its modifiers.
        // A transform changes how a value is STORED, never what it is: an encrypted number is
        // still a number to the application, so `InferType` must not shift.
        this.instance = underlying.instance;
        this.type = underlying.type;
        this.injected = injected;
        this.transform = transform as PropertyTransform<unknown, unknown>;
    }
}

/** The declared storage type of a transformed property, when it differs from its own. */
export const transformStorageType = (transform: PropertyTransform<any, any>): SchemaTypes | null =>
    transform.stores ?? null;
