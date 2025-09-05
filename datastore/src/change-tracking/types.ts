import { SchemaPersistChanges, SchemaPersistResult, TagCollection } from "@routier/core/collections";
import { EntityChangeType, IQuery, Query } from "@routier/core/plugins";
import { CallbackResult } from "@routier/core/results";
import { ChangeTrackingType, IdType, InferCreateType, InferType } from "@routier/core/schema";
import { GenericFunction } from "@routier/core/types";

export type QuerySubscription<TEntity extends {}, U> = {
    id: string,
    query: Query<TEntity, U>;
    shape: (data: TEntity[]) => U;
    done: CallbackResult<U>;
};

export interface IChangeTrackerStrategy<T extends {}> {
    enrich(entities: InferType<T>[]): InferType<T>[];
    add(entities: InferCreateType<T>[], tag: unknown | null, done: CallbackResult<InferType<T>[]>): void;
    remove(entities: InferType<T>[], tag: unknown | null, done: CallbackResult<InferType<T>[]>): void;
    removeByQuery(query: IQuery<T, T>, tag: unknown | null, done: CallbackResult<never>): void;
    resolve(entities: InferType<T>[], tag: unknown | null, options?: { merge?: boolean }): InferType<T>[];
    hasChanges(): boolean;
    replace(existingEntity: InferType<T> | InferCreateType<T>, newEntity: InferType<T> | InferCreateType<T>): void;
    prepareRemovals(): SchemaPersistChanges<T>["removes"];
    prepareAdditions(): SchemaPersistChanges<T>["adds"];
    getAttachmentsChanges(): SchemaPersistChanges<T>["updates"];
    mergeChanges(changes: SchemaPersistResult<T>): void;
    clearAdditions(): void;
    instance(entities: InferCreateType<T>[], changeTrackingType: ChangeTrackingType): Generator<InferType<T>, void, unknown>;
    getAndDestroyTags(): TagCollection;
    detach(entities: InferType<T>[]): InferType<T>[];
    markDirty(entities: InferType<T>[]): void;
    isAttached(entity: InferType<T>): boolean;
    filterAttached(selector: GenericFunction<InferType<T>, boolean>): InferType<T>[];
    findAttached(selector: GenericFunction<InferType<T>, boolean>): InferType<T> | undefined;
    getAttached(entity: InferType<T>): { doc: InferType<T>, changeType: EntityChangeType } | undefined;
}

export type UpdatesPackage<T extends {}> = Map<IdType, {
    doc: InferType<T>;
    delta: {
        [key: string]: string | number | Date;
    };
}>;