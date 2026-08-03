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
import { applyPatch, ImmutableUpdates, UpdateRecipe } from "./ImmutableUpdates";


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

/**
 * A row added through `add()`, tracked by object reference rather than by id.
 *
 * `state` is what a caller's reference means at the moment it is used again:
 *  - `pending` — still an unsaved addition; a patch rewrites it in place of an INSERT.
 *  - `saved` — persisted; `current` now carries the assigned identity, so a patch becomes
 *    an ordinary update against the attachment.
 *  - `discarded` — its save failed, or the changes were cleared. Patching it must not
 *    resurrect the row, so it falls through to the "not attached" error.
 */
type UnsavedRow<TEntity extends {}> = {
    current: InferCreateType<TEntity>;
    state: "pending" | "saved" | "discarded";
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
    /**
     * Every generation of an added-but-unsaved row, mapped to the slot holding its current
     * value.
     *
     * An unsaved row cannot be resolved the way `update()` resolves a saved one. That path
     * reads the id and looks the row up, and an identity-keyed row has no id until the
     * database assigns one — which is why updating one used to throw. There is also nothing
     * else stable to key on: `UnknownKeyAdditions` keys pending adds by content hash, so the
     * first patch moves the key.
     *
     * The object reference is the only stable handle, so it is the key. Each `update()`
     * registers the value it returns against the SAME slot, which is what keeps a stale
     * reference working here as well: generation 1 and generation 7 both resolve to the row.
     * A WeakMap so an abandoned generation is collectable — a long chain of updates before a
     * save would otherwise pin every intermediate value for the life of the collection.
     *
     * The slot outlives the save deliberately. Once the row is persisted it flips to
     * `"saved"` and later updates route to the ordinary id-based path — but they route there
     * through `slot.current`, which is the generation that actually received the assigned
     * identity. Without that hop a reference taken before the save could never be resolved
     * again, because it has no id and never will.
     */
    private readonly unsavedRows = new WeakMap<object, UnsavedRow<TEntity>>();
    /**
     * The slots created since the last save, so they can be invalidated when their pending
     * additions are dropped. A WeakMap cannot be enumerated, and a stale slot is not merely
     * useless: patching one would put its row back into `additions` and insert a row the
     * caller had every reason to think was gone.
     */
    private unsavedSlots: UnsavedRow<TEntity>[] = [];

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

            // A row changed through `update()` gets its persisted value ADOPTED as the new
            // canonical rather than merged into the old one. Two reasons, and the second is
            // fatal without this: merging is pointless when the new value is already
            // complete, and on an immutable collection the old canonical is frozen, so
            // writing into it throws.
            if (this.immutable.has(id)) {
                this.attach(id, deserializedUpdate as InferType<TEntity>, "notModified");
                result.updates[i] = this.schema.clone(deserializedUpdate as InferType<TEntity>);
                continue;
            }

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

            const found = this.additions.take(deserializedAdd);

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

            // `found` is the generation the merge just gave the assigned identity to, so it
            // is the only one a later `update()` can resolve by id. Point the slot at it and
            // every reference the caller holds — including the one from before the save —
            // keeps working.
            const slot = this.unsavedRows.get(found as object);

            if (slot != null) {
                slot.current = found;
                slot.state = "saved";
            }
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
            changes.push({ entity: serializedEntity, delta: this.serializeDelta(serializedEntity, tracking.changes), changeType })
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
            const serializedEntity = this.schema.preprocess(update.current as InferCreateType<TEntity>);
            changes.push({
                entity: serializedEntity,
                delta: this.serializeDelta(serializedEntity, update.patch),
                changeType: "propertiesChanged",
            });
        }

        return changes
    }

    /**
     * The changed properties of the entity, keyed by storage-side name, selected from the
     * COMPLETE already-serialized entity.
     *
     * Deliberately NOT `schema.serialize(patch)`. A patch is partial (and on the proxy path
     * it is a FLAT map keyed by dotted path, e.g. `{ "nested.inner.value": "y" }`), so
     * handing it to the generated serializer walks branches the patch omits — the depth-2
     * throw of defect #13 — and a dotted key never matches an entity-shaped walk at all.
     * Selecting changed roots out of the complete serialized entity sidesteps both: every
     * value has already been through its property's real serializer, and a dotted path only
     * needs its root segment to select the right storage key. A nested subtree is therefore
     * always sent whole, which is also what the JSON-column consumers require (a partial
     * subtree would overwrite the siblings that did not change).
     */
    private serializeDelta(serializedEntity: Record<string, unknown>, patch: Record<string, any>) {
        const roots = this.schema.properties.filter(p => p.parent == null);
        const delta: Record<string, unknown> = {};

        for (const key of Object.keys(patch)) {
            // Proxy-path change keys are dotted paths ("nested.inner.value", "values.2");
            // only the root segment names a storage column
            const rootKey = key.split(".")[0];
            const property = roots.find(p => p.name === rootKey) ?? roots.find(p => p.getResolvedName() === rootKey);

            if (property == null) {
                continue;
            }

            const column = property.getResolvedName();
            delta[column] = serializedEntity[column];
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
        const unsaved = this.unsavedRows.get(entity as object);

        if (unsaved?.state === "pending") {
            return this.updateUnsaved(unsaved, recipe);
        }

        // A saved row is resolved through the slot rather than through the caller's
        // reference: an identity-keyed row only ever received its id on ONE generation, and
        // that is the one the slot holds.
        const resolvable = unsaved?.state === "saved"
            ? unsaved.current as InferType<TEntity>
            : entity;

        return this.immutable.update(
            resolvable,
            recipe,
            id => this.canonicalAttachments.get(id)?.doc
        );
    }

    /** Registers the first generation of an added row. */
    private trackUnsaved(entity: InferCreateType<TEntity>) {
        const slot: UnsavedRow<TEntity> = { current: entity, state: "pending" };

        this.unsavedRows.set(entity as object, slot);
        this.unsavedSlots.push(slot);
    }

    /**
     * Patches a row that has been added but not yet saved.
     *
     * The new value replaces the pending addition outright — there is no delta to record,
     * because an unsaved row is sent to the plugin whole. That also means a patch and a
     * later save produce one INSERT with the final values rather than an INSERT followed by
     * an UPDATE.
     *
     * The result is NOT frozen, even on an immutable collection. Freezing is deliberately
     * kept off the add path (see `QueryableExecutor.attachResults`) because `mergeChanges`
     * has to write the database's assigned identity back into the entity it just persisted.
     * Reads are frozen; a row you are still composing is not.
     */
    private updateUnsaved(slot: UnsavedRow<TEntity>, recipe: UpdateRecipe<TEntity>) {
        const base = slot.current;

        const next = typeof recipe === "function"
            ? recipe(base as InferType<TEntity>)
            : applyPatch(base as Record<string, any>, recipe) as InferType<TEntity>;

        this.additions.replace(base, next as InferCreateType<TEntity>);

        slot.current = next as InferCreateType<TEntity>;
        this.unsavedRows.set(next as object, slot);

        return next;
    }

    /** The current value of a row: its pending version if any, otherwise the attached one. */
    currentOf(entity: InferType<TEntity>) {
        const unsaved = this.unsavedRows.get(entity as object);

        if (unsaved?.state === "pending") {
            return unsaved.current as InferType<TEntity>;
        }

        const id = this.schema.getId(
            unsaved?.state === "saved" ? unsaved.current as InferType<TEntity> : entity
        );

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
                this.trackUnsaved(entity);
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

        // Whatever is still pending here never made it to the database — either the save
        // failed or the changes were dropped. Its slot has to stop accepting patches, or the
        // next `update()` through a reference to it would re-enter it into `additions`.
        // Slots the merge already flipped to "saved" are left alone: those rows exist.
        for (const slot of this.unsavedSlots) {
            if (slot.state === "pending") {
                slot.state = "discarded";
            }
        }

        this.unsavedSlots = [];
        // Pending patches are discarded here rather than per-entity. There is no dirty flag
        // to reset, which is the whole reason defect #11 cannot recur on this path.
        this.immutable.clear();
    }
}   