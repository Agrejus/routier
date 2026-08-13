import type { SchemaDefinition } from "./SchemaDefinition";
import type { SchemaBase } from "./property/base/SchemaBase";
import type { SchemaArray } from "./property/types/SchemaArray";
import type { SchemaVector } from "./property/types/SchemaVector";
import type { SchemaObject } from "./property/types/SchemaObject";
import type { PropertyInfo } from "./PropertyInfo";
import type { DeepPartial } from "../types";
import type { SchemaFunction } from "./table";
import type { SchemaOptional, SchemaTag } from "./property/modifiers";
import type { Branded } from "../utilities/types";
import type { SchemaSubscriptionOptions } from "./communication/broadcast";

export type DefaultValue<T, I = never> = T | ((injected: I) => T);
export type FunctionBody<TEntity, TResult> = (entity: TEntity, collectionName: CollectionName) => TResult;
export type IdType = string | number;
export type ForeignKey<T extends {}> = { 
    schema: CompiledSchema<T>, 
    property: PropertyInfo<T> 
};

export enum SchemaTypes {
    Array = "Array",
    Boolean = "Boolean",
    Date = "Date",
    Number = "Number",
    Object = "Object",
    String = "String",
    Definition = "Definition",
    Function = "Function",
    Computed = "Computed",
    /**
     * Content in, reference out. The only type whose write shape differs from its stored
     * shape, and a leaf on purpose — see `SchemaFile`.
     */
    File = "File",
    /**
     * A fixed-length list of numbers, carrying its dimension count — see `SchemaVector`.
     *
     * Value-shaped exactly like `s.array(s.number())`, which is why every array codegen
     * handler accepts it. It is a distinct type only so a backend can recognise it and store
     * it natively; nothing else needs to tell the two apart.
     */
    Vector = "Vector"
}

export type ArrayShape = string | number | Date | {};


/**
 * What a file property gives back: where the bytes are and what they are.
 *
 * Declared in core so `InferType` can name it. Core never reads or writes the bytes — it only
 * carries this shape — and `@routier/blob-plugin` is what puts one here.
 */
export type FileReferenceValue = {
    /** Where the bytes live, content-addressed by the blob plugin. */
    key: string;
    /** Byte length. */
    size: number;
    /** Media type as supplied at upload. */
    contentType: string;
    /** SHA-256 of the bytes, lowercase hex. */
    checksum: string;
    /** The name to show a user. Not part of the key. */
    fileName: string;
};

/**
 * What a file property ACCEPTS: content, or a reference you already have.
 *
 * `Blob` covers `File`, which is what an `<input type="file">` yields. A reference is accepted
 * too, so re-saving an entity that was read from the database does not have to re-upload it.
 */
export type FileContentValue =
    | FileReferenceValue
    | Uint8Array
    | ArrayBuffer
    | Blob
    | string;

/**
 * What a vector property holds, in and out: a plain list of numbers.
 *
 * Named rather than written inline because the inference rules have to recognise it after a
 * modifier has erased which class produced it — the same problem `FileReferenceValue` solves
 * above, and for the same reason.
 */
export type VectorValue = number[];

/**
 * What `s.string({ ... })` accepts.
 *
 * Declarations only. Core stores them and never acts on them; a backend that can use one does.
 */
export type StringOptions = {
    /**
     * The longest value the property is declared to hold.
     *
     * MySQL uses it for `VARCHAR(maxLength)`; without it every string column is
     * `VARCHAR(255)`, which silently truncates longer values. Other backends ignore it. Core
     * never validates a value against it — see `SchemaBase.maxLength`.
     */
    maxLength?: number;
};

export type ExpandedProperty = ExpandedChildProperty & {
    assignmentPath: string;
    selectorPath: string;
    properties: Map<string, ExpandedChildProperty>;
    childDegree: number;
};

export type ExpandedChildProperty = {
    propertyName: string;
    type: SchemaTypes;
    isNullableOrOptional: boolean;
    isReadonly: boolean;
    isIdentity: boolean;
    isUnmapped: boolean;
}

