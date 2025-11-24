import { CompiledSchema, IdType } from "@routier/core/schema";
import { IChangeTracker } from "../types";
import { TagCollection } from "@routier/core/collections";
import { IQuery } from "@routier/core/plugins";

export class ProxyQueryRemovalChangeTracker<TEntity extends {}> implements IChangeTracker<IQuery<TEntity, TEntity>> {

    protected removalQueries: IQuery<TEntity, TEntity>[] = [];
    protected schema: CompiledSchema<TEntity>;
    protected tagCollection: TagCollection

    constructor(
        schema: CompiledSchema<TEntity>,
        tagCollection: TagCollection
    ) {
        this.schema = schema;
        this.tagCollection = tagCollection;
    }

    get(key: IdType): IQuery<TEntity, TEntity> | undefined {
        throw new Error("Method not implemented.");
    }

    compute(): IQuery<TEntity, TEntity>[] {
        return this.removalQueries;
    }

    has(entity: IQuery<TEntity, TEntity>): boolean {
        return false;
    }

    hasChanges(): boolean {
        return this.removalQueries.length > 0;
    }

    untrack(_: IQuery<TEntity, TEntity>): IQuery<TEntity, TEntity> {
        throw new Error("Unable to remove tracked query");
    }
    untrackMany(_: IQuery<TEntity, TEntity>[]): IQuery<TEntity, TEntity>[] {
        throw new Error("Unable to remove tracked queries");
    }

    trackMany(queries: IQuery<TEntity, TEntity>[], tag: unknown | null): IQuery<TEntity, TEntity>[] {
        this.removalQueries.push(...queries);

        if (tag != null) {
            this.tagCollection.setMany(queries, tag);
        }

        return queries;
    }

    track(query: IQuery<TEntity, TEntity>, tag: unknown | null): IQuery<TEntity, TEntity> {
        this.removalQueries.push(query);

        if (tag != null) {
            this.tagCollection.set(query, tag);
        }

        return query;
    }

    clear(): void {
        this.removalQueries = [];
    }

    *[Symbol.iterator](): Iterator<IQuery<TEntity, TEntity>, any, any> {
        for (let i = 0, length = this.removalQueries.length; i < length; i++) {
            yield this.removalQueries[i];
        }
    }
}