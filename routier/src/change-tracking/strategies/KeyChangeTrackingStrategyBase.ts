import { CompiledSchema, EntityModificationResult, IdType, InferCreateType, InferType, ChangeTrackingType, TagCollection, EntityChanges, IQuery, EntityUpdateInfo, EntityChangeType, GenericFunction } from "routier-core";
import { ChangeTrackedEntity, EntityCallbackMany } from "../../types";
import { AdditionsPackage } from "../types";

export abstract class KeyChangeTrackingStrategyBase<TKey extends IdType, TEntity extends {}> {

    protected removals: InferType<TEntity>[] = [];
    protected removalQueries: IQuery<TEntity, TEntity>[] = [];
    protected attachments: Map<TKey, { doc: InferType<TEntity>, changeType: EntityChangeType }> = new Map<TKey, { doc: InferType<TEntity>, changeType: EntityChangeType }>();
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

        for (const [, attachment] of this.attachments) {

            const changeTrackedDoc: ChangeTrackedEntity<{}> = attachment.doc as any;

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
            const found = addPackge.find(add as InferType<TEntity>);
            // need to deserialize the add in case there are any dates on it
            const deserializedAdd = this.schema.deserialize(add as InferType<TEntity>);

            // Let's only map Ids and identities
            this.schema.merge(found as InferType<TEntity>, deserializedAdd as InferType<TEntity>); // merge needs to map children appropriately

            const id = this.schema.getId(add as InferType<TEntity>) as TKey;

            // Set here, if we never save we should never attach
            this.attachments.set(id, {
                doc: found as InferType<TEntity>,
                changeType: "notModified" // since we just added it, mark it as not modified
            })
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

    getAttachmentsChanges(): EntityChanges<TEntity>["updates"] {
        const entities = new Map<IdType, EntityUpdateInfo<TEntity>>();

        for (const [, attachment] of this.attachments) {
            const changeTrackedDoc: ChangeTrackedEntity<{}> = attachment.doc as any;

            let changeType: EntityChangeType = "notModified";

            if (attachment.changeType === "markedDirty") {
                changeType = "markedDirty"
            }

            // property changes are marked as not modified, we need to make
            // sure we check before we look at the change type
            if (changeTrackedDoc.__tracking__?.isDirty === true) {
                changeType = "propertiesChanged"
            }

            if (changeType === "notModified") {
                continue;
            }

            const id = this.schema.getId(attachment.doc);
            entities.set(id, { doc: this.schema.prepare(attachment.doc as any) as any, delta: changeTrackedDoc.__tracking__.changes, changeType });
        }

        return {
            entities
        };
    }

    markDirty(entities: InferType<TEntity>[]) {
        for (let i = 0, length = entities.length; i < length; ++i) {
            const entity = entities[i];
            const key = this.schema.getId(entity) as TKey;
            const existing = this.attachments.get(key);

            existing.changeType = "markedDirty";
        }
    }

    isAttached(entity: InferType<TEntity>) {
        const key = this.schema.getId(entity) as TKey;
        return this.attachments.has(key);
    }

    getAttached(entity: InferType<TEntity>) {
        const key = this.schema.getId(entity) as TKey;
        return this.attachments.get(key);
    }

    filterAttached(selector: GenericFunction<InferType<TEntity>, boolean>) {
        for (const [, attachment] of this.attachments) {
            const document = attachment.doc;
            if (selector(document)) {
                return document;
            }
        }

        return undefined;
    }

    // Checks to see if the item is already attached, if so we merge, if not we attach and return each result
    resolve(entities: InferType<TEntity>[], tag: unknown | null, options?: { merge?: boolean }) {

        const result: InferType<TEntity>[] = [];
        for (let i = 0, length = entities.length; i < length; ++i) {
            const entity = entities[i];
            const key = this.schema.getId(entity) as TKey;
            const existing = this.attachments.get(key);

            if (existing != null) {
                if (options?.merge === true) {
                    this.schema.merge(existing.doc, entity); // merge needs to map children appropriately
                }

                result.push(existing.doc);

                if (tag != null) {
                    const tagCollection = this.resolveTagCollection();
                    tagCollection.set(existing, tag);
                }
                continue;
            }

            this.attachments.set(key, { doc: entity, changeType: "propertiesChanged" });
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

            if (document.doc === existingEntity) {
                this.attachments.set(key, {
                    doc: newEntity as InferType<TEntity>,
                    changeType: document.changeType
                });
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

            const found = this.attachments.get(id);
            result.push(found.doc);
        }

        return result;
    }
}   