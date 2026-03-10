import { SchemaBase } from "../base/SchemaBase";
import { SchemaIdentity } from "./SchemaIdentity";
import { SchemaDefault } from "./SchemaDefault";
import { CompiledSchema, DefaultValue, InferType, SchemaModifiers } from "../../types";
import { SchemaFrom } from "./SchemaFrom";
import { SchemaTag } from "./SchemaTag";

export class SchemaForeignKey<T extends any, TModifiers extends SchemaModifiers, K extends {}> extends SchemaBase<T, TModifiers> {
    instance: T;
    private _schemaForeignKey = true;

    constructor(current: SchemaBase<T, TModifiers>, relatingSchema: CompiledSchema<K>, property: keyof InferType<CompiledSchema<K>>) {
        super(current);
        this.instance = current.instance;
        this.foreignKeyDefinition = {
            schema: relatingSchema,
            property: relatingSchema.getProperty(String(property))
        };
    }

    identity() {
        return new SchemaIdentity<T, TModifiers | "identity">(this);
    }

    default<I = never>(value: DefaultValue<T, I>, injected?: I) {
        return new SchemaDefault<T, I, TModifiers | "default">(value, injected, this);
    }

    from(propertyName: string) {
        return new SchemaFrom<T, TModifiers>(propertyName, this);
    }

    tag(...tags: string[]) {
        return new SchemaTag<T, TModifiers>(tags, this);
    }
}