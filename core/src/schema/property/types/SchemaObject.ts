import { DefaultValue, SchemaModifiers, SchemaTypes } from "../../types";
import { SchemaBase } from "../base/SchemaBase";
import { SchemaDefault } from "../modifiers/SchemaDefault";
import { SchemaIdentity } from "../modifiers/SchemaIdentity";
import { SchemaNullable } from "../modifiers/SchemaNullable";
import { SchemaOptional } from "../modifiers/SchemaOptional";
import { SchemaArray } from "./SchemaArray";

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