export enum HashType {
    Ids = "Ids",
    Object = "Object"
}

export type HashFunction<TEntity extends {}> = {
    (entity: InferCreateType<TEntity>, type: HashType.Object): string;
    (entity: InferType<TEntity>, type: HashType.Ids): string;
}

export type GetHashTypeFunction<TEntity extends {}> = {
    (entity: InferCreateType<TEntity>): HashType.Object;
    (entity: InferType<TEntity>): HashType.Ids;
}

export type ChangeTrackingType = "proxy" | "diff" | "immutable";

export type IndexType = "single" | "compound" | "unique" | "primary-key"
export type Index = {
    properties: PropertyInfo<any>[],
    type: IndexType;
    name: string;
}

/**
 * Represents changes to subscriptions, categorizing them by modifications to
 * entities (additions, updates, removals) or query-driven removals.
 * @template T - The type of the entities in the subscription.
 */
export type SubscriptionChanges<T extends {}> = {
    /**
     * Entities that have been added to the subscription.
     */
    adds: InferType<T>[];
    /**
     * Entities that have been updated within the subscription.
     */
    updates: InferType<T>[];
    /**
     * Entities that have been removed from the subscription.
     */
    removals: InferType<T>[];
    /**
     * Entities that have been added/updated/removed from the subscription and it is unknown 
     * if the entities have been added/updated/removed.
     */
    unknown: InferType<T>[];
}

export interface ISchemaSubscription<T extends {}> extends Disposable {
    send(changes: SubscriptionChanges<T>): void;
    onMessage(callback: (changes: SubscriptionChanges<T>) => void): void;
}

export type Enrich<TEntity extends {}> = {
    (entity: InferType<TEntity>, changeTrackingType: ChangeTrackingType): InferType<TEntity>;
    (entity: InferCreateType<TEntity>, changeTrackingType: ChangeTrackingType): InferCreateType<TEntity>;
}
export type Prepare<TEntity extends {}> = {
    (entity: InferCreateType<TEntity>): InferCreateType<TEntity>;
    (entity: InferType<TEntity>): InferType<TEntity>;
}
export type Preprocess<TEntity extends {}> = {
    (entity: InferCreateType<TEntity>): InferType<TEntity>;
    (entity: InferType<TEntity>): InferType<TEntity>;
}

export type SetProperties<TEntity extends {}> = (destination: DeepPartial<InferType<TEntity> | InferCreateType<TEntity>>, source: DeepPartial<InferType<TEntity> | InferCreateType<TEntity>>) => void;

export type CompiledSchemaCore<TEntity extends {}> = Omit<CompiledSchema<TEntity>, "createSubscription">;

export type CompiledSchemaWithMetadata<TEntity extends {}, TMetadata> = {
    readonly metadata: TMetadata;
} & CompiledSchema<TEntity>;

/**
 * Represents a fully compiled schema with all utilities and metadata for an entity type.
 */
