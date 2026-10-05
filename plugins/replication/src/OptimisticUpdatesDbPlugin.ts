import { BulkPersistChanges, BulkPersistResult, SchemaCollection, SchemaPersistChanges } from "@routier/core/collections";
import { DbPluginBulkPersistEvent, DbPluginEvent, DbPluginQueryEvent, IDbPlugin, ITranslatedValue, Query } from "@routier/core/plugins";
import { PluginEventCallbackPartialResult, PluginEventCallbackResult, PluginEventResult, Result } from "@routier/core/results";
import { CompiledSchema } from "@routier/core/schema";
import { uuid, uuidv4 } from "@routier/core/utilities";
import { MemoryPlugin } from "@routier/memory-plugin";
import { PluginSyncEngine } from "./PluginSyncEngine";
import { adoptEtags } from "./adoptEtags";
import { conflictOf, runWithOnError, statusOf, type ActionKit } from "./requestFailures";
import { emitEvent, rejectedChangesOf, type OptimisticRequestError, type SyncEvent, type SyncHooks } from "./syncHooks";

type CachedReadError = Error | null;

export type OptimisticUpdatesDbPluginOptions = SyncHooks<OptimisticRequestError>;

export class OptimisticUpdatesDbPlugin implements IDbPlugin {

    protected plugins: {
        /** The primary database plugin that handles all write operations, do not include in the list of replicas. */
        source: IDbPlugin;

        /** Must be a MemoryPlugin */
        read: IDbPlugin;
    };

    /**
     * One promise per collection: concurrent queries await the same hydration instead of
     * polling, and a FAILED hydration removes itself so the next query retries rather
     * than bricking the collection until process restart.
     */
    private hydrationPromises: Map<string, Promise<CachedReadError>> = new Map<string, Promise<CachedReadError>>();
    private readonly syncEngine: PluginSyncEngine;
    private readonly onEvent?: (event: SyncEvent) => void;
    private readonly onError?: (error: OptimisticRequestError) => void;

    /**
     * Creates a new OptimisticDbPluginReplicator that coordinates operations between a source database and its in memory store.
     * 
     * @param source The primary database plugin that will receive all operations first
     */
    /**
     * The SOURCE's name. The read plugin is a per-instance scratch copy with a uuid name;
     * identifying by it would give every instance its own subscription scope and cut two
     * stores over one source database off from each other.
     */
    get databaseName(): string {
        return this.plugins.source.databaseName;
    }

    constructor(source: IDbPlugin, options?: OptimisticUpdatesDbPluginOptions) {
        this.plugins = {
            source,
            // Unique per instance: a shared read database would leak data between
            // unrelated source databases in the same process
            read: new MemoryPlugin(`__optimistic-updates-memory-plugin-db-${uuidv4()}__`)
        };
        this.syncEngine = new PluginSyncEngine({
            // For optimistic behavior, source in sync engine is the fast read plugin.
            source: this.plugins.read,
            mirrorPlugins: [this.plugins.source],
            persistAckMode: "after-source",
            mirrorFailureMode: "swallow",
            mirrorPersistPayloadMode: "resolve-from-source-result",
            etagOwner: "mirrors",
            onMirrorPersisted: (mirrorEvent, result) => {
                void adoptEtags(this.plugins.read, mirrorEvent, result);
            },
            onMirrorError: (error, context) => this.settleMirrorFailure(context.event, error),
        });
        this.onEvent = options?.onEvent;
        this.onError = options?.onError;
    }

    query<TEntity extends {}, TShape extends any = TEntity>(event: DbPluginQueryEvent<TEntity, TShape>, done: PluginEventCallbackResult<ITranslatedValue<TShape>>): void {
        this.ensureHydrated(event.operation.schema, event.schemas)
            .then(() => {
                this.plugins.read.query(event, done);
            })
            .catch((err) => {
                done(PluginEventResult.error(event.id, err instanceof Error ? err : new Error(String(err))));
            });
    }

    private ensureHydrated<TEntity extends {}>(schema: CompiledSchema<TEntity>, schemas: SchemaCollection): Promise<CachedReadError> {
        const collectionName = schema.collectionName;
        const existing = this.hydrationPromises.get(collectionName);
        if (existing != null) {
            return existing;
        }

        const hydration = this.hydrate(schema, schemas);
        this.hydrationPromises.set(collectionName, hydration);

        const forget = () => {
            this.hydrationPromises.delete(collectionName);
        };
        hydration.then((cachedError) => {
            if (cachedError != null) {
                forget();
            }
        }, forget);

        return hydration;
    }

    private async hydrate<TEntity extends {}>(schema: CompiledSchema<TEntity>, schemas: SchemaCollection): Promise<CachedReadError> {
        const collectionName = schema.collectionName;
        const settled = await runWithOnError({
            attempt: () => this.loadFromSource(schema, schemas),
            context: { operation: 'read', collectionName, method: null, url: null, storeSource: true },
            onError: this.onError,
            actions: ({ retry, done, useCached }: ActionKit) => ({ retry, done, useCached }),
            unhandled: (kit: ActionKit) => kit.done(),
        });

        if (settled.outcome !== 'success') {
            emitEvent(this.onEvent, { type: 'read', ok: false, collectionName, status: statusOf(settled.error), error: settled.error });

            if (settled.outcome === 'cached') {
                return settled.error;
            }

            throw settled.error;
        }

        await this.storeHydrated(schema, schemas, settled.value);
        emitEvent(this.onEvent, { type: 'read', ok: true, collectionName, status: null });
        return null;
    }

