import { DefaultValue, PropertyDeserializer, PropertySerializer, SchemaModifiers } from "../../types";
import { SchemaBase } from "../base/SchemaBase";
import { SchemaDefault } from "./SchemaDefault";
import { SchemaDeserialize } from "./SchemaDeserialize";
import { SchemaDistinct } from "./SchemaDistinct";
import { SchemaFrom } from "./SchemaFrom";
import { SchemaIndex } from "./SchemaIndex";
import { SchemaNullable } from "./SchemaNullable";
import { SchemaOptional } from "./SchemaOptional";
import { SchemaReadonly } from "./SchemaReadonly";
import { SchemaSerialize } from "./SchemaSerialize";
import { SchemaTag } from "./SchemaTag";

export class SchemaSensitive<T extends any, TModifiers extends SchemaModifiers> extends SchemaBase<T, TModifiers> {
    instance: T;
    private _schemaSensitive = true;

    constructor(current: SchemaBase<T, TModifiers>) {
        super(current);
        this.instance = current.instance;
        this.isSensitive = true;
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

    index(...indexes: string[]) {
        return new SchemaIndex<T, TModifiers>(this, ...indexes);
    }

    distinct() {
        return new SchemaDistinct<T, TModifiers | "distinct">(this);
    }

    tag(...tags: string[]) {
        return new SchemaTag<T, TModifiers>(tags, this);
    }
}
