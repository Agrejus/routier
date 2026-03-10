import { logger } from "../../../utilities";
import { DefaultValue, PropertyDeserializer, PropertySerializer, SchemaModifiers } from "../../types";
import { SchemaBase } from "../base/SchemaBase";
import { SchemaDeserialize } from "./SchemaDeserialize";
import { SchemaFrom } from "./SchemaFrom";
import { SchemaSerialize } from "./SchemaSerialize";

export class SchemaDefault<T extends any, I, TModifiers extends SchemaModifiers> extends SchemaBase<T, TModifiers> {
    instance: T;
    private _schemaDefault = true;

    constructor(defaultValue: DefaultValue<T, I>, injected: I, current: SchemaBase<T, TModifiers>) {
        super(current);

        if (defaultValue == null) {
            logger.warn("Do not use `.default(null)` in your schema, please use `.default(() => null)`")
        }

        this.instance = current.instance;
        this.injected = injected;
        this.defaultValue = defaultValue;
    }

    serialize(serializer: PropertySerializer<T>) {
        return new SchemaSerialize<T, TModifiers | "serialize">(serializer, this);
    }

    deserialize(deserializer: PropertyDeserializer<T>) {
        return new SchemaDeserialize<T, TModifiers | "deserialize">(deserializer, this);
    }

    from(propertyName: string) {
        return new SchemaFrom<T, TModifiers>(propertyName, this);
    }
}