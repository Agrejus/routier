import { SchemaDefinition } from "./SchemaDefinition";
import { SchemaBase } from "./property/base/SchemaBase";
import { SchemaArray } from "./property/types/SchemaArray";
import { SchemaObject } from "./property/types/SchemaObject";
import { PropertyInfo } from "./PropertyInfo";
import { DeepPartial } from "../types";

export type DefaultValue<T, I = never> = T | ((injected: I) => T);
export type FunctionBody<TEntity, TResult> = (entity: TEntity, collectionName: string) => TResult;
export type IdType = string | number;

export enum SchemaTypes {
    Array = "Array",
    Boolean = "Boolean",
    Date = "Date",
    Number = "Number",
    Object = "Object",
    String = "String",
    Definition = "Definition",
    Function = "Function",
    Computed = "Computed"
}

export type ArrayShape = string | number | Date | {};

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

export interface ICollectionSubscription<T extends {}> extends Disposable {
    send(changes: SubscriptionChanges<T>): void;
    onMessage(callback: (changes: SubscriptionChanges<T>) => void): void;
}

type Enrich<TEntity extends {}> = {
    (entity: InferType<TEntity>, changeTrackingType: ChangeTrackingType): InferType<TEntity>;
    (entity: InferCreateType<TEntity>, changeTrackingType: ChangeTrackingType): InferCreateType<TEntity>;
}

/**
 * Represents a fully compiled schema with all utilities and metadata for an entity type.
 */
export type CompiledSchema<TEntity extends {}> = {

    deserializePartial: (item: Record<string, unknown>, properties: PropertyInfo<TEntity>[]) => DeepPartial<InferType<TEntity>>;

    createSubscription: (abortSignal?: AbortSignal) => ICollectionSubscription<TEntity>;
    /** Returns the property info for a given id (full path) */
    getProperty: (id: string) => PropertyInfo<TEntity>;
    /** Returns the ID of the given entity. */
    getId: (entity: InferType<TEntity>) => IdType;
    /** Returns a deep clone of the given entity. */
    clone: (entity: InferType<TEntity>) => InferType<TEntity>;
    /** Removes unmapped or extraneous properties from the entity. */
    strip: (entity: InferType<TEntity>) => InferType<TEntity>;
    /** Prepares a new entity for creation, applying defaults and transformations. */
    prepare: (entity: InferCreateType<TEntity>) => InferCreateType<TEntity>;
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
    /** Serializes an entity to storage format. */
    serialize: (entity: InferType<TEntity>) => InferType<TEntity>;
    /** Unique id for the schema. */
    id: SchemaId,
    /** The name of the collection for this schema. */
    collectionName: string;
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
}

export type PropertySerializer<T extends any> = (value: T) => string | number;
export type PropertyDeserializer<T extends any> = (value: string | number) => T;

export type SchemaId = number

export type SchemaModifiers = "default" | "deserialize" |
    "identity" | "key" |
    "nullable" | "optional" |
    "readonly" | "serialize" |
    "unmapped" | "computed" |
    "distinct";

type InferPrimitive<T> =
    T extends SchemaArray<infer Y, infer __> ? InferPrimitive<Y>[]
    : T extends SchemaObject<infer Obj, infer _> ?
    { [K in keyof Obj]: InferPrimitive<Obj[K]> } : // Process nested objects
    T extends SchemaBase<infer X, infer _> ?
    X : // Extract the primitive type
    never;

export type InferType<T> = T extends CompiledSchema<infer R> ? InferCompiledSchema<R> : T extends {} ? InferCompiledSchema<T> : T;
export type InferCreateType<T> = T extends CompiledSchema<infer R> ? InferCompiledCreateSchema<R> : T extends {} ? InferCompiledCreateSchema<T> : unknown;
export type InferMappedType<T> = T extends SchemaBase<infer K, infer __> ? InferType<K> : InferCompiledSchema<T>;

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

type IsPlainCreateProperty<T, K extends keyof T> =
    [
        HasModifier<T, K, "identity">,
        HasModifier<T, K, "default">,
        HasModifier<T, K, "computed">,
        HasModifier<T, K, "unmapped">,
        HasModifier<T, K, "optional">,
        HasModifier<T, K, "nullable">
    ] extends [
        false,
        false,
        false,
        false,
        false,
        false
    ] ? true : false;

type InferCompiledSchema<T> = CoalesceEmpty<{
    [K in keyof T as IsPlainProperty<T, K> extends true ? K : never]: InferPrimitive<T[K]>
}, {
        readonly [K in keyof T as HasModifier<T, K, "readonly"> extends true ? K : never]: InferPrimitive<T[K]>
    }, {
        [K in keyof T as HasModifier<T, K, "optional"> extends true ? K : never]?: InferPrimitive<T[K]>
    }, {
        [K in keyof T as HasModifier<T, K, "nullable"> extends true ? K : never]: null | InferPrimitive<T[K]>
    }>;

type InferCompiledCreateSchema<T> = CoalesceEmpty<{
    [K in keyof T as IsPlainCreateProperty<T, K> extends true ? K : never]: InferPrimitive<T[K]>
}, {
        [K in keyof T as HasModifier<T, K, "optional"> extends true ? K : never]?: InferPrimitive<T[K]>
    }, {
        [K in keyof T as HasModifier<T, K, "default"> extends true ? K : never]?: InferPrimitive<T[K]>
    }, {
        [K in keyof T as HasModifier<T, K, "nullable"> extends true ? K : never]: null | InferPrimitive<T[K]>
    }>;

type IsEmptyObject<T> = keyof T extends never ? true : false;
type CoalesceEmpty<T1 extends {}, T2 extends {}, T3 extends {}, T4 extends {}> = (IsEmptyObject<T1> extends true ? {} : T1) & (IsEmptyObject<T2> extends true ? {} : T2) & (IsEmptyObject<T3> extends true ? {} : T3) & (IsEmptyObject<T4> extends true ? {} : T4);
