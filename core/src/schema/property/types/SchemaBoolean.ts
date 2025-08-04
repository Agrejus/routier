import { DefaultValue, PropertyDeserializer, PropertySerializer, SchemaModifiers, SchemaTypes } from "../../types";
import { SchemaBase } from "../base/SchemaBase";
import { SchemaDefault } from "../modifiers/SchemaDefault";
import { SchemaDeserialize } from "../modifiers/SchemaDeserialize";
import { SchemaDistinct } from "../modifiers/SchemaDistinct";
import { SchemaIndex } from "../modifiers/SchemaIndex";
import { SchemaNullable } from "../modifiers/SchemaNullable";
import { SchemaOptional } from "../modifiers/SchemaOptional";
import { SchemaReadonly } from "../modifiers/SchemaReadonly";
import { SchemaSerialize } from "../modifiers/SchemaSerialize";
import { SchemaArray } from "./SchemaArray";

export class SchemaBoolean<T extends boolean, TModifiers extends SchemaModifiers> extends SchemaBase<T, TModifiers> {

    instance: T;
    type = SchemaTypes.Boolean;
    private _schemaBoolean = true;

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
        return new SchemaArray<typeof this, TModifiers>(this as any);
    }

    index(...indexes: string[]) {
        return new SchemaIndex<T, TModifiers>(this as any, ...indexes);
    }

    distinct() {
        return new SchemaDistinct<T, TModifiers | "distinct">(this);
    }
}