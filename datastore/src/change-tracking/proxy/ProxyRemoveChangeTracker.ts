import { CompiledSchema, IdType, InferType } from "@routier/core/schema";
import { IChangeTracker } from "../types";
import { TagCollection } from "@routier/core/collections";

export class ProxyRemoveChangeTracker<TEntity extends {}> implements IChangeTracker<InferType<TEntity>> {

    protected removals: Map<IdType, InferType<TEntity>> = new Map<IdType, InferType<TEntity>>();
    protected schema: CompiledSchema<TEntity>;
    protected tagCollection: TagCollection

    constructor(
        schema: CompiledSchema<TEntity>,
        tagCollection: TagCollection
    ) {
        this.schema = schema;
        this.tagCollection = tagCollection;
    }

    get(key: IdType): InferType<TEntity> | undefined {
        throw new Error("Method not implemented.");
    }

    compute(): InferType<TEntity>[] {
        const entities: InferType<TEntity>[] = [];

        for (const [, entity] of this.removals) {
            entities.push(this.schema.prepare(entity));
        }

        return entities;
    }

    has(entity: InferType<TEntity>): boolean {
        return false;
    }

    hasChanges(): boolean {
        return this.removals.size > 0;
    }

    untrack(entity: InferType<TEntity>): InferType<TEntity> {
        const key = this.schema.getId(entity);

        if (this.removals.delete(key) === false) {
            throw new Error(`Unable to untrack entity. Id: ${key}`)
        }

        return entity;
    }

    untrackMany(entities: InferType<TEntity>[]): InferType<TEntity>[] {

        for (let i = 0, length = entities.length; i < length; i++) {
            this.untrack(entities[i]);
        }

        return entities;
    }

    trackMany(entities: InferType<TEntity>[], tag: unknown | null): InferType<TEntity>[] {

        for (let i = 0, length = entities.length; i < length; i++) {
            this.track(entities[i], tag);
        }

        return entities;
    }

    track(entity: InferType<TEntity>, tag: unknown | null): InferType<TEntity> {
        const key = this.schema.getId(entity);
        this.removals.set(key, entity);

        if (tag != null) {
            this.tagCollection.set(entity, tag);
        }

        return entity;
    }

    clear(): void {
        this.removals.clear()
    }

    *[Symbol.iterator](): Iterator<InferType<TEntity>, any, any> {
        for (const [, entity] of this.removals) {
            yield entity;
        }
    }

}