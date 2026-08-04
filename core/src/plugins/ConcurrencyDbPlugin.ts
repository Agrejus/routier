import { BulkPersistResult, SchemaCollection } from "../collections";
import { OptimisticConcurrencyError } from "../errors";
import { DbPluginBulkPersistEvent, DbPluginEvent, DbPluginQueryEvent, IDbPlugin, ITranslatedValue } from ".";
import { Query } from "./query/Query";
import { PluginEventCallbackPartialResult, PluginEventCallbackResult } from "../results";
import { CompiledSchema, IdType, InferType, PropertyInfo, SchemaId, SchemaTypes } from "../schema";

/**
 * Optimistic concurrency as a wrapper plugin — the whole opt-in is one wrap:
 *
 * ```ts
 * class Bank extends DataStore {
 *     constructor() {
 *         super(new ConcurrencyDbPlugin(new SqlitePlugin('bank.db')));
 *     }
 * }
 * ```
 *
 * Nothing is declared on the schema and nothing on the collection builder: the plugin
 * maintains a hidden `__version` column in the SAME tables/records as the data, entirely
 * below the entity surface. Rows start at version 1; every update is applied ONLY IF the
 * stored version still matches what this store last read (and bumps it); a stale write
 * rejects the save with `OptimisticConcurrencyError` naming the rows instead of silently
 * overwriting another writer. Recovery is always: re-read, reapply, save again.
 *
 * ## How the hidden column exists without schema changes
 *
 * The wrapper hands the inner plugin an AUGMENTED VIEW of each compiled schema — the same
 * object via prototype delegation, with one synthetic `__version` property appended to
 * `properties`. That list is exactly what the storage plugins read to build DDL, INSERT
 * and SELECT column lists, so the column materializes and round-trips through completely
 * unmodified plugin code. Above the wrapper the real schema is untouched, and the
 * datastore's generated deserialize/enrich drop undeclared fields, so `__version` never
 * reaches an entity a caller holds.
 *
 * The synthetic property carries `from: '__version'` on purpose: EphemeralDataPlugin
 * deep-copies query results with `structuredClone` (rather than the generated clone, which
 * drops undeclared fields) when any property is renamed — which is what lets the hidden
 * column survive reads from the in-process plugins so this wrapper can observe it.
 *
 * ## What this store "read"
 *
 * `expected` is per store instance: the version this wrapper last saw for the row, from a
 * query result or a persist echo. A row updated WITHOUT ever being read through this store
 * (rare — an attach of a foreign instance) has no expected value and is written unchecked,
 * initializing its token; the row is protected from the next read on.
 *
 * ## Enforcement and limits
 *
 * The conditional check itself is performed by the INNER plugin via the
 * `EntityUpdateInfo.concurrency` contract — memory, file-system, sqlite and postgresql
 * enforce it (see specs/optimistic-concurrency.md for the not-yet list). Existing SQL
 * tables created before the wrapper was adopted lack the column and need
 * `ALTER TABLE ... ADD COLUMN "__version" <number type>` — new tables get it from the
 * augmented DDL automatically.
 */
export class ConcurrencyDbPlugin implements IDbPlugin {

    static readonly VERSION_COLUMN = "__version";

    private readonly plugin: IDbPlugin;
    /** Augmented schema views, one per schema — identity matters, so they are cached. */
    private readonly augmentedSchemas = new Map<SchemaId, CompiledSchema<any>>();
    /** collectionName -> rowId -> the version this store last observed for the row. */
    private readonly observedVersions = new Map<string, Map<IdType, number>>();

    constructor(plugin: IDbPlugin) {
        this.plugin = plugin;
    }

    get identity(): string | undefined {
        return this.plugin.identity;
    }

