import { CompiledSchema, EntityModificationResult, IdType, InferCreateType, InferType, ChangeTrackingType, TagCollection, EntityChanges, Expression, IQuery } from "routier-core";
import { ChangeTrackedEntity, EntityCallbackMany } from "../../types";
import { ResolveOptions } from "../../data-access/types";
import { AdditionsPackage } from "../types";

export abstract class KeyChangeTrackingStrategyBase<TKey extends IdType, TEntity extends {}> {

    protected removals: InferType<TEntity>[] = [];
    protected removalQueries: IQuery<TEntity, TEntity>[] = [];
    protected attachments: Map<TKey, InferType<TEntity>> = new Map<TKey, InferType<TEntity>>();
    protected schema: CompiledSchema<TEntity>;
    protected abstract setAddition(enriched: InferCreateType<TEntity>): void;
    protected _tagCollection: TagCollection | null = null;

    constructor(
        schema: CompiledSchema<TEntity>,
    ) {
        this.schema = schema;
    }

    getAndDestroyTags() {
        const tagCollection = this._tagCollection;

        this._tagCollection = null;

        return tagCollection;
    }

    protected hasAttachmentsChanges() {

        let hasChanges = false;

        for (const [, doc] of this.attachments) {

            const changeTrackedDoc: ChangeTrackedEntity<{}> = doc as any;

            if (changeTrackedDoc.__tracking__?.isDirty === true) {
                hasChanges = true;
                break
            }
        }

        return hasChanges;
    }

    private resolveTagCollection() {

        if (this._tagCollection == null) {
            this._tagCollection = new TagCollection();
        }

        return this._tagCollection;
    }

    mergeChanges(changes: EntityModificationResult<TEntity>, addPackge: AdditionsPackage<TEntity>) {

        const { updates, adds } = changes;

        updates.forEach(update => {
            const id = this.schema.getId(update as any) as TKey;
            const found = this.attachments.get(id);

            // Let's only map Ids and identities
            this.schema.merge(found as any, update as any); // merge needs to map children appropriately
        });

        adds.forEach(add => {
            const found = addPackge.find(add as any);

            // Let's only map Ids and identities
            this.schema.merge(found as any, add as any); // merge needs to map children appropriately

            const id = this.schema.getId(add as any) as TKey;

            // Set here, if we never save we should never attach
            this.attachments.set(id, found as any)
        });
    }

    prepareRemovals(): EntityChanges<TEntity>["removes"] {
        const entities: InferType<TEntity>[] = [];
        for (let i = 0, length = this.removals.length; i < length; i++) {
            entities.push(this.schema.prepare(this.removals[i] as any) as any);
        }
        return {
            entities,
            queries: this.removalQueries
        };
    }

    getAttachmentsChanges() {
        const entities = new Map<IdType, { doc: InferType<TEntity>, delta: { [key: string]: string | number | Date } }>();

        for (const [, doc] of this.attachments) {
            const changeTrackedDoc: ChangeTrackedEntity<{}> = doc as any;

            if (!changeTrackedDoc.__tracking__?.isDirty) {
                continue;
            }

            const id = this.schema.getId(doc);
            entities.set(id, { doc: this.schema.prepare(doc as any) as any, delta: changeTrackedDoc.__tracking__.changes });
        }

        return {
            entities
        };
    }

    // Checks to see if the item is already attached, if so we merge, if not we attach and return each result
    resolve(entities: InferType<TEntity>[], tag: unknown | null, options?: ResolveOptions) {

        const result: InferType<TEntity>[] = [];
        for (let i = 0, length = entities.length; i < length; ++i) {
            const entity = entities[i];
            const key = this.schema.getId(entity) as TKey;
            const existing = this.attachments.get(key);

            if (existing != null) {
                if (options?.merge === true) {
                    this.schema.merge(existing, entity); // merge needs to map children appropriately
                }

                result.push(existing);

                if (tag != null) {
                    const tagCollection = this.resolveTagCollection();
                    tagCollection.set(existing, tag);
                }
                continue;
            }

            this.attachments.set(key, entity);
            result.push(entity);

            if (tag != null) {
                const tagCollection = this.resolveTagCollection();
                tagCollection.set(entity, tag);
            }
        }

        return result;
    }

    remove(entities: InferType<TEntity>[], tag: unknown | null, done: EntityCallbackMany<TEntity>) {
        this.removals.push(...entities);

        if (tag != null) {
            const tagCollection = this.resolveTagCollection();
            tagCollection.setMany(entities, tag);
        }

        done(entities);
    }

    removeByQuery(query: IQuery<TEntity, TEntity>, tag: unknown | null, done: (error?: any) => void) {
        try {
            this.removalQueries.push(query);

            if (tag != null) {
                const tagCollection = this.resolveTagCollection();
                tagCollection.set(query, tag);
            }

            done();
        } catch (e) {
            done(e)
        }
    }

    replaceAttachment(existingEntity: InferType<TEntity> | InferCreateType<TEntity>, newEntity: InferType<TEntity> | InferCreateType<TEntity>) {
        for (const [key, document] of this.attachments) {

            if (document === existingEntity) {
                this.attachments.set(key, newEntity as InferType<TEntity>);
                return;
            }
        }
    }

    protected _add(entities: InferCreateType<TEntity>[], tag: unknown | null, changeTrackingType: ChangeTrackingType, done: EntityCallbackMany<TEntity>) {

        try {

            const result: InferType<TEntity>[] = [];

            for (const entity of this.instance(entities, changeTrackingType)) {
                this.setAddition(entity as InferCreateType<TEntity>);

                result.push(entity);

                if (tag != null) {
                    const tagCollection = this.resolveTagCollection();
                    tagCollection.set(entity, tag);
                }
            }

            done(result);
        } catch (e: any) {
            done([], e);
        }
    }

    // Use a generator so we don't need to inject another done function so we can set the addition in the add function
    *instance(entities: InferCreateType<TEntity>[], changeTrackingType: ChangeTrackingType) {

        for (let i = 0, length = entities.length; i < length; ++i) {
            const entity = entities[i];
            const enriched: InferCreateType<TEntity> = this.schema.enrich(entity as any, changeTrackingType) as any;

            yield enriched as InferType<TEntity>;
        }
    }

    enrich(entities: InferType<TEntity>[]) {
        const result = [];

        for (let i = 0, length = entities.length; i < length; i++) {
            result.push(this.schema.enrich(entities[i], "entity"));
        }

        return result;
    }

    detach(entities: InferType<TEntity>[]): InferType<TEntity>[] {
        const result: InferType<TEntity>[] = [];

        for (let i = 0, length = entities.length; i < length; i++) {
            const entity = entities[i];
            const id = this.schema.getId(entity) as TKey;

            if (this.attachments.has(id) == false) {
                continue;
            }

            result.push(this.attachments.get(id));
        }

        return result;
    }
}   