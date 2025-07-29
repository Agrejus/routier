import { DefaultValue, SchemaModifiers, SchemaTypes } from "../../types";
import { SchemaBase } from "../base/Base";
import { SchemaDefault } from "../modifiers/Default";
import { SchemaIdentity } from "../modifiers/Identity";
import { SchemaNullable } from "../modifiers/Nullable";
import { SchemaOptional } from "../modifiers/Optional";
import { SchemaArray } from "./Array";

export class SchemaObject<T extends {}, TModifiers extends SchemaModifiers> extends SchemaBase<T, TModifiers> {

    instance: T;
    type = SchemaTypes.Object;
    private _schemaObject = true;

    constructor(schema: T) {
        super();
        this.instance = schema;
    }

    optional() {
        return new SchemaOptional<T, TModifiers | "optional">(this);
    }

    nullable() {
        return new SchemaNullable<T, TModifiers | "nullable">(this);
    }

    default<I = never>(value: DefaultValue<T, I>, injected?: I) {
        return new SchemaDefault<T, I, TModifiers | "default">(value, injected, this);
    }

    identity() {
        return new SchemaIdentity<T, TModifiers | "identity">(this);
    }

    array() {
        return new SchemaArray<typeof this, TModifiers>(this as any);
    }
}