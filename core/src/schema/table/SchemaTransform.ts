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
 * const cipher = myEncryption(keyring);   // whatever you use — {} with `to` and `from`
 *
 * const userSchema = s.define('users', {
 *     id: s.string().key().identity(),
 *     ssn: s.string(),
 * }).modify(x => ({
 *     ssn: x.transform(cipher),
 * })).compile();
 * ```
 *
 * `to` and `from` may be async, and they are held as LIVE references — never stringified into
 * generated code the way `computed` is. So they close over whatever they need, which is why
 * there is no `injected` argument to pass and no property to repeat.
 *
 * Nothing about this is encryption. Encryption is one thing a caller might write here;
 * compression, redaction, unit conversion and a custom codec are others. The library ships no
 * behaviour of its own for this — it only carries what you supply.
 */
export class SchemaTransform<T extends any, TModifiers extends SchemaModifiers = never> extends SchemaBase<T, TModifiers> {

    instance: T;
    private _schemaTransform = true;

    /**
     * Bound to the property it replaces when the schema is assembled.
     *
     * You do not pass the property in. `.modify()` already knows which one you mean — it is
     * the key you assigned to — so repeating `s.string()` would be ceremony for nothing.
     */
    bindTo(underlying: SchemaBase<T, TModifiers>) {
        // The underlying property keeps its type, its key and identity flags, and its
        // modifiers. A transform changes how a value is STORED, never what it is: an
        // encrypted number is still a number, so `InferType` must not shift.
        Object.assign(this, underlying, { transform: this.transform, _schemaTransform: true });

        this.instance = underlying.instance;
        this.type = underlying.type;

        return this;
    }

    constructor(transform: PropertyTransform<T>) {
        super();
        this.instance = null as T;
        this.transform = transform as PropertyTransform<unknown>;
    }
}