export type CompiledSchema<TEntity extends {}> = {

    deserializePartial: (item: Record<string, unknown>, properties: PropertyInfo<TEntity>[]) => DeepPartial<InferType<TEntity>>;

    createSubscription: (abortSignal?: AbortSignal, scope?: string, options?: SchemaSubscriptionOptions) => ISchemaSubscription<TEntity>;
    /** Returns the property info for a given id (full path) */
    getProperty: (id: string) => PropertyInfo<TEntity>;
    /** Returns the ID of the given entity. */
    getId: (entity: InferType<TEntity>) => IdType;
    /** Returns a deep clone of the given entity. */
    clone: (entity: InferType<TEntity>) => InferType<TEntity>;
    /**
     * Returns a deep clone of a record that is still in the STORAGE shape — renamed properties
     * under their `from` names rather than their in-memory names.
     *
     * `clone` reads in-memory names, so it returns `undefined` for every renamed property of a
     * stored record. Use this when copying rows a store holds before they have been deserialized.
     * Generated on first call; schemas that are never cloned in storage shape never build it.
     */
    cloneStorage: (entity: InferType<TEntity>) => InferType<TEntity>;
    /** Removes unmapped or extraneous properties from the entity. */
    strip: (entity: InferType<TEntity>) => InferType<TEntity>;
    /** Prepares a new entity for creation, applying defaults and transformations. */
    prepare: Prepare<TEntity>;
    /** Merges the source entity into the destination entity. */
    merge: (destination: InferType<TEntity> | InferCreateType<TEntity>, source: InferType<TEntity>) => InferType<TEntity>;
    /** Indicates if the schema has identity properties. */
    hasIdentities: boolean;
    /** List of properties that are identity keys. */
    idProperties: PropertyInfo<TEntity>[];
    /** All property metadata for the schema. */
    properties: PropertyInfo<TEntity>[],
    /** The hash type used for this schema. */
    hashType: HashType;
    /** Computes a hash for the given entity. */
    hash: HashFunction<TEntity>;
    /** Returns the hash type for the given entity. */
    getHashType: GetHashTypeFunction<TEntity>;
    /** Compares two entities for equality. */
    compare: (a: InferType<TEntity>, fromDb: InferType<TEntity>) => boolean;
    /** Deserializes an entity from storage format. */
    deserialize: (entity: InferType<TEntity>) => InferType<TEntity>;
    /** Sets 1 or many properties from the source object onto the destination object with change tracking. */
    set: SetProperties<TEntity>;
    /** Combines serializing and preparing an entity for saving. */
    preprocess: Preprocess<TEntity>;
    /** Combines deserializing and enriching an entity for selection. */
    postprocess: Enrich<TEntity>;

    /** Serializes an entity to storage format. */
    serialize: (entity: InferType<TEntity>) => InferType<TEntity>;
    /** Unique id for the schema. */
    id: SchemaId,
    /** The name of the collection for this schema. */
    collectionName: CollectionName;
    /** Returns all IDs for the given entity (usually a single-element tuple). */
    getIds: (entity: InferType<TEntity>) => [IdType];
    /** Enriches the entity with change tracking or other metadata. */
    enrich: Enrich<TEntity>;
    /** Indicates if the schema has identity keys. */
    hasIdentityKeys: boolean;
    /** Returns a deeply frozen (immutable) version of the entity. */
    freeze: (entity: InferType<TEntity>) => InferType<TEntity>;
    /** Enables change tracking on the entity. */
    enableChangeTracking: (entity: InferType<TEntity>) => InferType<TEntity>;
    /** The schema definition object. */
    definition: SchemaDefinition<TEntity>;
    /** Returns all indexes defined for this schema. */
    getIndexes: () => Index[];
    /** Compares two entities for Id equality. */
    compareIds: (a: InferType<TEntity>, b: InferType<TEntity>) => boolean;
}

export type PropertySerializer<T extends any> = (value: T) => string | number;
export type PropertyDeserializer<T extends any> = (value: string | number) => T;

/**
 * A two-way transform between the application value and the stored value.
 *
 * Both directions may be async. Held as a live reference rather than stringified, so a
 * closure works and `injected` is a convenience rather than the only way in.
 */
export type PropertyTransform<T extends any> = {
    /**
     * Application value to stored value. Runs before the plugin sees it. May be async.
     *
     * `entity` is there for the one-way case: a transform with no `from` derives a value
     * rather than converting one, which is what `computed` does.
     */
    to: (value: T, entity: Record<string, unknown>) => unknown | Promise<unknown>;

    /**
     * Stored value back to application value. Runs after the plugin returns it.
     *
     * Optional. Leave it out and the transform is one-way: the stored value is the value.
     */
    from?: (value: unknown) => T | Promise<T>;

    /**
     * What the column becomes, when the stored form is not the property's own type.
     *
     * Defaults to the property's own type, so nothing changes unless you say it does. A
     * library that always produces text — a cipher, a compressor — sets this once, and the
     * caller who uses that library never writes it.
     */
    stores?: SchemaTypes;

    /**
     * Whether a filter on this property can still run in the database.
     *
     * Defaults to `none`, which rejects the filter rather than returning wrong rows. Set
     * `equality` only when `to` is deterministic.
     */
    comparable?: 'equality' | 'none';
};

