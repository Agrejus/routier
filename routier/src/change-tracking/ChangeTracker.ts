import { CallbackResult, ChangeTrackingType, CollectionChangesResult, CompiledSchema, EntityChangeType, EntityUpdateInfo, GenericFunction, IdType, InferCreateType, InferType, IQuery, Result, TagCollection } from "routier-core";
import { ChangeTrackedEntity } from "../types";
import { KnownKeyAdditions } from "./additions/KnownKeyAdditions";
import { IAdditions } from "./additions/types";
import { UnknownKeyAdditions } from "./additions/UnknownKeyAdditions";

export class ChangeTracker<TEntity extends {}> {

    protected removals: InferType<TEntity>[] = [];
    protected removalQueries: IQuery<TEntity, TEntity>[] = [];
    protected attachments: Map<IdType, { doc: InferType<TEntity>, changeType: EntityChangeType }> = new Map<IdType, { doc: InferType<TEntity>, changeType: EntityChangeType }>();
    protected schema: CompiledSchema<TEntity>;
    protected _tagCollection: TagCollection | null = null;
    protected additions: IAdditions<TEntity>

    constructor(
        schema: CompiledSchema<TEntity>,
    ) {
        this.schema = schema;

        if (schema.hasIdentityKeys === true) {
            this.additions = new UnknownKeyAdditions<TEntity>(this.schema);
        } else {
            this.additions = new KnownKeyAdditions<TEntity>(this.schema);
        }
    }

    tags = {
        get: () => this._tagCollection,
        destroy: () => { this._tagCollection = null; }
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

    mergeChanges(changes: CollectionChangesResult<TEntity>) {

        const { updates, adds } = changes;

        updates.entities.forEach(update => {
            const id = this.schema.getId(update);
            const found = this.attachments.get(id);

            // Let's only map Ids and identities
            this.schema.merge(found.doc as InferType<TEntity>, update); // merge needs to map children appropriately
        });

        adds.entities.forEach(add => {
            const found = this.additions.get(add as InferType<TEntity>);
            // need to deserialize the add in case there are any dates on it
            const deserializedAdd = this.schema.deserialize(add as InferType<TEntity>);

            // Let's only map Ids and identities
            this.schema.merge(found as InferType<TEntity>, deserializedAdd as InferType<TEntity>); // merge needs to map children appropriately

            const id = this.schema.getId(add as InferType<TEntity>);

            // if (changeTrackedDoc.__tracking__?.isDirty === true) {
            //     hasChanges = true;
            //     break
            // }

            // Set here, if we never save we should never attach
            this.attachments.set(id, {
                doc: found as InferType<TEntity>,
                changeType: "notModified" // since we just added it, mark it as not modified
            });
        });
    }

    prepareRemovals(): {
        entities: InferType<TEntity>[];
        queries: IQuery<TEntity, TEntity>[];
    } {
        const entities: InferType<TEntity>[] = [];
        for (let i = 0, length = this.removals.length; i < length; i++) {
            entities.push(this.schema.prepare(this.removals[i] as any) as any);
        }

        return {
            entities,
            queries: this.removalQueries
        };
    }

    getAttachmentsChanges(): EntityUpdateInfo<TEntity>[] {
        const changes: EntityUpdateInfo<TEntity>[] = [];

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

            changes.push({ entity: this.schema.prepare(attachment.doc as InferCreateType<TEntity>) as InferType<TEntity>, delta: changeTrackedDoc.__tracking__.changes, changeType })
        }

        return changes
    }

    markDirty(entities: InferType<TEntity>[]) {
        for (let i = 0, length = entities.length; i < length; ++i) {
            const entity = entities[i];
            const key = this.schema.getId(entity);
            const existing = this.attachments.get(key);

            existing.changeType = "markedDirty";
        }
    }

    isAttached(entity: InferType<TEntity>) {
        const key = this.schema.getId(entity);
        return this.attachments.has(key);
    }

    getAttached(entity: InferType<TEntity>) {
        const key = this.schema.getId(entity);
        return this.attachments.get(key);
    }

    findAttached(selector: GenericFunction<InferType<TEntity>, boolean>) {
        for (const [, attachment] of this.attachments) {
            const document = attachment.doc;
            if (selector(document)) {
                return document;
            }
        }

        return undefined;
    }

    filterAttached(selector: GenericFunction<InferType<TEntity>, boolean>) {
        const result: InferType<TEntity>[] = [];
        for (const [, attachment] of this.attachments) {
            const document = attachment.doc;
            if (selector(document) === false) {
                continue;
            }

            result.push(document);
        }

        return result;
    }

    // Checks to see if the item is already attached, if so we merge, if not we attach and return each result
    resolve(entities: InferType<TEntity>[], tag: unknown | null, options?: { merge?: boolean }) {

        const result: InferType<TEntity>[] = [];
        for (let i = 0, length = entities.length; i < length; ++i) {
            const entity = entities[i];
            const key = this.schema.getId(entity);
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

    remove(entities: InferType<TEntity>[], tag: unknown | null, done: CallbackResult<InferType<TEntity>[]>) {
        try {
            this.removals.push(...entities);

            if (tag != null) {
                const tagCollection = this.resolveTagCollection();
                tagCollection.setMany(entities, tag);
            }

            done(Result.success(entities));
        } catch (error) {
            done(Result.error(error));
        }
    }

    removeByQuery(query: IQuery<TEntity, TEntity>, tag: unknown | null, done: CallbackResult<never>) {
        try {
            this.removalQueries.push(query);

            if (tag != null) {
                const tagCollection = this.resolveTagCollection();
                tagCollection.set(query, tag);
            }

            done(Result.success());
        } catch (e) {
            done(Result.error(e));
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

    hasChanges(): boolean {
        return this.additions.size > 0 || this.removals.length > 0 || this.hasAttachmentsChanges() === true || this.removalQueries.length > 0;
    }

    add(entities: InferCreateType<TEntity>[], tag: unknown | null, done: CallbackResult<InferType<TEntity>[]>) {

        try {

            const result: InferType<TEntity>[] = [];

            for (const entity of this.instance(entities, "entity")) {
                this.additions.set(entity);

                result.push(entity);

                if (tag != null) {
                    const tagCollection = this.resolveTagCollection();
                    tagCollection.set(entity, tag);
                }
            }

            done(Result.success(result));
        } catch (e: any) {
            done(Result.error(e));
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
            const id = this.schema.getId(entity);

            if (this.attachments.has(id) == false) {
                continue;
            }

            const found = this.attachments.get(id);
            result.push(found.doc);
        }

        return result;
    }

    prepareAdditions(): InferCreateType<TEntity>[] {

        if (this.additions.size === 0) {
            return [];
        }

        return [...this.additions.values()] as InferCreateType<TEntity>[];
    }

    clearAdditions() {
        this.additions.clear();
    }
}   