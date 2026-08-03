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
import { ImmutableUpdates, UpdateRecipe } from "./ImmutableUpdates";


/**
 * Marks a tracked entity clean after its changes have been persisted.
 *
 * The accumulated edits are dropped in place rather than by replacing `__tracking__`:
 * the change-tracking proxy's `set` trap ignores writes to `__tracking__` itself (see
 * `createChangeTracker` in core/src/schema/SchemaDefinition.ts), so assigning a fresh
 * object through the proxy would silently do nothing. `isPaused` is left alone — whether
 * tracking is paused is a property of the current operation, not of the save.
 */
function markPersisted<TEntity extends {}>(entity: InferType<TEntity>) {
    const tracking = (entity as unknown as ChangeTrackedEntity<{}>).__tracking__;

    if (tracking == null) {
        return;
    }

    tracking.changes = {};
    tracking.original = {};
    tracking.isDirty = false;
}

/**
 * A canonically attached entity, plus a direct handle on its tracking state.
 *
 * `tracking` is a cache of `doc.__tracking__`, and it exists purely for speed. Every save
 * scans every attachment to find the dirty ones, and `doc` is a Proxy — so reading
 * `doc.__tracking__` invokes the proxy's `get` trap once per attached entity, per scan.
 * Measured over 100k attachments: 186ns per entity through the proxy versus 17ns through
 * a direct reference, which is the floor for iterating the Map at all. In other words the
 * trap was the entire cost — 18.6ms of a save that had nothing to do.
 *
 * Correctness does not depend on the cache being populated: `trackingOf` falls back to the
 * proxy read when it is absent, which is exactly the old behaviour. It depends only on the
 * cache never being *stale*, which is why `attach` is the single place an attachment is
 * created.
 */
type Attachment<TEntity extends {}> = {
    doc: InferType<TEntity>;
    changeType: EntityChangeType;
    /** `doc.__tracking__` at attach time. Absent for entities tracked without a proxy. */
    tracking?: ChangeTrackedEntity<{}>["__tracking__"];
};

export class ChangeTracker<TEntity extends {}> {

    protected removals: InferType<TEntity>[] = [];
    protected canonicalAttachments: Map<IdType, Attachment<TEntity>> = new Map<IdType, Attachment<TEntity>>();
    protected schema: CompiledSchema<TEntity>;
    protected _tagCollection: TagCollection | null = null;
    protected additions: IAdditions<TEntity>
    /**
     * Pending immutable updates. SPIKE — runs alongside proxy tracking, see
     * ImmutableUpdates.ts. A row present here is authoritative for its own pending state:
     * `getAttachmentsChanges` skips the proxy scan for it so one change cannot be reported
     * twice.
     */
    readonly immutable: ImmutableUpdates<TEntity>