    query<TRoot extends {}, TShape extends any = TRoot>(event: DbPluginQueryEvent<TRoot, TShape>, done: PluginEventCallbackResult<ITranslatedValue<TShape>>): void {
        const schema = event.operation.schema;

        const augmentedEvent: DbPluginQueryEvent<TRoot, TShape> = {
            ...event,
            schemas: this.augmentSchemas(event.schemas),
            operation: new Query<TRoot, TShape>(
                event.operation.options,
                this.augment(schema),
                // Preserve the override rather than letting the getter re-derive it
                (event.operation as unknown as { enableChangeTrackingOverride?: boolean }).enableChangeTrackingOverride
            ),
        };

        this.plugin.query(augmentedEvent, result => {
            if (result.ok !== "error") {
                // Query rows are plugin-made copies, so the hidden column can be removed in
                // place after its value is recorded.
                this.captureAndStrip(schema, this.rowsOf(result.data), { strip: true });
            }

            done(result);
        });
    }

    bulkPersist(event: DbPluginBulkPersistEvent, done: PluginEventCallbackPartialResult<BulkPersistResult>): void {
        const schemaIds: SchemaId[] = [];

        for (const [schemaId, changes] of event.operation) {
            schemaIds.push(schemaId);

            if (changes == null || changes.hasItems === false) {
                continue;
            }

            const schema = event.schemas.get(schemaId);
            const versions = this.versionsFor(schema.collectionName);

            for (const add of changes.adds) {
                (add as Record<string, unknown>)[ConcurrencyDbPlugin.VERSION_COLUMN] = 1;
            }

            for (const update of changes.updates) {
                const entity = update.entity as Record<string, unknown>;
                const id = schema.getId(update.entity as InferType<{}>);
                const expected = versions.get(id);
                // An EMPTY delta means "write the whole entity" (the plugins' fallback);
                // adding the column would silently narrow the write to the token alone.
                const deltaCarriesColumns = Object.keys(update.delta as Record<string, unknown>).length > 0;

                if (typeof expected === "number") {
                    entity[ConcurrencyDbPlugin.VERSION_COLUMN] = expected + 1;
                    if (deltaCarriesColumns) {
                        (update.delta as Record<string, unknown>)[ConcurrencyDbPlugin.VERSION_COLUMN] = expected + 1;
                    }
                    update.concurrency = { column: ConcurrencyDbPlugin.VERSION_COLUMN, expected };
                } else {
                    // Never observed through this store — initialize the token, unchecked.
                    entity[ConcurrencyDbPlugin.VERSION_COLUMN] = 1;
                    if (deltaCarriesColumns) {
                        (update.delta as Record<string, unknown>)[ConcurrencyDbPlugin.VERSION_COLUMN] = 1;
                    }
                }
            }
        }

        const augmentedEvent: DbPluginBulkPersistEvent = {
            ...event,
            schemas: this.augmentSchemas(event.schemas),
        };

        this.plugin.bulkPersist(augmentedEvent, result => {
            if (result.ok === "success") {
                for (const schemaId of schemaIds) {
                    const schema = event.schemas.get(schemaId);
                    const buckets = result.data.get(schemaId);

                    // Echoed rows can BE the stored records (the in-process plugins echo by
                    // reference), so the hidden column is recorded but never deleted here —
                    // the datastore's generated deserialize drops it before any caller sees
                    // it, and deleting it would erase the stored token itself.
                    this.captureAndStrip(schema, buckets.adds as unknown[], { strip: false });
                    this.captureAndStrip(schema, buckets.updates as unknown[], { strip: false });

                    for (const removed of buckets.removes as unknown[]) {
                        this.forget(schema, removed);
                    }
                }
            } else if (OptimisticConcurrencyError.is(result.error)) {
                // The expected values that lost the race are stale; drop them so the
                // caller's re-read re-arms the check with fresh observations.
                const conflicted = result.error as OptimisticConcurrencyError;
                const versions = this.observedVersions.get(conflicted.collectionName);

                if (versions != null) {
                    for (const id of conflicted.conflicts) {
                        versions.delete(id);
                    }
                }
            }

            done(result);
        });
    }

