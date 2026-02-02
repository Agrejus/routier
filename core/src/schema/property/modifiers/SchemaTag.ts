import { DefaultValue, PropertyDeserializer, PropertySerializer, SchemaModifiers } from "../../types";
import { SchemaBase } from "../base/SchemaBase";
import { SchemaArray } from "../types";
import { SchemaDefault } from "./SchemaDefault";
import { SchemaDeserialize } from "./SchemaDeserialize";
import { SchemaDistinct } from "./SchemaDistinct";
import { SchemaFrom } from "./SchemaFrom";
import { SchemaIndex } from "./SchemaIndex";
import { SchemaNullable } from "./SchemaNullable";
import { SchemaOptional } from "./SchemaOptional";
import { SchemaReadonly } from "./SchemaReadonly";
import { SchemaSerialize } from "./SchemaSerialize";

export class SchemaTag<T extends any, TModifiers extends SchemaModifiers> extends SchemaBase<T, TModifiers> {
    instance: T;
    private _schemaTag = true;

    constructor(tags: string[], current: SchemaBase<T, TModifiers>) {
        super(current);
        this.tags = tags;
        this.instance = current.instance;
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

    default<I = never>(value: DefaultValue<T, I>, injected?: I) {
        return new SchemaDefault<T, I, TModifiers | "default">(value, injected, this);
    }

    readonly() {
        return new SchemaReadonly<T, TModifiers | "readonly">(this);
    }

    deserialize(deserializer: PropertyDeserializer<T>) {
        return new SchemaDeserialize<T, TModifiers | "deserialize">(deserializer, this);
    }

    serialize(serializer: PropertySerializer<T>) {
        return new SchemaSerialize<T, TModifiers | "serialize">(serializer, this);
    }

    array() {
        return new SchemaArray<typeof this, TModifiers>(this as unknown as SchemaArray<typeof this, TModifiers>);
    }

    index(...indexes: string[]) {
        return new SchemaIndex<T, TModifiers>(this, ...indexes);
    }

    distinct() {
        return new SchemaDistinct<T, TModifiers | "distinct">(this);
    }
}