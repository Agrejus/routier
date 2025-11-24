import { CompiledSchema, HashType, IdType, InferCreateType } from "@routier/core/schema";
import { IChangeTracker } from "../types";
import { IAdditionsCollection } from "../additions/types";
import { UnknownKeyAdditionCollection } from "../additions/UnknownKeyAdditionCollection";
import { KnownKeyAdditionCollection } from "../additions/KnownKeyAdditionCollection";
import { TagCollection } from "@routier/core/collections";

export class ProxyAddChangeTracker<TEntity extends {}> implements IChangeTracker<InferCreateType<TEntity>> {

    protected additions: IAdditionsCollection<TEntity>;
    protected schema: CompiledSchema<TEntity>;
    protected tagCollection: TagCollection

    constructor(
        schema: CompiledSchema<TEntity>,
        tagCollection: TagCollection
    ) {
        this.schema = schema;
        this.tagCollection = tagCollection;

        this.createAdditionsCollection();
    }

    private createAdditionsCollection() {
        if (this.schema.hasIdentityKeys === true) {
            this.additions = new UnknownKeyAdditionCollection<TEntity>(this.schema);
            return;
        }

        this.additions = new KnownKeyAdditionCollection<TEntity>(this.schema);
    }

    get(key: IdType): InferCreateType<TEntity> | undefined {
        return this.additions.get(key);
    }

    compute(): InferCreateType<TEntity>[] {
        if (this.additions.size === 0) {
            return [];
        }

        const result: InferCreateType<TEntity>[] = [];

        // prepare the items for saving,
        // this will remove any change tracking.  We do
        // not want to send any change tracked items to the plugin
        // because then they will need to worry about lifecycle management
        // Need to make sure we run any serialization changes as well
        for (const item of this.additions.values()) {
            result.push(this.schema.preprocess(item) as InferCreateType<TEntity>);
        }

        return result;
    }

    has(entity: InferCreateType<TEntity>): boolean {
        return this.additions.has(entity);
    }

    hasChanges(): boolean {
        return this.additions.size > 0;
    }

    untrack(entity: InferCreateType<TEntity>): InferCreateType<TEntity> {
        const found = this.additions.get(entity);

        if (found == null) {
            throw new Error("Cannot find entity to untrack")
        }

        return found;
    }

    untrackMany(entities: InferCreateType<TEntity>[]): InferCreateType<TEntity>[] {

        for (let i = 0, length = entities.length; i < length; i++) {
            this.untrack(entities[i]);
        }

        return entities;
    }

    track(entity: InferCreateType<TEntity>, tag: unknown | null) {
        const tagCollection = tag != null ? this.tagCollection : null;

        const enrichedEntity = this.schema.enrich(entity, "proxy");
        this.additions.set(enrichedEntity as InferCreateType<TEntity>);

        if (tagCollection != null) {
            tagCollection.set(enrichedEntity, tag);
        }

        return enrichedEntity;
    }

    trackMany(entities: InferCreateType<TEntity>[], tag: unknown | null) {
        const length = entities.length;
        const result: InferCreateType<TEntity>[] = new Array(length);

        for (let i = 0; i < length; i++) {
            result[i] = this.track(entities[i], tag);
        }

        return result
    }

    clear(): void {
        this.createAdditionsCollection();
    }

    *[Symbol.iterator](): Iterator<InferCreateType<TEntity>, any, any> {
        for (const entity of this.additions.values()) {
            yield entity;
        }
    }
}