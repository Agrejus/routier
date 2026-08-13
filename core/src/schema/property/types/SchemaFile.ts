import { DefaultValue, SchemaModifiers, SchemaTypes } from "../../types";
import { SchemaBase } from "../base/SchemaBase";
import { SchemaDefault } from "../modifiers/SchemaDefault";
import { SchemaFrom } from "../modifiers/SchemaFrom";
import { SchemaNullable } from "../modifiers/SchemaNullable";
import { SchemaOptional } from "../modifiers/SchemaOptional";
import { SchemaReadonly } from "../modifiers/SchemaReadonly";
import { SchemaTag } from "../modifiers/SchemaTag";

/**
 * A file: content on the way in, a reference on the way out.
 *
 * This is the one property type whose write shape differs from its stored shape. You assign
 * a `File`, a `Blob`, a `Uint8Array` or a string; what is stored, and what a query gives
 * back, is a reference — where the bytes live and what they are.
 *
 * ```ts
 * const documentSchema = s.define('documents', {
 *     id: s.string().key().identity(),
 *     title: s.string(),
 *     file: s.file(),
 * }).compile();
 *
 * await store.documents.addAsync({ title: 'Q3', file: fileFromInput });
 * await store.saveChangesAsync();
 *
 * doc.file.size          // 2_400_112
 * doc.file.contentType   // 'application/pdf'
 * ```
 *
 * ## Why this cannot be `s.object({ key, size, ... })`
 *
 * The generated `preprocess` rebuilds an object property field by field from its declared
 * children — `result.file = {}` and then one assignment per child. Content assigned there is
 * therefore discarded by construction, before any plugin sees the entity: the property does
 * not arrive mangled, it does not arrive at all.
 *
 * A file is a LEAF here, with no child properties, so the generated code passes it through
 * untouched. The bytes survive as far as the plugin, which is the only place an upload can
 * happen — `preprocess` is synchronous and is called from the change tracker and the
 * broadcast path, so it cannot await one.
 *
 * ## What actually stores it
 *
 * Nothing in core uploads anything. `@routier/blob-plugin` wraps your real plugin, swaps
 * pending content for a reference during `bulkPersist`, and hands the reference down. Without
 * that wrapper a file property stores whatever you assigned, which is a mistake this type
 * cannot detect on its own.
 */
export class SchemaFile<T extends any, TModifiers extends SchemaModifiers> extends SchemaBase<T, TModifiers> {

    instance: T;
    type = SchemaTypes.File;
    private _schemaFile = true;

    constructor() {
        super();
        this.instance = null as T;
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

    default<I = never>(value: DefaultValue<T, I>, injected?: I) {
        return new SchemaDefault<T, I, TModifiers | "default">(value, injected, this);
    }

    tag(...tags: string[]) {
        return new SchemaTag<T, TModifiers>(tags, this);
    }
}
