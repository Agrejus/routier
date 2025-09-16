import { SchemaBase } from "../base/SchemaBase";
import { SchemaDefault } from "../modifiers/SchemaDefault";
import { SchemaNullable } from "../modifiers/SchemaNullable";
import { SchemaOptional } from "../modifiers/SchemaOptional";
import { SchemaDeserialize } from '../modifiers/SchemaDeserialize';
import { SchemaSerialize } from '../modifiers/SchemaSerialize';
import { SchemaIndex } from "../modifiers/SchemaIndex";
import { DefaultValue, PropertyDeserializer, PropertySerializer, SchemaModifiers, SchemaTypes } from "../../types";
import { SchemaFrom } from "../modifiers/SchemaFrom";

export class SchemaArray<T extends any, TModifiers extends SchemaModifiers> extends SchemaBase<T[], TModifiers> {

    instance: T[];
    type = SchemaTypes.Array;
    private _schemaArray = true;
    readonly innerSchema?: SchemaBase<any, any>; // we need to know the type of the array, that is what this is for

    constructor(entity?: SchemaBase<T[], TModifiers>, literals?: T[][]) {
        super(entity, literals);
        this.innerSchema = entity;
    }

    from(propertyName: string) {
        return new SchemaFrom<T[], TModifiers>(propertyName, this);
    }

    optional() {
        return new SchemaOptional<T[], TModifiers | "optional">(this);
    }

    nullable() {
        return new SchemaNullable<T[], TModifiers | "nullable">(this);
    }

    default<I = never>(value: DefaultValue<T[], I>, injected?: I) {
        return new SchemaDefault<T[], I, TModifiers | "default">(value, injected, this);
    }

    deserialize(deserializer: PropertyDeserializer<T[]>) {
        return new SchemaDeserialize<T[], TModifiers | "deserialize">(deserializer, this);
    }

    serialize(serializer: PropertySerializer<T[]>) {
        return new SchemaSerialize<T[], TModifiers | "serialize">(serializer, this);
    }

    index(...indexes: string[]) {
        return new SchemaIndex<T[], TModifiers>(this as any, ...indexes);
    }
}