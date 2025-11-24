import { EntityChangeType, EntityUpdateInfo } from "@routier/core/plugins";
import { IChangeTracker } from "../types";
import { CompiledSchema, IdType, InferCreateType, InferType } from "@routier/core/schema";
import { ChangeTrackedEntity } from "../../types";
import { TagCollection } from "@routier/core/collections";

type Update<TEntity extends {}> = { doc: InferType<TEntity>, changeType: EntityChangeType }

export class ProxyUpdateChangeTracker<TEntity extends {}> implements IChangeTracker<InferType<TEntity>, EntityUpdateInfo<InferType<TEntity>>> {

    protected attachments: Map<IdType, Update<TEntity>> = new Map<IdType, Update<TEntity>>();
    protected schema: CompiledSchema<TEntity>;
    protected tagCollection: TagCollection

    constructor(
        schema: CompiledSchema<TEntity>,
        tagCollection: TagCollection
    ) {
        this.schema = schema;
        this.tagCollection = tagCollection;
    }

    private resolveChangeType(entity: InferType<TEntity>): EntityChangeType {
        const changeTrackedDoc: ChangeTrackedEntity<{}> = entity as any;

        if (changeTrackedDoc.__tracking__?.isDirty === true) {
            return "propertiesChanged"
        }

        return "notModified";
    }

    get(key: IdType): EntityUpdateInfo<InferType<TEntity>> | undefined {

        const found = this.attachments.get(key);

        if (!found) {
            return undefined;
        }

        const changeTrackedDoc: ChangeTrackedEntity<{}> = found.doc as any;
        const changeType = this.getChangeType(found);
        const delta = changeTrackedDoc.__tracking__ == null ? {} : changeTrackedDoc.__tracking__.changes;

        return {
            changeType,
            delta,
            entity: found.doc
        }
    }

    private getChangeType(attachment: Update<TEntity>) {
        const changeTrackedDoc: ChangeTrackedEntity<{}> = attachment.doc as any;

        if (attachment.changeType === "markedDirty") {
            return attachment.changeType;
        }

        // property changes are marked as not modified, we need to make
        // sure we check before we look at the change type
        if (changeTrackedDoc.__tracking__?.isDirty === true) {
            return "propertiesChanged";
        }

        return "notModified";
    }

    compute(): EntityUpdateInfo<InferType<TEntity>>[] {
        const changes: EntityUpdateInfo<InferType<TEntity>>[] = [];

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

            const serializedEntity = this.schema.preprocess(changeTrackedDoc as InferCreateType<TEntity>);
            const delta = changeTrackedDoc.__tracking__ == null ? {} : this.schema.serialize(changeTrackedDoc.__tracking__.changes as InferType<TEntity>);
            changes.push({
                entity: serializedEntity,
                delta,
                changeType
            });
        }

        return changes
    }

    has(entity: InferType<TEntity>): boolean {
        const key = this.schema.getId(entity);
        return this.attachments.has(key);
    }

    untrack(entity: InferType<TEntity>): InferType<TEntity> {
        const key = this.schema.getId(entity);

        if (this.attachments.delete(key) === false) {
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

    hasChanges(): boolean {
        let hasChanges = false;

        for (const [, attachment] of this.attachments) {

            const changeTrackedDoc: ChangeTrackedEntity<{}> = attachment.doc as any;
            const changeType = attachment.changeType;

            if (changeTrackedDoc.__tracking__?.isDirty === true || changeType !== "notModified") {
                hasChanges = true;
                break
            }
        }

        return hasChanges;
    }

    track(entity: InferType<TEntity>, tag: unknown | null) {
        const key = this.schema.getId(entity);
        const existing = this.attachments.get(key);

        if (existing != null) {
            this.schema.merge(existing.doc, entity); // merge needs to map children appropriately

            if (tag != null) {
                this.tagCollection.set(existing, tag);
            }

            return existing.doc
        }


        const changeType = this.resolveChangeType(entity);
        this.attachments.set(key, { doc: entity, changeType });

        if (tag != null) {
            this.tagCollection.set(entity, tag);
        }

        return entity;
    }

    trackMany(entities: InferType<TEntity>[], tag: unknown | null): InferType<TEntity>[] {
        const result = new Array<InferType<TEntity>>(entities.length);

        for (let i = 0, length = entities.length; i < length; i++) {
            result[i] = this.track(entities[i], tag);
        }

        return result;
    }

    clear(): void {
        this.attachments.clear();
    }

    *[Symbol.iterator](): Iterator<EntityUpdateInfo<InferType<TEntity>>, any, any> {
        const changes = this.compute();
        for (const change of changes) {
            yield change;
        }
    }
}