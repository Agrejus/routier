import { BulkPersistResult, SchemaCollection } from "../collections";
import { CompiledSchema, InferCreateType, SchemaId } from "../schema";
import { PluginEventCallbackPartialResult, PluginEventCallbackResult } from "../results";
import { ITranslatedValue } from "./translators";
import { DbPluginBulkPersistEvent, DbPluginEvent, DbPluginQueryEvent, IDbPlugin } from "./types";

/**
 * Writes a row to a table of your design every time anything changes.
 *
 * History, audit trail, outbox, activity feed — they are the same mechanism with different
 * columns, so this wrapper supplies the mechanism and you supply the columns. It owns nothing
 * about the shape: you declare the schema, and a function turns each change into whatever rows
 * belong in it.
 *
 * ```ts
 * const historySchema = s.define('product_history', {
 *     id: s.string().key().identity(),
 *     collection: s.string(),
 *     operation: s.string(),
 *     entityId: s.string(),
 *     changed: s.string(),
 *     at: s.date(),
 *     actor: s.string(),
 * }).compile();
 *
 * const store = new MyStore(new AuditLogDbPlugin(new SqliteDbPlugin('app.db'), {
 *     schema: historySchema,
 *     entry: change => ({
 *         collection: change.collection,
 *         operation: change.operation,
 *         entityId: String(change.id),
 *         changed: JSON.stringify(change.delta ?? {}),
 *         at: change.at,
 *         actor: currentUser(),
 *     }),
 * }));
 * ```
 *
 * ## The rows go in the same save
 *
 * They are appended to the `bulkPersist` the wrapper is already forwarding, rather than
 * written afterwards. On a backend with an atomic batch that makes the record and the change
 * it describes commit together — an audit trail that can disagree with the data is worse than
 * none, because it is believed. On a backend without one it is still a single round trip.
 *
 * The cost is that a rejected audit row fails the save. That is the right way round: if the
 * trail cannot be written, the change should not happen either.
 *
 * ## What it does not do
 *
 * It does not read. Querying the table is ordinary — declare a collection over the same schema
 * and it is just data. Nothing here filters or hides it.
 *
 * It records what was SUBMITTED, not what the database echoed back. A database-assigned
 * identity is therefore absent from an add's entry: it does not exist yet at the point the
 * change is described. Use `entry` to record what you know, and read the row back if you need
 * what the database decided.
 */

/** The operation that produced a change. */
export type AuditOperation = "add" | "update" | "remove";

/** One change, as handed to `entry`. */
export type AuditChange<TEntity extends {} = Record<string, unknown>> = {
    /** Collection name of the entity that changed — the audited table, not the audit table. */
    readonly collection: string;
    readonly operation: AuditOperation;
    /**
     * The entity's id, or `undefined` for an add whose identity the database assigns.
     *
     * Not an omission that can be fixed: at this point the row has not been written, so no id
     * exists to record.
     */
    readonly id: unknown;
    /** The entity as submitted. */
    readonly entity: TEntity;
    /** What changed, for an update. Absent for an add and a remove. */
    readonly delta?: Record<string, unknown>;
    /** When the save was submitted. The same instant for every change in one save. */
    readonly at: Date;
};

export type AuditLogDbPluginOptions<TAudit extends {} = Record<string, unknown>> = {
    /** The compiled schema for the table the rows go in. You own its shape entirely. */
    readonly schema: CompiledSchema<TAudit>;
    /**
     * Turns one change into what should be stored.
     *
     * Return a row, several rows, or nothing at all — returning `null` or an empty array skips
     * the change, which is how a caller records updates but not reads of a noisy collection,
     * or drops changes to a table that audits itself.
     */
    readonly entry: (change: AuditChange) => InferCreateType<TAudit> | InferCreateType<TAudit>[] | null | undefined;
};

export class AuditLogDbPlugin<TAudit extends {} = Record<string, unknown>> implements IDbPlugin {

    private readonly plugin: IDbPlugin;
    private readonly schema: CompiledSchema<TAudit>;
    private readonly entry: AuditLogDbPluginOptions<TAudit>["entry"];

    constructor(plugin: IDbPlugin, options: AuditLogDbPluginOptions<TAudit>) {
        this.plugin = plugin;
        this.schema = options.schema;
        this.entry = options.entry;
    }

    get identity(): string | undefined {
        return this.plugin.identity;
    }

    query<TRoot extends {}, TShape extends any = TRoot>(
        event: DbPluginQueryEvent<TRoot, TShape>,
        done: PluginEventCallbackResult<ITranslatedValue<TShape>>
    ): void {
        // Reads pass through untouched, including reads OF the audit table. Its rows are
        // ordinary data and hiding them would make the feature harder to use, not safer.
        this.plugin.query(event, done);
    }

    destroy(event: DbPluginEvent, done: PluginEventCallbackResult<never>): void {
        this.plugin.destroy(event, done);
    }

