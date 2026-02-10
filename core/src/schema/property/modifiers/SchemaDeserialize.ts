import { DefaultValue, PropertyDeserializer, PropertySerializer, SchemaModifiers } from "../../types";
import { SchemaBase } from "../base/SchemaBase";
import { SchemaDefault } from "./SchemaDefault";
import { SchemaFrom } from "./SchemaFrom";
import { SchemaOptional } from "./SchemaOptional";
import { SchemaSerialize } from "./SchemaSerialize";

export class SchemaDeserialize<T extends any, TModifiers extends SchemaModifiers> extends SchemaBase<T, TModifiers> {
    instance: T;
    private _schemaDeserialize = true;

    constructor(deserializer: PropertyDeserializer<T>, current: SchemaBase<T, TModifiers>) {
        super(current);
        this.instance = current.instance;
        this.valueDeserializer = deserializer;
    }

    serialize(serializer: PropertySerializer<T>) {
        return new SchemaSerialize<T, TModifiers | "serialize">(serializer, this);
    }

    from(propertyName: string) {
        return new SchemaFrom<T, TModifiers>(propertyName, this);
    }

    optional() {
        return new SchemaOptional<T, TModifiers | "optional">(this);
    }

    default<I = never>(value: DefaultValue<T | null, I>, injected?: I) {
        return new SchemaDefault<T | null, I, TModifiers | "default">(value, injected, this);
    }

}