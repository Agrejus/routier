import { EncryptionMode, SchemaModifiers } from "../../types";
import { SchemaBase } from "../base/SchemaBase";
import { SchemaDefault } from "./SchemaDefault";
import { SchemaFrom } from "./SchemaFrom";
import { SchemaIndex } from "./SchemaIndex";
import { SchemaNullable } from "./SchemaNullable";
import { SchemaOptional } from "./SchemaOptional";
import { SchemaReadonly } from "./SchemaReadonly";
import { SchemaTag } from "./SchemaTag";

/**
 * Marks a property as encrypted before it reaches the database.
 *
 * ```ts
 * email:  s.string().encrypted({ searchable: true }),
 * salary: s.number().encrypted(),
 * ```
 *
 * A modifier rather than a type, because encryption does not change what a value IS. An
 * encrypted number is still a number to the application; only what reaches storage differs.
 * That is the same reason `.index()` and `.distinct()` are modifiers — they describe how a
 * property is handled, not what it holds.
 *
 * Core stores the declaration and does nothing with it. The work belongs to a plugin:
 * `crypto.subtle` is asynchronous and a property serializer is not, and a key is a runtime
 * secret while a compiled schema is a static artifact shared across every store in the
 * process. `@routier/encryption-plugin` reads `PropertyInfo.encryption` and does the rest.
 *
 * ## `searchable` is the whole decision
 *
 * Without it, every write uses a fresh initialisation vector: the same value encrypts
 * differently each time, storage reveals nothing, and no filter on the property can run.
 *
 * With it, the vector is derived from the value, so the ciphertext is stable and an equality
 * filter still executes in the database against an index — at the cost of revealing which
 * rows hold the same value. Use it for a lookup key such as an email. Do not use it for a
 * diagnosis, a salary, or any low-cardinality column, where seeing which rows match is close
 * to reading them.
 */
export class SchemaEncrypted<T extends any, TModifiers extends SchemaModifiers> extends SchemaBase<T, TModifiers> {

    instance: T;
    private _schemaEncrypted = true;

    constructor(mode: EncryptionMode, current: SchemaBase<T, TModifiers>) {
        super(current);
        this.instance = current.instance;
        this.encryption = mode;
    }

    from(propertyName: string) {
        return new SchemaFrom<T, TModifiers>(propertyName, this);
    }

    optional() {
        return new SchemaOptional<T, TModifiers | "optional">(this);
    }

    nullable() {
        return new SchemaNullable<T, TModifiers | "nullable">(this);
    }

    readonly() {
        return new SchemaReadonly<T, TModifiers | "readonly">(this);
    }

    default<I = never>(value: T | ((injected: I) => T), injected?: I) {
        return new SchemaDefault<T, I, TModifiers | "default">(value as never, injected, this);
    }

    /**
     * An index on a randomised property is dead weight — every value is distinct — but on a
     * searchable one it is the entire point, because that is what an equality filter uses.
     */
    index(...indexName: string[]) {
        return new SchemaIndex<T, TModifiers>(this, ...indexName);
    }

    tag(...tags: string[]) {
        return new SchemaTag<T, TModifiers>(tags, this);
    }
}
