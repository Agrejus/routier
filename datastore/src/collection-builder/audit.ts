import { BulkPersistChanges, BulkPersistResult } from "@routier/core/collections";
import { CompiledSchema, InferCreateType, SchemaId } from "@routier/core/schema";

/**
 * Auditing, declared on the collection being audited and shaped by the caller.
 *
 * ```ts
 * history = this.collection(historySchema).proxy().create();
 *
 * products = this.collection(productSchema)
 *     .audit(historySchema)
 *     .derive((changes, cb) => {
 *         cb(changes.map(change => ({
 *             collection: change.collection,
 *             operation: change.operation,
 *             changed: JSON.stringify(change.delta),
 *             at: change.at,
 *         })));
 *     })
 *     .proxy()
 *     .create();
 * ```
 *
 * Deliberately the same shape as `view().derive()`: the first call names the shape being
 * produced, and `derive` hands you what happened and a callback to emit rows with. Nothing
 * about the row is decided here — no field names, no conventions, no return-value rules. Not
 * calling `cb` records nothing, which is how a collection audits some operations and not
 * others.
 *
 * `changes` is the whole batch for that collection in one save rather than one call per row,
 * so a caller can collapse ten field edits into one summary row, or emit none.
 *
 * ## Why the rows go in the same save
 *
 * They are appended to the `BulkPersistChanges` already being assembled, so on a backend with
 * an atomic batch the record and the change it describes commit together. An audit trail that
 * can disagree with the data is worse than none, because it is believed.
 */

/** The operation that produced a change. */
export type AuditOperation = "add" | "update" | "remove";

/** One change to the audited collection, as handed to `derive`. */
export type AuditChange<TEntity extends {} = Record<string, unknown>> = {
    /** Collection name of the audited entity. */
    readonly collection: string;
    readonly operation: AuditOperation;
    /**
     * The entity's id, or `undefined` for an add whose identity the database assigns.
     *
     * Not an omission that can be fixed: the row has not been written yet, so no id exists.
     */
    readonly id: unknown;
    /** The entity as submitted. */
    readonly entity: TEntity;
    /** What changed, for an update. Absent for an add and a remove. */
    readonly delta?: Record<string, unknown>;
    /** When the save was submitted. One instant for every change in it. */
    readonly at: Date;
};

/** Receives the batch and emits rows. Called once per save that touched the collection. */
export type AuditDerive<TEntity extends {}, TAudit extends {}> = (
    changes: AuditChange<TEntity>[],
    cb: (rows: InferCreateType<TAudit>[]) => void
) => void;

type Registration = {
    readonly sourceSchemaId: SchemaId;
    readonly auditSchema: CompiledSchema<any>;
    readonly derive: AuditDerive<any, any>;
};

/**
 * Every audit declaration in one store, and the code that runs them.
 *
 * Shared by every collection the way the schema collection is, because the work happens once
 * per SAVE rather than once per collection: the changes have to be fully assembled before any
 * of it can run.
 */
export class AuditRegistry {

    private readonly registrations: Registration[] = [];
    /**
     * Rows added per audit schema in the save currently in flight.
     *
     * Kept so they can be taken back out afterwards — see `detach`. Cleared at the start of
     * every save, so a failed save cannot leave a count behind that corrupts the next one.
     */
    private appended = new Map<SchemaId, number>();

    get isEmpty() {
        return this.registrations.length === 0;
    }

    register(registration: Registration) {
        this.registrations.push(registration);
    }

    /**
     * Runs every declaration against the assembled changes and appends what they emit.
     *
     * After the prepare pipeline, so the batch handed to `derive` is complete — a declaration
     * that ran during its own collection's prepare would see only part of the save, and would
     * depend on the order collections happened to be declared in.
     */
    apply(changes: BulkPersistChanges, schemas: { get: (id: SchemaId) => CompiledSchema<any> | undefined }) {
        this.appended.clear();

        if (this.registrations.length === 0) {
            return;
        }

        // One instant for the whole save, so its rows sort together rather than by how long
        // the loop took.
        const at = new Date();

        for (const registration of this.registrations) {
            const source = changes.get(registration.sourceSchemaId);

            if (source == null || source.hasItems === false) {
                continue;
            }

            const schema = schemas.get(registration.sourceSchemaId);

            if (schema == null) {
                continue;
            }

            const batch = this.describe(schema, source, at);
            const emitted: unknown[] = [];

            registration.derive(batch, rows => {
                for (const row of rows ?? []) {
                    // `preprocess` — defaults applied, then serialized to storage shape —
                    // because these rows never pass through a collection, and a plugin binds
                    // what it is given straight to its driver. A `Date` handed over raw fails
                    // to bind on SQLite, and an audit row almost always has a timestamp.
                    emitted.push(registration.auditSchema.preprocess(row as never));
                }
            });

            if (emitted.length === 0) {
                continue;
            }

            // Appended to the END, which is what lets them be identified again in `detach`.
            changes.resolve(registration.auditSchema.id).adds.push(...emitted as never[]);
            this.appended.set(
                registration.auditSchema.id,
                (this.appended.get(registration.auditSchema.id) ?? 0) + emitted.length
            );
        }
    }

    /** The changes for one collection, in the order the backend will apply them. */
    private describe(schema: CompiledSchema<any>, source: { adds: unknown[], updates: any[], removes: unknown[] }, at: Date): AuditChange<any>[] {
        const idOf = (entity: unknown) => {
            try {
                return schema.getId(entity as never);
            } catch {
                // An add whose identity the database assigns has none yet.
                return undefined;
            }
        };

        const batch: AuditChange<any>[] = [];

        for (const remove of source.removes) {
            batch.push({ collection: schema.collectionName, operation: "remove", id: idOf(remove), entity: remove as never, at });
        }

        for (const update of source.updates) {
            batch.push({
                collection: schema.collectionName,
                operation: "update",
                id: idOf(update.entity),
                entity: update.entity,
                delta: update.delta,
                at,
            });
        }

        for (const add of source.adds) {
            batch.push({ collection: schema.collectionName, operation: "add", id: idOf(add), entity: add as never, at });
        }

        return batch;
    }

    /**
     * Takes the emitted rows back out of the save, before anything else looks at it.
     *
     * They were never submitted by a collection, so nothing tracks them. A store that declares
     * a collection over the audit schema in order to READ it — which is the point of it being
     * an ordinary table — would otherwise find its bucket non-empty and try to match rows its
     * change tracker never sent, failing with "Cannot find internal addition". Leaving them in
     * also makes `saveChangesAsync()` report more additions than the caller made.
     *
     * Removed from both sides: the changes, so `afterPersist` sees nothing to merge, and the
     * result, so the count the caller reads is the count they caused.
     */
    detach(changes: BulkPersistChanges, result: BulkPersistResult | undefined) {
        for (const [schemaId, count] of this.appended) {
            const pending = changes.get(schemaId);

            if (pending != null) {
                pending.adds.splice(Math.max(0, pending.adds.length - count), count);
            }

            const persisted = result?.get(schemaId);

            if (persisted != null) {
                persisted.adds.splice(Math.max(0, persisted.adds.length - count), count);
            }
        }

        this.appended.clear();
    }
}
