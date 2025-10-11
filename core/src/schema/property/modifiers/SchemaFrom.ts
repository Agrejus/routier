import { DefaultValue, PropertyDeserializer, PropertySerializer, SchemaModifiers } from "../../types";
import { SchemaBase } from "../base/SchemaBase";
import { SchemaDefault } from "./SchemaDefault";
import { SchemaDeserialize } from "./SchemaDeserialize";
import { SchemaDistinct } from "./SchemaDistinct";
import { SchemaIdentity } from "./SchemaIdentity";
import { SchemaNullable } from "./SchemaNullable";
import { SchemaOptional } from "./SchemaOptional";
import { SchemaReadonly } from "./SchemaReadonly";
import { SchemaSerialize } from "./SchemaSerialize";

export class SchemaFrom<T extends any, TModifiers extends SchemaModifiers> extends SchemaBase<T, TModifiers> {
    instance: T;
    private _schemaFrom = true;

    constructor(propertyName: string, current: SchemaBase<T, TModifiers>) {
        super(current);
        this.instance = current.instance;
        this.fromPropertyName = propertyName;
    }

    default<I = never>(value: DefaultValue<T, I>, injected?: I) {
        return new SchemaDefault<T, I, TModifiers | "default">(value, injected, this);
    }

    deserialize(deserializer: PropertyDeserializer<T>) {
        return new SchemaDeserialize<T, TModifiers | "deserialize">(deserializer, this);
    }

    distinct() {
        return new SchemaDistinct<T, TModifiers | "distinct">(this);
    }

    identity() {
        return new SchemaIdentity<T, TModifiers | "identity" | "readonly">(this);
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

    serialize(serializer: PropertySerializer<T>) {
        return new SchemaSerialize<T, TModifiers | "serialize">(serializer, this);
    }
}