import { DefaultValue, PropertyDeserializer, SchemaModifiers } from "../../types";
import { SchemaBase } from "../base/SchemaBase";
import { SchemaDefault } from "./SchemaDefault";
import { SchemaDeserialize } from "./SchemaDeserialize";
import { SchemaOptional } from "./SchemaOptional";
import { SchemaSearchable } from "./SchemaSearchable";

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

    /**
     * Only callable when the property underneath is a string — see the same method on
     * `SchemaOptional` for why the constraint is on `instance` rather than the whole class.
     *
     * A null value contributes no tokens.
     */
    searchable(this: { instance: string }) {
        return new SchemaSearchable<T, TModifiers | "searchable">(this as unknown as SchemaBase<T, TModifiers>);
    }

    default<I = never>(value: DefaultValue<T | null, I>, injected?: I) {
        return new SchemaDefault<T | null, I, TModifiers | "default">(value, injected, this);
    }

    deserialize(deserializer: PropertyDeserializer<T | null>) {
        return new SchemaDeserialize<T | null, TModifiers | "deserialize">(deserializer, this);
    }


}