import { BulkPersistChanges, BulkPersistResult, SchemaCollection } from "@routier/core/collections";
import { DbPluginBulkPersistEvent, DbPluginEvent, DbPluginQueryEvent, IDbPlugin, ITranslatedValue, Query } from "@routier/core/plugins";
import { PluginEventCallbackPartialResult, PluginEventCallbackResult, PluginEventResult, Result } from "@routier/core/results";
import { CompiledSchema } from "@routier/core/schema";
import { logger, uuid, uuidv4 } from "@routier/core/utilities";
import { MemoryPlugin } from "@routier/memory-plugin";
import { PluginSyncEngine } from "./PluginSyncEngine";

const getMemoryPluginCollectionSize = <T extends {}>(plugin: IDbPlugin, schema: CompiledSchema<T>): number => {

    if ("getCollectionSize" in plugin && typeof plugin.getCollectionSize === "function") {
        return plugin.getCollectionSize(schema.collectionName) as number;
    }

    throw new Error("Cannot get size of collection for MemoryPlugin, not an instance of MemoryPlugin");
}

export type OptimisticUpdatesDbPluginOptions = {
    onMirrorError?: (error: Error, context: { plugin: IDbPlugin; eventId: string }) => void;
};

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
    private hydrationPromises: Map<string, Promise<void>> = new Map<string, Promise<void>>();

    // Collections this instance has persisted to. The read plugin is authoritative for
    // them: a size of 0 after a remove-all is real data, not a missed hydration, and
    // re-hydrating from the source (whose mirrored writes may still be in flight)
    // would resurrect removed entities.
    private writtenCollections: Set<string> = new Set<string>();
    private readonly syncEngine: PluginSyncEngine;

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
            onMirrorError: options?.onMirrorError,
        });
    }

    /**
     * Will query the read plugin if there is one, otherwise the source plugin will be queried
    */
    query<TEntity extends {}, TShape extends any = TEntity>(event: DbPluginQueryEvent<TEntity, TShape>, done: PluginEventCallbackResult<ITranslatedValue<TShape>>): void {
        const collectionName = event.operation.schema.collectionName;

        this.ensureHydrated(event.operation.schema, event.schemas)
            .then(() => {
                this.plugins.read.query(event, done);
            })
            .catch((err) => {
                logger.error('[OptimisticReplicationDbPlugin] query failed during hydration', { collectionName, error: err });
                done(PluginEventResult.error(event.id, err instanceof Error ? err : new Error(String(err))));
            });
    }

    /**
     * Resolves once the read plugin holds the collection's data. Collections this
     * instance has written to are authoritative already (a size of 0 after a
     * remove-all is real data — re-hydrating from the source, whose mirrored writes
     * may still be in flight, would resurrect removed entities).
     */
    private ensureHydrated<TEntity extends {}>(schema: CompiledSchema<TEntity>, schemas: SchemaCollection): Promise<void> {
        const collectionName = schema.collectionName;

        if (this.writtenCollections.has(collectionName)) {
            return Promise.resolve();
        }

        const existing = this.hydrationPromises.get(collectionName);
        if (existing != null) {
            return existing;
        }

        const collectionSize = getMemoryPluginCollectionSize(this.plugins.read, schema);
        if (collectionSize > 0) {
            return Promise.resolve();
        }

        logger.info('[OptimisticReplicationDbPlugin] hydration starting', { collectionName });

        const hydration = new Promise<void>((resolve, reject) => {
            this.plugins.source.query<TEntity, unknown>({
                id: uuid(8),
                schemas,
                source: "OptimisticReplicationDbPlugin",
                action: "query",
                explain: false,
                executedQueries: [],
                reason: "hydration",
                // Select All Data
                operation: Query.EMPTY<TEntity, unknown>(schema)
            }, (sourceResult) => {
                if (sourceResult.ok === Result.ERROR) {
                    logger.error('[OptimisticReplicationDbPlugin] hydration failed', { collectionName, error: sourceResult.error });
                    reject(sourceResult.error instanceof Error ? sourceResult.error : new Error(String(sourceResult.error)));
                    return;
                }

                if (Array.isArray(sourceResult.data.value) === false) {
                    logger.error('[OptimisticReplicationDbPlugin] hydration source result is not an array', { collectionName });
                    reject(new Error("Hydration query result is not an array"));
                    return;
                }

                const itemCount = sourceResult.data.value.length;
                logger.debug('[OptimisticReplicationDbPlugin] hydration success, persisting to read plugin', { collectionName, itemCount });

                const changesCollection = new BulkPersistChanges();
                const schemaChanges = changesCollection.resolve(schema.id);

                // Add the existing items into the persist payload as adds
                schemaChanges.adds = sourceResult.data.value;

                this.plugins.read.bulkPersist({
                    id: uuid(8),
                    schemas,
                    operation: changesCollection,
                    source: "OptimisticReplicationDbPlugin",
                    action: "persist",
                    reason: "hydration"
                }, (readPersistResult) => {
                    if (readPersistResult.ok === Result.ERROR) {
                        logger.error('[OptimisticReplicationDbPlugin] hydration read-plugin bulkPersist failed', { collectionName, error: readPersistResult.error });
                        reject(readPersistResult.error instanceof Error ? readPersistResult.error : new Error(String(readPersistResult.error)));
                        return;
                    }

                    logger.info('[OptimisticReplicationDbPlugin] hydration complete', { collectionName, itemCount });
                    resolve();
                });
            });
        });

        this.hydrationPromises.set(collectionName, hydration);

        // A failed hydration un-registers itself so the NEXT query retries it; the
        // queries already awaiting this promise all see the failure.
        hydration.catch(() => {
            if (this.hydrationPromises.get(collectionName) === hydration) {
                this.hydrationPromises.delete(collectionName);
            }
        });

        return hydration;
    }

    destroy(event: DbPluginEvent, done: PluginEventCallbackResult<never>): void {
        this.syncEngine.destroy(event, done);
    }

    bulkPersist(event: DbPluginBulkPersistEvent, done: PluginEventCallbackPartialResult<BulkPersistResult>): void {
        const touchedSchemas: CompiledSchema<any>[] = [];

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
            .then(() => {
                for (const schema of touchedSchemas) {
                    this.writtenCollections.add(schema.collectionName);
                }

                this.syncEngine.bulkPersist({
                    ...event,
                    id: uuid(8),
                    source: "OptimisticReplicationDbPlugin",
                    action: "persist"
                }, done);
            })
            .catch((err) => {
                logger.error('[OptimisticReplicationDbPlugin] persist failed during hydration', { error: err });
                done(PluginEventResult.error(event.id, err instanceof Error ? err : new Error(String(err))));
            });
    }
}