    /**
     * A `SchemaCollection` that also knows the audit schema.
     *
     * The inner plugin looks a schema up by id to build its statements — DDL included — so
     * without this the audit rows arrive for a schema it cannot resolve. Proxying `get` is the
     * same technique `ConcurrencyDbPlugin` uses, and it is `get` specifically because that is
     * the accessor plugins use; iteration is left alone.
     */
    private withAuditSchema(schemas: SchemaCollection): SchemaCollection {
        const auditSchema = this.schema;

        return new Proxy(schemas, {
            get(target, property, receiver) {
                if (property === "get") {
                    return (id: SchemaId) => id === auditSchema.id ? auditSchema : target.get(id);
                }

                return Reflect.get(target, property, receiver);
            },
        });
    }

    /** Every change in the save, in the order the backend will apply them. */
    private *changes(event: DbPluginBulkPersistEvent, at: Date): Generator<AuditChange> {
        for (const [schemaId, schemaChanges] of event.operation) {

            // The audit table's own rows are never audited. A wrapper that recorded its own
            // writes would append a row for each row it just appended, and the save would not
            // terminate.
            if (schemaId === this.schema.id || schemaChanges == null) {
                continue;
            }

            const schema = event.schemas.get(schemaId);

            if (schema == null) {
                continue;
            }

            const idOf = (entity: unknown) => {
                try {
                    return schema.getId(entity as never);
                } catch {
                    // An add whose identity the database assigns has none yet.
                    return undefined;
                }
            };

            for (const remove of schemaChanges.removes) {
                yield { collection: schema.collectionName, operation: "remove", id: idOf(remove), entity: remove as never, at };
            }

            for (const update of schemaChanges.updates) {
                yield {
                    collection: schema.collectionName,
                    operation: "update",
                    id: idOf(update.entity),
                    entity: update.entity as never,
                    delta: update.delta as Record<string, unknown>,
                    at,
                };
            }

            for (const add of schemaChanges.adds) {
                yield { collection: schema.collectionName, operation: "add", id: idOf(add), entity: add as never, at };
            }
        }
    }

    bulkPersist(
        event: DbPluginBulkPersistEvent,
        done: PluginEventCallbackPartialResult<BulkPersistResult>
    ): void {
        // One instant for the whole save, so every row from one `saveChanges` sorts together
        // rather than by how long the loop below took.
        const at = new Date();
        const rows: InferCreateType<TAudit>[] = [];

        // Collected before anything is appended: `changes` walks `event.operation`, and
        // appending to it while iterating would feed the audit rows back into the walk.
        for (const change of [...this.changes(event, at)]) {
            const produced = this.entry(change);

            if (produced == null) {
                continue;
            }

            // `preprocess` — defaults applied, then serialized to storage shape — because a
            // plugin receives entities that have already been through it and binds their
            // values straight to the driver. A `Date` handed over raw reaches SQLite as an
            // object and fails with "provided value cannot be bound", and a caller's audit
            // schema is very likely to have a timestamp in it. These rows never pass through
            // the datastore, so the wrapper has to do for them what the datastore does for
            // everything else.
            for (const row of Array.isArray(produced) ? produced : [produced]) {
                rows.push(this.schema.preprocess(row) as InferCreateType<TAudit>);
            }
        }

        if (rows.length === 0) {
            this.plugin.bulkPersist(event, done);
            return;
        }

        // Appended to the END, and that position is what lets them be taken back out below.
        event.operation.resolve<TAudit>(this.schema.id).adds.push(...rows);

        this.plugin.bulkPersist(
            { ...event, schemas: this.withAuditSchema(event.schemas) },
            result => {
                if (result.ok !== "error") {
                    this.forgetOwnRows(result.data, rows.length);
                }

                done(result);
            }
        );
    }

    /**
     * Takes the wrapper's own rows back out of the save result.
     *
     * The caller never submitted them, so their change tracker has nothing to match them
     * against and `mergeChanges` reports "Cannot find internal addition" for a row it did not
     * send.
     *
     * Removing the whole bucket is not enough and not correct: a caller may declare a
     * collection over the audit schema in order to read it — which is the point of it being an
     * ordinary table — and `afterPersist` then looks for that schema's result and fails with
     * "Could not find resolved changes" when it is missing. So the bucket stays and only the
     * appended rows leave it.
     *
     * They are identified by position. A plugin echoes adds in the order it received them,
     * which is the same assumption `mergeChanges` already makes to pair a row with its
     * pending addition, so ours are the last `count` of them.
     */
    private forgetOwnRows(result: BulkPersistResult | undefined, count: number): void {
        const bucket = result?.get(this.schema.id);

        if (bucket == null || count <= 0) {
            return;
        }

        bucket.adds.splice(Math.max(0, bucket.adds.length - count), count);
    }
}
