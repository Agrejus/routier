import { CompiledSchema, DefaultValue, InferType, PropertyDeserializer, PropertySerializer, SchemaModifiers, SchemaTypes, StringOptions } from "../../types";
import { SchemaBase } from "../base/SchemaBase";
import { SchemaDefault } from "../modifiers/SchemaDefault";
import { SchemaDeserialize } from "../modifiers/SchemaDeserialize";
import { SchemaDistinct } from "../modifiers/SchemaDistinct";
import { SchemaForeignKey } from "../modifiers/SchemaForeignKey";
import { SchemaFrom } from "../modifiers/SchemaFrom";
import { SchemaIdentity } from "../modifiers/SchemaIdentity";
import { SchemaIndex } from "../modifiers/SchemaIndex";
import { SchemaKey } from "../modifiers/SchemaKey";
import { SchemaNullable } from "../modifiers/SchemaNullable";
import { SchemaOptional } from "../modifiers/SchemaOptional";
import { SchemaReadonly } from "../modifiers/SchemaReadonly";
import { SchemaSearchable } from "../modifiers/SchemaSearchable";
import { SchemaSerialize } from "../modifiers/SchemaSerialize";
import { SchemaTag } from "../modifiers/SchemaTag";
import { SchemaArray } from "./SchemaArray";

export class SchemaString<T extends string, TModifiers extends SchemaModifiers> extends SchemaBase<T, TModifiers> {

    instance: T;
    type = SchemaTypes.String;
    private _schemaString = true;

    /**
     * @param entity Copied from when a modifier wraps this property.
     * @param literals The allowed values, when the string is a literal union.
     * @param options Declarations a backend may use. See `StringOptions`.
     */
    constructor(entity?: SchemaBase<T, TModifiers> | null, literals?: T[], options?: StringOptions) {
        super(entity, literals);

        if (options?.maxLength != null) {

            if (Number.isInteger(options.maxLength) === false || options.maxLength <= 0) {
                // Thrown at schema construction rather than at the first save, matching
                // `s.vector()`: a bad length is a typo in a declaration, and the stack is only
                // useful next to it.
                throw new Error(`A string's maxLength must be a positive whole number.  Received: ${options.maxLength}`);
            }

            this.maxLength = options.maxLength;
        }
    }

    from(propertyName: string) {
        return new SchemaFrom<T, TModifiers>(propertyName, this);
    }

    constrain<K extends T>() {
        return new SchemaString<K, TModifiers>(this as unknown as SchemaBase<K, TModifiers>);
    }

    optional() {
        return new SchemaOptional<T, TModifiers | "optional">(this);
    }

    nullable() {
        return new SchemaNullable<T, TModifiers | "nullable">(this);
    }

    key() {
        return new SchemaKey<T, TModifiers | "key">(this);
    }

    foreignKey<K extends {}>(relatingSchema: CompiledSchema<K>, property: keyof InferType<CompiledSchema<K>>) {
        return new SchemaForeignKey<T, TModifiers, K>(this, relatingSchema, property);
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

    identity() {
        return new SchemaIdentity<T, TModifiers | "identity" | "readonly">(this);
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

    /**
     * Marks this string as eligible for the collection's full-text search index.
     *
     * ```ts
     * title: s.string().searchable(),
     * body: s.string({ maxLength: 4000 }).searchable(),
     * ```
     *
     * Nothing is indexed until the collection declares `.searchIndex()`. Combines with
     * `.optional()` and `.nullable()` in either sense — an absent or null value contributes no
     * tokens.
     */
    searchable() {
        return new SchemaSearchable<T, TModifiers | "searchable">(this);
    }

    tag(...tags: string[]) {
        return new SchemaTag<T, TModifiers>(tags, this);
    }


}