export type SchemaId = Branded<number, "SchemaId">;
export type CollectionName = Branded<string, "CollectionName">;

export type SchemaModifiers = "default" | "deserialize" |
    "identity" | "key" |
    "nullable" | "optional" |
    "readonly" | "serialize" |
    "unmapped" | "computed" |
    "distinct" | "searchable";

/**
 * What a tagged property infers to.
 *
 * `tag()` is metadata and must not change a type, but `SchemaTag<T>` carries the same `T` as
 * whatever it wrapped without carrying which class that was. For a string `T` is already
 * `string`; for an object `T` is the map of child schemas, which only the `SchemaObject`
 * branch below knows how to unwrap. Falling through to the generic `SchemaBase` branch
 * therefore handed the raw map back, so `s.object({ key: s.string() }).tag('x')` typed
 * `key` as `SchemaString` instead of `string` — everything ran, and only the types lied.
 *
 * An array is distinguishable because `SchemaArray`'s parameter is the ELEMENT schema, so a
 * tagged array arrives here as a `SchemaBase` rather than a plain map.
 */
type InferTagged<C> = ResolveWrapped<C>;

/**
 * What a wrapping modifier's inner type resolves to.
 *
 * `SchemaOptional`, `SchemaNullable` and `SchemaTag` all carry the same `C` as whatever they
 * wrapped, without carrying which class that was, so each has to work out what it is holding.
 * Three shapes are possible:
 *
 * - an already-resolved value (`string` from `s.string()`, a file reference from `s.file()`)
 * - an ELEMENT schema, which is what `SchemaArray` parameterises on
 * - a map of child schemas, which is what `SchemaObject` parameterises on
 *
 * Getting this wrong is silent. The map branch applied to an already-resolved object walks
 * its keys and infers `never` for each, so `s.file().optional()` typed as
 * `{ key: never, size: never, ... }` — which no value can satisfy and no test would catch at
 * runtime.
 */
type ResolveWrapped<C> =
    C extends string | number | boolean | Date | FileReferenceValue ? C :
    C extends VectorValue ? C :
    C extends SchemaBase<any, any> ? InferPrimitive<C>[] :
    { [K in keyof C]: InferPrimitive<C[K]> };

type InferPrimitive<T> =
    T extends SchemaOptional<infer C, infer __> ? ResolveWrapped<C> :
    T extends SchemaTag<infer C, infer __> ? InferTagged<C> :
    // Before the generic `SchemaBase` branch below, which would see `X = number[]` and map
    // the element through `InferPrimitive<number>` — no branch matches a bare `number`, so a
    // vector would type as `never[]`: assignable from nothing, and invisible at runtime.
    T extends SchemaVector<infer __, infer ___> ? VectorValue :
    T extends SchemaArray<infer Y, infer __> ? InferPrimitive<Y>[]
    : T extends SchemaObject<infer Obj, infer _> ?
    { [K in keyof Obj]: InferPrimitive<Obj[K]> } : // Process nested objects
    T extends SchemaFunction<infer F, infer __> ? F : T extends SchemaBase<infer X, infer _> ?
    X extends Array<infer A> ? InferPrimitive<A>[] : X : // Extract the primitive type
    never;

export type InferType<T> = T extends CompiledSchema<infer R> ? InferCompiledSchema<R> : T extends {} ? InferCompiledSchema<T> : T;
export type InferCreateType<T> = T extends CompiledSchema<infer R> ? InferCompiledCreateSchema<R> : T extends {} ? InferCompiledCreateSchema<T> : unknown;
export type InferMappedType<T> = T extends SchemaBase<infer K, infer __> ? InferType<K> : InferCompiledSchema<T>;
export type InferRoot<T> = T extends CompiledSchema<infer R> ? R : never;