    private loadFromSource<TEntity extends {}>(schema: CompiledSchema<TEntity>, schemas: SchemaCollection): Promise<object[]> {
        return new Promise((resolve, reject) => {
            this.plugins.source.query<TEntity, unknown>({
                id: uuid(8),
                schemas,
                source: "OptimisticReplicationDbPlugin",
                action: "query",
                explain: false,
                executedQueries: [],
                reason: "hydration",
                operation: Query.EMPTY<TEntity, unknown>(schema)
            }, (sourceResult) => {
                if (sourceResult.ok === Result.ERROR) {
                    reject(sourceResult.error instanceof Error ? sourceResult.error : new Error(String(sourceResult.error)));
                    return;
                }

                const rows: unknown = sourceResult.data.value;

                if (!Array.isArray(rows)) {
                    reject(new Error("Hydration query result is not an array"));
                    return;
                }

                resolve(rows.filter((row): row is object => typeof row === 'object' && row != null));
            });
        });
    }

    private storeHydrated<TEntity extends {}>(schema: CompiledSchema<TEntity>, schemas: SchemaCollection, rows: object[]): Promise<void> {
        const changesCollection = new BulkPersistChanges();
        changesCollection.resolve<{}>(schema.id).adds.push(...rows);

        return new Promise((resolve, reject) => {
            this.plugins.read.bulkPersist({
                id: uuid(8),
                schemas,
                operation: changesCollection,
                source: "OptimisticReplicationDbPlugin",
                action: "persist",
                reason: "hydration",
                etags: "keep"
            }, (readPersistResult) => {
                if (readPersistResult.ok === Result.ERROR) {
                    reject(readPersistResult.error instanceof Error ? readPersistResult.error : new Error(String(readPersistResult.error)));
                    return;
                }

                resolve();
            });
        });
    }

    private settleMirrorFailure(mirrorEvent: DbPluginBulkPersistEvent, error: Error): void {
        void runWithOnError({
            attempt: () => this.resendToSource(mirrorEvent),
            context: { operation: 'write', collectionName: this.changedCollectionsOf(mirrorEvent).map(({ collectionName }) => collectionName).join(', '), method: null, url: null, storeSource: true },
            onError: this.onError,
            actions: ({ retry, reject }: ActionKit) => ({ retry, reject }),
            unhandled: (kit: ActionKit) => kit.reject(),
            firstFailure: error,
        }).then((settled) => {
            if (settled.outcome === 'success') {
                void adoptEtags(this.plugins.read, mirrorEvent, settled.value);
                return;
            }

            this.reportRejected(mirrorEvent, settled.error);
        });
    }

    private resendToSource(mirrorEvent: DbPluginBulkPersistEvent): Promise<BulkPersistResult> {
        return new Promise((resolve, reject) => {
            this.plugins.source.bulkPersist({ ...mirrorEvent, id: uuid(8) }, (result) => {
                if (result.ok === Result.SUCCESS) {
                    resolve(result.data);
                    return;
                }

                reject(result.error instanceof Error ? result.error : new Error(String(result.error)));
            });
        });
    }

    private changedCollectionsOf(event: DbPluginBulkPersistEvent): { collectionName: string; changes: SchemaPersistChanges }[] {
        return [...event.schemas.values()].flatMap((schema) => {
            const changes = event.operation.get(schema.id);
            return changes?.hasItems ? [{ collectionName: schema.collectionName, changes }] : [];
        });
    }

    private reportRejected(event: DbPluginBulkPersistEvent, error: Error): void {
        const status = statusOf(error);

        for (const { collectionName, changes } of this.changedCollectionsOf(event)) {
            emitEvent(this.onEvent, {
                type: 'changes-rejected',
                collectionName,
                changes: rejectedChangesOf({ adds: changes.adds, updates: changes.updates.map((update) => update.entity), removes: changes.removes }),
                conflict: conflictOf(error),
                status,
                error,
            });
        }
    }

    destroy(event: DbPluginEvent, done: PluginEventCallbackResult<never>): void {
        this.syncEngine.destroy(event, done);
    }

    bulkPersist(event: DbPluginBulkPersistEvent, done: PluginEventCallbackPartialResult<BulkPersistResult>): void {
        const touchedSchemas: CompiledSchema<any>[] = [];
        const guarded = [...event.operation].find(([, changes]) => changes.updates.some(update => update.concurrency != null));

        if (guarded != null) {
            done(PluginEventResult.error(event.id, new Error(
                `OptimisticUpdatesDbPlugin cannot support optimistic concurrency, so ConcurrencyDbPlugin must not wrap it.  ` +
                `It acknowledges a save before the source has checked it, so a conflict could only be found after the caller was told the save succeeded.  ` +
                `Collection: ${event.schemas.get(guarded[0])?.collectionName}`
            )));
            return;
        }

        for (const [schemaId, changes] of event.operation) {
            if (changes.hasItems === false) {
                continue;
            }

            const schema = event.schemas.get(schemaId);

            if (schema != null) {
                touchedSchemas.push(schema);
            }
        }

        Promise.all(touchedSchemas.map((schema) => this.ensureHydrated(schema, event.schemas)))
            .then((hydrations) => {
                const cached = hydrations.find((cachedError) => cachedError != null);

                if (cached != null) {
                    done(PluginEventResult.error(event.id, cached));
                    return;
                }

                this.syncEngine.bulkPersist({
                    ...event,
                    id: uuid(8),
                    source: "OptimisticReplicationDbPlugin",
                    action: "persist"
                }, done);
            })
            .catch((err) => {
                done(PluginEventResult.error(event.id, err instanceof Error ? err : new Error(String(err))));
            });
    }
}