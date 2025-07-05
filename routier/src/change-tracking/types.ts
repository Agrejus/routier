import { EntityModificationResult, IdType, InferCreateType, InferType, Query, ChangeTrackingType, TagCollection, EntityChanges, Expression, IQuery, GenericFunction, EntityChangeType } from "routier-core";
import { EntityCallbackMany } from '../types'

export type QuerySubscription<TEntity extends {}, U> = {
    id: string,
    query: Query<TEntity, U>;
    shape: (data: TEntity[]) => U;
    done: (result: U, error?: any) => void;
};

export interface IChangeTrackerStrategy<T extends {}> {
    enrich(entities: InferType<T>[]): InferType<T>[];
    add(entities: InferCreateType<T>[], tag: unknown | null, done: EntityCallbackMany<T>): void;
    remove(entities: InferType<T>[], tag: unknown | null, done: EntityCallbackMany<T>): void;
    removeByQuery(query: IQuery<T, T>, tag: unknown | null, done: (error?: any) => void): void;
    resolve(entities: InferType<T>[], tag: unknown | null, options?: { merge?: boolean }): InferType<T>[];
    hasChanges(): boolean;
    replace(existingEntity: InferType<T> | InferCreateType<T>, newEntity: InferType<T> | InferCreateType<T>): void;
    prepareRemovals(): EntityChanges<T>["removes"];
    prepareAdditions(): EntityChanges<T>["adds"];
    getAttachmentsChanges(): EntityChanges<T>["updates"];
    mergeChanges(changes: EntityModificationResult<T>): void;
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