    constructor(
        schema: CompiledSchema<TEntity>,
    ) {
        this.schema = schema;
        this.immutable = new ImmutableUpdates<TEntity>(schema);

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

    /**
     * The single place a canonical attachment is created.
     *
     * Funnelling every write through here is what makes the `tracking` cache safe: there
     * is exactly one expression computing it from `doc`, so the pair cannot drift apart.
     * Adding a `canonicalAttachments.set` elsewhere would reintroduce that risk.
     */
    private attach(key: IdType, doc: InferType<TEntity>, changeType: EntityChangeType) {
        this.canonicalAttachments.set(key, {
            doc,
            changeType,
            tracking: (doc as unknown as ChangeTrackedEntity<{}>).__tracking__,
        });
    }

    /**
     * An attachment's tracking state, without paying the proxy's `get` trap when possible.
     *
     * The fallback is not defensive padding — entities enriched without a proxy have no
     * `__tracking__` at attach time, and the pause bootstrap can install one afterwards.
     * Reading through `doc` in that case is exactly what the code did before the cache
     * existed, so the slow path is never wrong, only slow.
     */
    private static trackingOf<T extends {}>(attachment: Attachment<T>) {
        return attachment.tracking
            ?? (attachment.doc as unknown as ChangeTrackedEntity<{}>).__tracking__;
    }

    protected hasAttachmentsChanges() {

        let hasChanges = false;

        // `values()` rather than destructured entries: the key is unused here, and
        // destructuring allocates a two-element array per attachment.
        for (const canonicalAttachment of this.canonicalAttachments.values()) {

            const tracking = ChangeTracker.trackingOf(canonicalAttachment);

            if (tracking?.isDirty === true || canonicalAttachment.changeType !== "notModified") {
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

            // Plugin responses are wire-shaped (e.g. sqlite returns dates as strings);
            // deserialize before merging so wire values never leak into tracked entities
            const deserializedUpdate = this.schema.deserialize(update);

            // Let's only map Ids and identities
            this.schema.merge(foundDoc, deserializedUpdate); // merge needs to map children appropriately
            result.updates[i] = this.schema.clone(foundDoc);

            // The update is now persisted, so the entity is no longer dirty. Without this
            // the proxy's accumulated `changes`/`original` survive the save and
            // `getAttachmentsChanges` keeps reporting the entity as `propertiesChanged`
            // on every subsequent save, forever: update counts climb save over save,
            // `previewChanges` never reaches zero pending, and — worst — an entity that
            // was updated and then removed gets its stale update replayed after the
            // removal, reinserting the row.
            markPersisted(foundDoc);
            found.changeType = "notModified";
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
            // notModified: it was just added, so there is nothing pending for it.
            this.attach(id, found as InferType<TEntity>, "notModified");
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

        // This loop runs over EVERY attachment on EVERY save, so its body is kept inline and
        // free of anything proportional to attachment count. Two things were measured to
        // matter at 100k attachments and are deliberately absent:
        //
        //  - destructuring Map entries to get the id, which allocates a two-element array
        //    per attachment (hence `.values()`);
        //  - a per-attachment `immutable.has(id)` probe.
        //
        // Extracting the body into a helper method also cost measurably — one non-inlined
        // call per attachment — so it stays here despite the duplication with the immutable
        // pass below.
        for (const canonicalAttachment of this.canonicalAttachments.values()) {
            const tracking = ChangeTracker.trackingOf(canonicalAttachment);

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

            const serializedEntity = this.schema.preprocess(canonicalAttachment.doc as InferCreateType<TEntity>);
            changes.push({ entity: serializedEntity, delta: this.schema.serialize(tracking.changes as InferType<TEntity>), changeType })
        }

        // An immutably-updated row is normally invisible to the loop above: `update()` never
        // touches the proxy, so the canonical document stays clean. The exception is a row
        // mutated BOTH ways before one save, which would otherwise be sent twice. Deduping
        // here rather than inside the loop keeps the cost proportional to the number of
        // changes instead of the number of attachments.
        if (this.immutable.size > 0 && changes.length > 0) {
            for (let i = changes.length - 1; i >= 0; i--) {
                if (this.immutable.has(this.schema.getId(changes[i].entity))) {
                    changes.splice(i, 1);
                }
            }
        }

        for (const [, update] of this.immutable.entries()) {
            changes.push({
                entity: this.schema.preprocess(update.current as InferCreateType<TEntity>),
                delta: this.serializeDelta(update.current, update.patch),
                changeType: "propertiesChanged",
            });
        }

        return changes
    }

    /**
     * The changed properties of `current`, serialized, keyed by storage-side name.
     *
     * Deliberately NOT `schema.serialize(patch)`. The generated serializer walks the whole
     * entity shape, so handing it a partial entity makes it dereference branches the patch
     * omits: patching only `tags` on a schema that also has `nested.inner` throws
     * `Cannot read properties of undefined (reading 'inner')`. That is the same blind spot
     * defect #6 fixed for `enrich`/`merge` and #13 hit on the delta path — the serializer
     * never received the equivalent guards.
     *
     * Serializing the COMPLETE entity sidesteps it entirely: every nested parent is present,
     * so nothing is dereferenced that does not exist. The changed subset is then selected
     * from the result, which also means each value goes through its property's real
     * serializer rather than a reimplementation of one.
     */
    private serializeDelta(current: InferType<TEntity>, patch: Record<string, any>) {
        const serialized = this.schema.serialize(current) as unknown as Record<string, unknown>;
        const roots = this.schema.properties.filter(p => p.parent == null);
        const delta: Record<string, unknown> = {};

        for (const key of Object.keys(patch)) {
            const property = roots.find(p => p.name === key) ?? roots.find(p => p.getResolvedName() === key);

            if (property == null) {
                continue;
            }

            const column = property.getResolvedName();
            delta[column] = serialized[column];
        }

        return delta as any;
    }

    /**
     * Applies a patch or updater to a row, resolving the caller's reference by id.
     *
     * The reference may be any generation of the row — only its id is read. See
     * ImmutableUpdates.update.
     */
    updateImmutable(entity: InferType<TEntity>, recipe: UpdateRecipe<TEntity>) {
        return this.immutable.update(
            entity,
            recipe,
            id => this.canonicalAttachments.get(id)?.doc
        );
    }

    /** The current value of a row: its pending version if any, otherwise the attached one. */
    currentOf(entity: InferType<TEntity>) {
        const id = this.schema.getId(entity);

        return this.immutable.current(id) ?? this.canonicalAttachments.get(id)?.doc;
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
    resolve(entity: InferType<TEntity>, tag: unknown | null, options?: { merge?: boolean, adopt?: boolean }) {

        const key = this.schema.getId(entity);
        const existing = this.canonicalAttachments.get(key);

        if (existing != null) {

            // An explicit attach adopts the caller's instance as the canonical: the
            // caller will mutate THAT instance, and keeping a previously attached copy
            // canonical would silently drop those mutations on save. The caller's values
            // are authoritative — nothing is merged from the replaced copy
            if (options?.adopt === true && existing.doc !== entity) {
                this.attach(key, entity, existing.changeType);

                if (tag != null) {
                    const tagCollection = this.resolveTagCollection();
                    tagCollection.set(entity, tag);
                }

                return entity;
            }

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
        this.attach(key, entity, changeType);

        if (tag != null) {
            const tagCollection = this.resolveTagCollection();
            tagCollection.set(entity, tag);
        }

        return entity;
    }

    resolveMany(entities: InferType<TEntity>[], tag: unknown | null, options?: { merge?: boolean, adopt?: boolean }) {
        const result = Array.from<InferType<TEntity>>({ length: entities.length });

        for (let i = 0, length = entities.length; i < length; i++) {
            result[i] = this.resolve(entities[i], tag, options);
        }

        return result;
    }

    remove(entities: InferType<TEntity>[], tag: unknown | null, done: CallbackResult<InferType<TEntity>[]>) {
        try {
            this.removals.push(...entities);

            // A pending patch for a row being removed is moot, and replaying it after the
            // delete would reinsert the row — the resurrection half of defect #11.
            for (const entity of entities) {
                this.immutable.forget(this.schema.getId(entity));
            }

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
                this.attach(key, newEntity as InferType<TEntity>, canonicalAttachment.changeType);
                return;
            }
        }
    }

    hasChanges(): boolean {
        return this.additions.size > 0 || this.removals.length > 0 || this.immutable.hasChanges() || this.hasAttachmentsChanges() === true;
    }

    /**
     * @param changeTrackingType supplied by the collection. It used to be hardcoded to
     *   "proxy", which made `.immutable()` and `.diff()` leak proxies through the back door:
     *   an added entity became the canonical attachment, so every later read of that row
     *   handed back the proxy no matter what the query asked for.
     */
    add(
        entities: InferCreateType<TEntity>[],
        tag: unknown | null,
        done: CallbackResult<InferType<TEntity>[]>,
        changeTrackingType: ChangeTrackingType = "proxy"
    ) {
        try {
            const length = entities.length;
            const result: InferType<TEntity>[] = Array.from({ length });
            const tagCollection = tag != null ? this.resolveTagCollection() : null;

            for (let i = 0; i < length; i++) {
                const entity = this.schema.enrich(entities[i], changeTrackingType);
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
        // Pending patches are discarded here rather than per-entity. There is no dirty flag
        // to reset, which is the whole reason defect #11 cannot recur on this path.
        this.immutable.clear();
    }
}   