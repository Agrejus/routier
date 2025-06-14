import { EntityModificationResult, IdType, InferCreateType, InferType, Query, ChangeTrackingType, TagCollection, EntityChanges, Expression } from "routier-core";
import { EntityCallbackMany } from '../types'
import { ResolveOptions } from "../data-access/types";

export type QuerySubscription<TEntity extends {}, U> = {
    id: string,
    query: Query<TEntity>;
    shape: (data: TEntity[]) => U;
    done: (result: U, error?: any) => void;
};

export interface IChangeTrackerStrategy<T extends {}> {
    enrich(entities: InferType<T>[]): InferType<T>[];
    add(entities: InferCreateType<T>[], tag: unknown | null, done: EntityCallbackMany<T>): void;
    remove(entities: InferType<T>[], tag: unknown | null, done: EntityCallbackMany<T>): void;
    removeByExpression(expression: Expression, tag: unknown | null, done: (error?: any) => void): void;
    resolve(entities: InferType<T>[], tag: unknown | null, options?: ResolveOptions): InferType<T>[];
    hasChanges(): boolean;
    replace(existingEntity: InferType<T> | InferCreateType<T>, newEntity: InferType<T> | InferCreateType<T>): void;
    prepareRemovals(): EntityChanges<T>["removes"];
    prepareAdditions(): AdditionsPackage<T>;
    getAttachmentsChanges(): EntityChanges<T>["updates"];
    mergeChanges(changes: EntityModificationResult<T>, addPackge: AdditionsPackage<T>): void;
    clearAdditions(): void;
    instance(entities: InferCreateType<T>[], changeTrackingType: ChangeTrackingType): Generator<InferType<T>, void, unknown>;
    getAndDestroyTags(): TagCollection;
    detach(entities: InferType<T>[]): InferType<T>[];
}

export type UpdatesPackage<T extends {}> = Map<IdType, {
    doc: InferType<T>;
    delta: {
        [key: string]: string | number | Date;
    };
}>;

export type AdditionsPackage<T extends {}> = {
    adds: InferCreateType<T>[],
    find: (entity: InferType<T>) => InferCreateType<T> | undefined
};