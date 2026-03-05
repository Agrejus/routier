import { ChangeTrackingType, CompiledSchema, IdType, InferCreateType, InferType } from "@routier/core/schema";
import { ChangeTrackedEntity } from "../types";
import { KnownKeyAdditions } from "./additions/KnownKeyAdditions";
import { IAdditions } from "./additions/types";
import { UnknownKeyAdditions } from "./additions/UnknownKeyAdditions";
import { EntityChangeType, EntityUpdateInfo } from "@routier/core/plugins";
import { SchemaPersistResult, TagCollection } from "@routier/core/collections";
import { GenericFunction } from "@routier/core/types";
import { CallbackResult, Result } from "@routier/core/results";
import { assertIsNotNull } from "@routier/core";


export class ChangeTracker<TEntity extends {}> {

    protected removals: InferType<TEntity>[] = [];
    protected canonicalAttachments: Map<IdType, { doc: InferType<TEntity>, changeType: EntityChangeType }> = new Map<IdType, { doc: InferType<TEntity>, changeType: EntityChangeType }>();
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
        get: () => this.resolveTagCollection(),
        destroy: () => { this._tagCollection = null; }
    }

    protected hasAttachmentsChanges() {

        let hasChanges = false;

        for (const [, canonicalAttachment] of this.canonicalAttachments) {

            const changeTrackedDoc = canonicalAttachment.doc as unknown as ChangeTrackedEntity<{}>;
            const changeType = canonicalAttachment.changeType;

            if (changeTrackedDoc.__tracking__?.isDirty === true || changeType !== "notModified") {
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

    mergeChanges(changes: SchemaPersistResult<TEntity>) {
        const { updates, adds, removes } = changes;
        const result: {
            updates: InferType<TEntity>[],
            adds: InferType<TEntity>[],
            removals: InferType<TEntity>[],
        } = {
            updates: Array.from({ length: updates.length }),
            adds: Array.from({ length: adds.length }),
            removals: Array.from({ length: removes.length }),
        }

        for (let i = 0, length = updates.length; i < length; i++) {
            const update = updates[i];
            const id = this.schema.getId(update);
            const found = this.canonicalAttachments.get(id);
            // Optimized: cache found.doc since it's accessed twice (line 83 and 84)
            const foundDoc = found.doc;

            // Let's only map Ids and identities
            this.schema.merge(foundDoc, update); // merge needs to map children appropriately
            result.updates[i] = this.schema.clone(foundDoc);
        }

        for (let i = 0, length = adds.length; i < length; i++) {
            const add = adds[i];

            // Need to deserialize so we can match properly
            const deserializedAdd = this.schema.deserialize(add);

            const found = this.additions.get(deserializedAdd);

            assertIsNotNull(found, () => {

                return `Cannot find internal addition, please check the following:
                
1. Entire document must be returned from the plugin for adds
2. Serialization/deserialization must be set at the schema level if the underlying datastore does not support certain types. Ex.  Sqlite stores booleans as integers
3. If sending over HTTP, remember, undefined will be serialzied as null over the wire.  Please use .nullable().default(() => null) to replace optional properties

Canonical Documents: ${JSON.stringify([...this.canonicalAttachments.entries()], null, 2)}

Plugin Document: ${JSON.stringify(add, null, 2)}`
            });

            // Let's only map Ids and identities
            this.schema.merge(found, deserializedAdd); // merge needs to map children appropriately

            result.adds[i] = this.schema.clone(found as InferType<TEntity>);

            const id = this.schema.getId(add);

            // Set here, if we never save we should never attach
            this.canonicalAttachments.set(id, {
                doc: found as InferType<TEntity>,
                changeType: "notModified" // since we just added it, mark it as not modified
            });
        }
        // nothing to merge here, use the attached removals
        result.removals = this.removals;

        return result;
    }

    prepareRemovals(): InferType<TEntity>[] {
        const entities = Array.from<InferType<TEntity>>({ length: this.removals.length });
        for (let i = 0, length = this.removals.length; i < length; i++) {
            entities[i] = this.schema.prepare(this.removals[i]);
        }

        return entities;
    }

    getAttachmentsChanges(): EntityUpdateInfo<TEntity>[] {
        const changes: EntityUpdateInfo<TEntity>[] = [];

        for (const [, canonicalAttachment] of this.canonicalAttachments) {
            const changeTrackedDoc = canonicalAttachment.doc as unknown as ChangeTrackedEntity<{}>;
            // Optimized: cache __tracking__ since it's accessed twice (line 149 and 158)
            const tracking = changeTrackedDoc.__tracking__;

            let changeType: EntityChangeType = "notModified";

            if (canonicalAttachment.changeType === "markedDirty") {
                changeType = "markedDirty"
            }

            // property changes are marked as not modified, we need to make
            // sure we check before we look at the change type
            if (tracking?.isDirty === true) {
                changeType = "propertiesChanged"
            }

            if (changeType === "notModified") {
                continue;
            }

            const serializedEntity = this.schema.preprocess(changeTrackedDoc as InferCreateType<TEntity>);
            changes.push({ entity: serializedEntity, delta: this.schema.serialize(tracking.changes as InferType<TEntity>), changeType })
        }

        return changes
    }

    markDirty(entities: InferType<TEntity>[]) {
        for (let i = 0, length = entities.length; i < length; ++i) {
            const entity = entities[i];
            const key = this.schema.getId(entity);
            const existing = this.canonicalAttachments.get(key);

            existing.changeType = "markedDirty";
        }
    }

    isAttached(entity: InferType<TEntity>) {
        const key = this.schema.getId(entity);
        return this.canonicalAttachments.has(key);
    }

    getAttached(entity: InferType<TEntity>) {
        const key = this.schema.getId(entity);

        const found = this.canonicalAttachments.get(key);

        if (found == null) {
            return undefined;
        }

        if (found.changeType === "notModified") {
            const resolvedChangeType = this.resolveChangeType(found.doc);

            return {
                doc: found.doc,
                changeType: resolvedChangeType
            }
        }

        return found;
    }

    findAttached(selector: GenericFunction<InferType<TEntity>, boolean>) {
        for (const [, canonicalAttachment] of this.canonicalAttachments) {
            const document = canonicalAttachment.doc;
            if (selector(document)) {
                return document;
            }
        }

        return undefined;
    }

    filterAttached(selector: GenericFunction<InferType<TEntity>, boolean>) {
        const result: InferType<TEntity>[] = [];
        for (const [, canonicalAttachment] of this.canonicalAttachments) {
            const document = canonicalAttachment.doc;
            if (selector(document) === false) {
                continue;
            }

            result.push(document);
        }

        return result;
    }

    private resolveChangeType(entity: InferType<TEntity>): EntityChangeType {
        const changeTrackedDoc = entity as unknown as ChangeTrackedEntity<{}>;

        if (changeTrackedDoc.__tracking__?.isDirty === true) {
            return "propertiesChanged"
        }

        return "notModified";
    }

    // Checks to see if the entity already has a canonical attachment; if so merge, otherwise attach.
    resolve(entity: InferType<TEntity>, tag: unknown | null, options?: { merge?: boolean }) {

        const key = this.schema.getId(entity);
        const existing = this.canonicalAttachments.get(key);

        if (existing != null) {
            if (options?.merge === true) {
                this.schema.merge(existing.doc, entity); // merge needs to map children appropriately
            }

            if (tag != null) {
                const tagCollection = this.resolveTagCollection();
                tagCollection.set(existing, tag);
            }

            return existing.doc
        }


        const changeType = this.resolveChangeType(entity);
        this.canonicalAttachments.set(key, { doc: entity, changeType });

        if (tag != null) {
            const tagCollection = this.resolveTagCollection();
            tagCollection.set(entity, tag);
        }

        return entity;
    }

    resolveMany(entities: InferType<TEntity>[], tag: unknown | null, options?: { merge?: boolean }) {
        const result = Array.from<InferType<TEntity>>({ length: entities.length });

        for (let i = 0, length = entities.length; i < length; i++) {
            result[i] = this.resolve(entities[i], tag, options);
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

    replaceAttachment(existingEntity: InferType<TEntity> | InferCreateType<TEntity>, newEntity: InferType<TEntity> | InferCreateType<TEntity>) {
        for (const [key, canonicalAttachment] of this.canonicalAttachments) {

            if (canonicalAttachment.doc === existingEntity) {
                this.canonicalAttachments.set(key, {
                    doc: newEntity as InferType<TEntity>,
                    changeType: canonicalAttachment.changeType
                });
                return;
            }
        }
    }

    hasChanges(): boolean {
        return this.additions.size > 0 || this.removals.length > 0 || this.hasAttachmentsChanges() === true;
    }

    add(entities: InferCreateType<TEntity>[], tag: unknown | null, done: CallbackResult<InferType<TEntity>[]>) {
        try {
            const length = entities.length;
            const result: InferType<TEntity>[] = Array.from({ length });
            const tagCollection = tag != null ? this.resolveTagCollection() : null;

            for (let i = 0; i < length; i++) {
                const entity = this.schema.enrich(entities[i], "proxy");
                this.additions.set(entity);
                result[i] = entity as InferType<TEntity>;

                if (tagCollection != null) {
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
            yield this.schema.enrich(entities[i], changeTrackingType);
        }
    }

    postprocess(entities: InferType<TEntity>[], changeTrackingType: ChangeTrackingType) {
        const result = Array.from({ length: entities.length });

        for (let i = 0, length = entities.length; i < length; i++) {
            result[i] = this.schema.postprocess(entities[i], changeTrackingType);
        }

        return result;
    }

    enrich(entities: InferType<TEntity>[], changeTrackingType: ChangeTrackingType) {
        const result = Array.from({ length: entities.length });

        for (let i = 0, length = entities.length; i < length; i++) {
            result[i] = this.schema.enrich(entities[i], changeTrackingType);
        }

        return result;
    }

    detach(entities: InferType<TEntity>[]): InferType<TEntity>[] {
        const result: InferType<TEntity>[] = [];

        for (let i = 0, length = entities.length; i < length; i++) {
            const entity = entities[i];
            const id = this.schema.getId(entity);

            if (this.canonicalAttachments.has(id) == false) {
                continue;
            }

            const found = this.canonicalAttachments.get(id);

            assertIsNotNull(found, `Could not find entity to detach for Id. Id: ${id}`);

            this.canonicalAttachments.delete(id);
            result.push(found.doc);
        }

        return result;
    }

    prepareAdditions(): InferCreateType<TEntity>[] {
        const size = this.additions.size;
        if (size === 0) {
            return [];
        }

        const result: InferCreateType<TEntity>[] = Array.from({ length: size });
        let index = 0;

        // prepare the items for saving,
        // this will remove any change tracking.  We do
        // not want to send any change tracked items to the plugin
        // because then they will need to worry about lifecycle management
        // Need to make sure we run any serialization changes as well
        for (const item of this.additions.values()) {
            result[index++] = this.schema.preprocess(item) as InferCreateType<TEntity>;
        }

        return result;
    }

    clearChanges() {
        this.additions.clear();
        this.removals = [];
    }
}   