type HasModifier<T, K extends keyof T, M extends SchemaModifiers> =
    T[K] extends SchemaBase<any, infer Mods> ?
    M extends Mods ? true : false :
    false;

type IsPlainProperty<T, K extends keyof T> =
    [
        HasModifier<T, K, "readonly">,
        HasModifier<T, K, "optional">,
        HasModifier<T, K, "nullable">
    ] extends [
        false,
        false,
        false
    ] ? true : false;

type IsCreateExcluded<T, K extends keyof T> =
    [
        HasModifier<T, K, "identity">,
        HasModifier<T, K, "computed">,
        HasModifier<T, K, "unmapped">
    ] extends [
        false,
        false,
        false
    ] ? false : true;

type IsCreateOptional<T, K extends keyof T> =
    [
        HasModifier<T, K, "optional">,
        HasModifier<T, K, "default">
    ] extends [
        false,
        false
    ] ? false : true;

type IsCreateNullable<T, K extends keyof T> =
    HasModifier<T, K, "nullable"> extends true ? true : false;

/**
 * What a property ACCEPTS on the way in, which is not always what it gives back.
 *
 * Only a file differs today: you assign content and read a reference. Matching on the read
 * type rather than on `SchemaFile` itself is deliberate — it keeps working through every
 * modifier. `s.file().optional()` is a `SchemaOptional`, `s.file().tag('x')` is a
 * `SchemaTag`, and neither carries the original class, so a check against the class alone
 * would silently stop accepting content the moment anyone added a modifier.
 *
 * Assignability is required in BOTH directions, and the tuple wrappers are load-bearing.
 * One-way `extends` matches `never` — which is assignable to everything — so a generic
 * property over `Record<string, unknown>` resolved to file content and broke the Dexie
 * plugin's types. It also matched any object that merely happens to have these five fields
 * plus more. Mutual assignability admits the reference shape and nothing else, and the
 * tuples stop the conditional distributing over a union.
 */
type InferWritePrimitive<T> =
    [InferPrimitive<T>] extends [FileReferenceValue]
    ? [FileReferenceValue] extends [InferPrimitive<T>] ? FileContentValue : InferPrimitive<T>
    : InferPrimitive<T>;

type InferCreateProperty<T, K extends keyof T> =
    IsCreateNullable<T, K> extends true ? null | InferWritePrimitive<T[K]> : InferWritePrimitive<T[K]>;

type InferCompiledSchema<T> = CoalesceEmpty<{
    [K in keyof T as IsPlainProperty<T, K> extends true ? K : never]: InferPrimitive<T[K]>
}, {
        readonly [K in keyof T as HasModifier<T, K, "readonly"> extends true ? K : never]: InferPrimitive<T[K]>
    }, {
        [K in keyof T as HasModifier<T, K, "optional"> extends true ? K : never]?: InferPrimitive<T[K]>
    }, {
        [K in keyof T as HasModifier<T, K, "nullable"> extends true ? K : never]: null | InferPrimitive<T[K]>
}>;

type InferCompiledCreateSchema<T> = {
    [K in keyof T as IsCreateExcluded<T, K> extends true ? never
        : IsCreateOptional<T, K> extends true ? K : never]?: InferCreateProperty<T, K>
} & {
    [K in keyof T as IsCreateExcluded<T, K> extends true ? never
        : IsCreateOptional<T, K> extends true ? never : K]: InferCreateProperty<T, K>
};

type IsEmptyObject<T> = keyof T extends never ? true : false;
type CoalesceEmpty<T1 extends {}, T2 extends {}, T3 extends {}, T4 extends {}> = (IsEmptyObject<T1> extends true ? {} : T1) & (IsEmptyObject<T2> extends true ? {} : T2) & (IsEmptyObject<T3> extends true ? {} : T3) & (IsEmptyObject<T4> extends true ? {} : T4);