    destroy(event: DbPluginEvent, done: PluginEventCallbackResult<never>): void {
        this.observedVersions.clear();
        this.plugin.destroy(event, done);
    }

    private versionsFor(collectionName: string) {
        let versions = this.observedVersions.get(collectionName);

        if (versions == null) {
            versions = new Map<IdType, number>();
            this.observedVersions.set(collectionName, versions);
        }

        return versions;
    }

    /** Extracts entity rows from a translated query result; scalars/aggregates have none. */
    private rowsOf(data: ITranslatedValue<unknown>): unknown[] {
        const value = (data as { value?: unknown }).value;

        if (Array.isArray(value)) {
            return value;
        }

        if (value != null && typeof value === "object") {
            return [value];
        }

        return [];
    }

    private captureAndStrip(schema: CompiledSchema<any>, rows: unknown[], options: { strip: boolean }) {
        const versions = this.versionsFor(schema.collectionName);

        for (const row of rows) {
            if (row == null || typeof row !== "object") {
                continue;
            }

            const record = row as Record<string, unknown>;
            const version = record[ConcurrencyDbPlugin.VERSION_COLUMN];

            if (typeof version === "number") {
                try {
                    versions.set(schema.getId(record as InferType<{}>), version);
                } catch {
                    // Projected rows may not carry the key; nothing to observe.
                }
            }

            if (options.strip) {
                delete record[ConcurrencyDbPlugin.VERSION_COLUMN];
            }
        }
    }

    private forget(schema: CompiledSchema<any>, row: unknown) {
        if (row == null || typeof row !== "object") {
            return;
        }

        try {
            this.observedVersions.get(schema.collectionName)?.delete(schema.getId(row as InferType<{}>));
        } catch {
            // Removals without a resolvable id have nothing recorded.
        }
    }

    /** A SchemaCollection whose every schema is the augmented view. */
    private augmentSchemas(schemas: SchemaCollection): SchemaCollection {
        const augment = (schema: CompiledSchema<any>) => this.augment(schema);

        return new Proxy(schemas, {
            get(target, property, receiver) {
                if (property === "get") {
                    return (id: SchemaId) => augment(target.get(id));
                }

                return Reflect.get(target, property, receiver);
            },
        });
    }

    /**
     * The augmented view of a compiled schema: the same object via prototype delegation,
     * with a synthetic `__version` property appended to `properties`. Everything else —
     * generated functions, ids, id properties — delegates to the real schema.
     */
    private augment<T extends {}>(schema: CompiledSchema<T>): CompiledSchema<T> {
        const cached = this.augmentedSchemas.get(schema.id);

        if (cached != null) {
            return cached as CompiledSchema<T>;
        }

        const synthetic = {
            name: ConcurrencyDbPlugin.VERSION_COLUMN,
            parent: null,
            type: SchemaTypes.Number,
            isKey: false,
            isIdentity: false,
            isDistinct: false,
            isNullable: true,
            isOptional: false,
            isReadonly: false,
            isUnmapped: false,
            isConcurrency: false,
            indexes: [] as string[],
            tags: [] as string[],
            literals: [] as unknown[],
            // Non-null `from` makes EphemeralDataPlugin structural-copy query results
            // (the generated clone would drop the hidden column before this wrapper
            // could observe it). The resolved name is unchanged.
            from: ConcurrencyDbPlugin.VERSION_COLUMN,
            valueSerializer: null,
            valueDeserializer: null,
            injected: null,
            defaultValue: null,
            getResolvedName: () => ConcurrencyDbPlugin.VERSION_COLUMN,
            getValue: (entity: Record<string, unknown>) => entity[ConcurrencyDbPlugin.VERSION_COLUMN],
        } as unknown as PropertyInfo<T>;

        const view = Object.create(schema) as CompiledSchema<T> & { properties: PropertyInfo<T>[] };
        Object.defineProperty(view, "properties", {
            value: [...schema.properties, synthetic],
            enumerable: true,
        });

        this.augmentedSchemas.set(schema.id, view);

        return view;
    }
}
