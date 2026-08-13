import { PropertyDeserializer, SchemaModifiers } from "../../types";
import { SchemaBase } from "../base/SchemaBase";
import { SchemaDeserialize } from "./SchemaDeserialize";
import { SchemaNullable } from "./SchemaNullable";
import { SchemaSearchable } from "./SchemaSearchable";

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

    /**
     * Only callable when the property underneath is a string.
     *
     * A wrapper does not know what it wraps at runtime, but the type does: `T` is the value
     * type, so `s.number().optional()` is a `SchemaOptional<number>` and fails this `this`
     * constraint. That is the gate — there is no runtime check, because a builder that offers
     * a method it will then reject has already failed at its job.
     *
     * Constrained on `instance` alone rather than the whole class. `SchemaBase` holds `T` in
     * contravariant positions too (`valueSerializer`, `defaultValue`), so requiring the full
     * `SchemaOptional<string, ...>` would reject a literal union like
     * `s.string("draft", "published")`, which is a perfectly good searchable string.
     *
     * An absent value contributes no tokens.
     */
    searchable(this: { instance: string }) {
        return new SchemaSearchable<T, TModifiers | "searchable">(this as unknown as SchemaBase<T, TModifiers>);
    }

    deserialize(deserializer: PropertyDeserializer<T | undefined>) {
        return new SchemaDeserialize<T | undefined, TModifiers | "deserialize">(deserializer, this);
    }


}