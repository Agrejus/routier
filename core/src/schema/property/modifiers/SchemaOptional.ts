import { PropertyDeserializer, SchemaModifiers } from "../../types";
import { SchemaBase } from "../base/SchemaBase";
import { SchemaDeserialize } from "./SchemaDeserialize";
import { SchemaNullable } from "./SchemaNullable";

export class SchemaOptional<T extends any, TModifiers extends SchemaModifiers> extends SchemaBase<T, TModifiers> {

    instance: T;
    private _schemaOptional = true;

    constructor(current: SchemaBase<T, TModifiers>) {
        super(current);
        this.instance = current.instance;
        this.isOptional = true;
    }

    nullable() {
        return new SchemaNullable<T, TModifiers | "nullable">(this);
    }

    deserialize(deserializer: PropertyDeserializer<T | undefined>) {
        return new SchemaDeserialize<T | undefined, TModifiers | "deserialize">(deserializer, this);
    }
}