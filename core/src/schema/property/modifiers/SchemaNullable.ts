import { DefaultValue, PropertyDeserializer, SchemaModifiers } from "../../types";
import { SchemaBase } from "../base/SchemaBase";
import { SchemaDefault } from "./SchemaDefault";
import { SchemaDeserialize } from "./SchemaDeserialize";
import { SchemaOptional } from "./SchemaOptional";

export class SchemaNullable<T extends any, TModifiers extends SchemaModifiers> extends SchemaBase<T, TModifiers> {
    instance: T;
    private _schemaNullable = true;

    constructor(current: SchemaBase<T, TModifiers>) {
        super(current);
        this.instance = current.instance;
        this.isNullable = true;
    }

    optional() {
        return new SchemaOptional<T, TModifiers | "optional">(this);
    }

    default<I = never>(value: DefaultValue<T | null, I>, injected?: I) {
        return new SchemaDefault<T | null, I, TModifiers | "default">(value, injected, this);
    }

    deserialize(deserializer: PropertyDeserializer<T | null>) {
        return new SchemaDeserialize<T | null, TModifiers | "deserialize">(deserializer, this);
    }
}