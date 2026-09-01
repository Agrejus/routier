import { assertIsNotNull } from '../assertions';
import { OptimisticConcurrencyError } from '../errors';
import { BulkPersistResult, SchemaPersistChanges } from '../collections';
import { WorkPipeline } from '../pipeline';
import { DbPluginBulkPersistEvent, DbPluginEvent, DbPluginQueryEvent, describeFilters, distinctJoinKeys, IDbPlugin, ITranslatedValue, JoinInnerSide, JsonTranslator } from '.';
import { PluginEventCallbackPartialResult, PluginEventCallbackResult, PluginEventResult, Result } from '../results';
import { CompiledSchema, IdType, InferCreateType } from '../schema';
import { isComparatorExpression, isPropertyExpression, isValueExpression } from '../assertions';
import { DeepPartial } from '../types';
import { MemoryDataCollection } from '../collections/MemoryDataCollection';
import { UnknownRecord } from '../utilities';

/**
 * Extracts the key value from a parsed filter expression when the whole filter
 * is a single non-negated equality on the schema's key property.  Returns null
 * for anything else — compound filters, transformed properties, or filters that
 * could not be parsed.
 */
const getKeyEqualityValue = (expression: unknown): { value: IdType } | null => {

    // Type guards over the `type` discriminant, not instanceof — expression
    // instances can originate from a different bundled copy of the classes
    if (!isComparatorExpression(expression)) {
        return null;
    }

    if (expression.comparator !== "equals" || expression.negated === true) {
        return null;
    }

    const { left, right } = expression;

    if (!isPropertyExpression(left) || !isValueExpression(right)) {
        return null;
    }

    // A called property is a CallExpression, so it fails the isPropertyExpression check above
    if (left.property.isKey !== true || right.value == null) {
        return null;
    }

    return { value: right.value as IdType };
}

export abstract class EphemeralDataPlugin implements IDbPlugin {

    protected readonly _databaseName: string;

    constructor(databaseName: string) {
        this._databaseName = databaseName;
    }

    /**
     * See `IDbPlugin.databaseName`. A getter rather than the field itself so a subclass whose
     * database is identified by more than a name can widen it — `FileSystemPlugin` returns the
     * resolved file path, because one name in two directories is two databases.
     */
    get databaseName(): string {
        return this._databaseName;
    }

    protected abstract resolveCollection<TEntity extends {}>(schema: CompiledSchema<TEntity>): MemoryDataCollection;

    /**
     * All-or-nothing across every collection in the save.
     *
     * The naive shape — validate/apply/save one schema at a time — leaks partial saves:
     * a conflict in the SECOND collection left the first collection's changes applied
     * (measured in the finance stress app as one orphan ledger row per conflict). So the
     * work is phased: every collection loads and validates BEFORE anything is applied,
     * mutations apply with an undo log, and a failure anywhere reverts the memory state
     * (and re-saves any files already written) so the caller sees a save that did nothing.
     *
     * The remaining honesty gap is crash-safety across FILES: a process dying between two
     * file writes can leave disk partially updated. Guarding that needs a journal, which
     * a memory-first plugin does not pretend to have.
     */
    bulkPersist(event: DbPluginBulkPersistEvent, done: PluginEventCallbackPartialResult<BulkPersistResult>) {
        try {
            const bulkPersistResult = event.operation.toResult();
            const schemas = event.schemas;

            type StagedSchema = {
                schema: CompiledSchema<UnknownRecord>;
                collection: MemoryDataCollection;
                changes: SchemaPersistChanges<Record<string, unknown>>;
                result: ReturnType<BulkPersistResult["get"]>;
            };

            const staged: StagedSchema[] = [];

            for (const [schemaId, changes] of event.operation) {
                if (!changes.hasItems) {
                    continue;
                }

                const schema = schemas.get(schemaId);
                assertIsNotNull(schema);

                staged.push({
                    schema: schema as CompiledSchema<UnknownRecord>,
                    collection: this.resolveCollection(schema),
                    changes: changes as SchemaPersistChanges<Record<string, unknown>>,
                    result: bulkPersistResult.get(schemaId),
                });
            }

            if (staged.length === 0) {
                done(PluginEventResult.success(event.id, bulkPersistResult));
                return;
            }

            const pipeline = new WorkPipeline();

            // Phase 1 — load every collection that needs its stored data (updates/removes,
            // and any conditional update), before anything is validated or applied.
            //
            // An ADD-ONLY batch is skipped: an add needs no prior state, and for the memory
            // backing this class was written against, loading is free anyway.
            //
            // ⚠ SUBCLASSES THAT PERSIST WHOLE COLLECTIONS MUST HYDRATE IN `save()`.
            // If `save()` serializes `this.records` over the entire stored value — a JSON
            // file, one localStorage key, a blob — then a collection instance that has
            // never loaded holds only this batch's adds, and writing it DELETES everything
            // previously persisted. The skip above means `save()` cannot assume `load()`
            // ran. Hydrate first (load-once, then `addIfAbsent` so stored rows never
            // clobber pending mutations); `FileSystemDbCollection.save` and
            // `BrowserStorageCollection.save` both do exactly that.
            //
            // This has now been a data-loss defect twice — known-defects #18
            // (file-system) and #30 (browser-storage).
            for (const { collection, changes } of staged) {
                if (changes.updates.length === 0 && changes.removes.length === 0) {
                    continue;
                }

                pipeline.pipe((d) => {
                    collection.load(readResult => {
                        if (readResult.ok === Result.ERROR) {
                            d(readResult);
                            return;
                        }
                        d(Result.success());
                    });
                });
            }

            // Phase 2 — validate everything, then apply everything, then save everything.
            pipeline.pipe((d) => {
                try {
                    // Validate: optimistic-concurrency checks for EVERY collection run
                    // before ANY collection is touched, so a conflict rejects the whole
                    // save with nothing written anywhere.
                    for (const { schema, collection, changes } of staged) {
                        const conflicts: IdType[] = [];

                        for (const { entity, concurrency } of changes.updates) {
                            if (concurrency == null) {
                                continue;
                            }

                            const id = schema.getId(entity as never);
                            const stored = collection.getByIds([id]) as Record<string, unknown> | null;

                            // A missing row is not a token conflict — it falls through
                            // to the same no-op an unconditional update would be.
                            if (stored != null && stored[concurrency.column] !== concurrency.expected) {
                                conflicts.push(id);
                            }
                        }

                        if (conflicts.length > 0) {
                            d(Result.error(new OptimisticConcurrencyError(schema.collectionName, conflicts)));
                            return;
                        }
                    }

                    // Apply, recording the inverse of every mutation. The in-memory maps
                    // make undo exact: an add is removed, an update or remove restores the
                    // captured prior record.
                    const undo: (() => void)[] = [];

                    const revert = () => {
                        for (let i = undo.length - 1; i >= 0; i--) {
                            undo[i]();
                        }
                    };

                    try {
                        for (const { schema, collection, changes, result } of staged) {
                            const { adds, updates, removes } = changes;

                            result.adds = Array.from({ length: adds.length });
                            result.updates = Array.from({ length: updates.length });
                            result.removes = Array.from({ length: removes.length });

                            for (let j = 0; j < adds.length; j++) {
                                const item = adds[j];
                                collection.add(item);
                                undo.push(() => collection.remove(item));
                                result.adds[j] = item as DeepPartial<InferCreateType<UnknownRecord>>;
                            }

                            for (let j = 0; j < updates.length; j++) {
                                const item = updates[j].entity;
                                const prior = collection.getByIds(schema.getIds(item as never)) as Record<string, unknown> | undefined;
                                collection.update(item);
                                undo.push(prior != null ? () => collection.update(prior) : () => collection.remove(item));
                                result.updates[j] = item;
                            }

                            for (let j = 0; j < removes.length; j++) {
                                const item = removes[j];
                                const prior = collection.getByIds(schema.getIds(item as never)) as Record<string, unknown> | undefined;
                                collection.remove(item);
                                if (prior != null) {
                                    undo.push(() => collection.update(prior));
                                }
                                result.removes[j] = item;
                            }
                        }
                    } catch (applyError) {
                        revert();
                        d(Result.error(applyError));
                        return;
                    }

                    // Save every collection. A failure reverts the memory state and
                    // re-saves the files already written so disk follows it back.
                    const saveNext = (index: number) => {
                        if (index >= staged.length) {
                            d(Result.success());
                            return;
                        }

                        staged[index].collection.save(saveResult => {
                            if (saveResult.ok === Result.ERROR) {
                                revert();

                                const resaveNext = (k: number) => {
                                    if (k >= index) {
                                        d(saveResult);
                                        return;
                                    }

                                    staged[k].collection.save(() => resaveNext(k + 1));
                                };

                                resaveNext(0);
                                return;
                            }

                            saveNext(index + 1);
                        });
                    };

                    saveNext(0);
                } catch (e) {
                    d(Result.error(e));
                }
            });

            pipeline.filter((result) => {
                if (result.ok === Result.ERROR) {
                    done(PluginEventResult.error(event.id, result.error));
                    return;
                }
                done(PluginEventResult.success(event.id, bulkPersistResult));
            });
        } catch (e: any) {
            done(PluginEventResult.error(event.id, e));
        }
    }

    /**
     * Loads the inner side of a join, when the query carries one.
     *
     * This is the whole of "interpretation 2" for the ephemeral family — memory, file-system and
     * browser-storage all reach the inner collection the same way they reach the outer one, so
     * the wiring lives here once rather than in each subclass. The shared hash join in
     * `JsonTranslator.join` does everything after it.
     *
     * `load()` is called on the inner collection too: a durable subclass has nothing in memory
     * until it reads, and a join that skipped it would return no pairs on the first query after
     * a restart — an empty result, not an error.
     *
     * The rows are CLONED, like the outer side's are. Deserialization builds a new object for the
     * entity and its nested objects, but an array property can come through by reference — and
     * here that reference is the one this plugin's own storage holds, so a caller appending to a
     * joined row's array would be editing the database. The outer path has always cloned for this
     * reason; the inner path is the same read.
     *
     * @param outerKeys The distinct keys the outer rows actually hold — the semi-join prefilter.
     * Rows whose key is not among them cannot pair with anything, so they are skipped before the
     * clone rather than after the hash join, which is where the saving is. `null` means the outer
     * side had more distinct keys than `semiJoinKeyThreshold`, so every inner row is taken and the
     * join discards the surplus. Same pairs either way.
     */
    private resolveJoinInnerSide<TEntity extends {}, TShape>(
        event: DbPluginQueryEvent<TEntity, TShape>,
        outerKeys: ReadonlySet<unknown> | null,
        done: (result: { ok: "success", innerSide?: JoinInnerSide } | { ok: "error", error: unknown }) => void
    ) {
        const joinOption = event.operation.options.getLast("join");

        if (joinOption == null) {
            done({ ok: "success" });
            return;
        }

        const innerSchema = event.schemas.get(joinOption.value.innerSchemaId);

        if (innerSchema == null) {
            done({
                ok: "error",
                error: new Error(`Cannot join: the inner collection's schema is not registered in this store.  SchemaId: ${joinOption.value.innerSchemaId}`)
            });
            return;
        }

        const innerCollection = this.resolveCollection(innerSchema);

        innerCollection.load(r => {
            if (r.ok === Result.ERROR) {
                done({ ok: "error", error: r.error });
                return;
            }

            const cloneRecord = this.recordCloner(innerSchema);
            const innerRows: Record<string, unknown>[] = [];

            // Records are held in STORAGE shape, so the key is read by its resolved column name.
            const innerKey = joinOption.value.innerKey;
            const keyColumn = innerKey.property?.getResolvedName() ?? innerKey.propertyName;

            for (const record of innerCollection.values()) {
                if (outerKeys != null && outerKeys.has(record[keyColumn]) === false) {
                    continue;
                }

                innerRows.push(cloneRecord(record));
            }

            const narrowing = outerKeys == null ? "full scan" : `narrowed by ${outerKeys.size} outer ${outerKeys.size === 1 ? "key" : "keys"}`;

            event.executedQueries.push({
                text: `${innerSchema.collectionName}: scanned ${innerRows.length} in-memory ${innerRows.length === 1 ? "record" : "records"} for join inner side (${narrowing})`
            });

            done({ ok: "success", innerSide: { innerSchema, innerRows } });
        });
    }

    /**
     * How to copy a stored record of this schema.
     *
     * Stored records use the storage shape (`from` names). `schema.clone` reads IN-MEMORY property
     * names and would silently drop renamed fields, so a schema with renames uses the cloner
     * generated against the storage shape instead. Both are generated code; the renamed case used
     * to fall back to `structuredClone`, which is roughly an order of magnitude slower and was paid
     * on EVERY read of EVERY schema that renames a property.
     */
    private recordCloner(schema: CompiledSchema<any>) {
        const hasRenamedProperties = schema.properties.some(property => property.from != null);

        return (hasRenamedProperties ? schema.cloneStorage : schema.clone) as (record: Record<string, unknown>) => Record<string, unknown>;
    }

    query<TEntity extends {}, TShape extends any = TEntity>(event: DbPluginQueryEvent<TEntity, TShape>, done: PluginEventCallbackResult<ITranslatedValue<TShape>>): void {
        this._query(event, done);
    }

    private _query<TEntity extends {}, TShape extends any = TEntity>(event: DbPluginQueryEvent<TEntity, TShape>, done: PluginEventCallbackResult<ITranslatedValue<TShape>>): void {
        try {
            const operation = event.operation;
            const schema = operation.schema;
            const collection = this.resolveCollection(schema);

            const cloneRecord = this.recordCloner(schema);

            collection.load(r => {
                if (r.ok === Result.ERROR) {
                    done(PluginEventResult.error(event.id, r.error));
                    return;
                }

                const orderedOptions: { name: string, value: any }[] = [];
                operation.options.forEach(o => orderedOptions.push(o));

                let leadingFilterCount = 0;

                while (leadingFilterCount < orderedOptions.length && orderedOptions[leadingFilterCount].name === "filter") {
                    leadingFilterCount++;
                }

                // Key-equality fast path: when a leading filter's parsed expression pins
                // the key property to a single value, resolve that record directly from
                // the collection instead of scanning everything
                let source: Record<string, unknown>[] | null = null;

                if (schema.idProperties.length === 1) {
                    for (let i = 0; i < leadingFilterCount; i++) {
                        const id = getKeyEqualityValue(orderedOptions[i].value.expression);

                        if (id == null) {
                            continue;
                        }

                        const found = collection.getByIds([id.value]);
                        source = found == null ? [] : [found];
                        break;
                    }
                }

                // Apply the leading filter options against the raw records before cloning
                // so only surviving rows pay the clone cost.  Filter predicates are pure,
                // so re-running them inside translate() is a no-op pass over the survivors.
                //
                // Filter and clone are FUSED into one pass, and the unfiltered case iterates
                // the collection instead of spreading it into an array.  The staged form walked
                // the collection up to four times and allocated a full-size array at each step.
                const leadingFilters: { filter: (arg: any) => unknown, params: unknown | null }[] = [];

                for (let i = 0; i < leadingFilterCount; i++) {
                    const value = orderedOptions[i].value;

                    if (value.filter == null) {
                        continue;
                    }

                    leadingFilters.push({ filter: value.filter, params: value.params ?? null });
                }

                const filterCount = leadingFilters.length;
                const cloned: Record<string, unknown>[] = [];

                for (const record of (source ?? collection.values())) {
                    let kept = true;

                    for (let i = 0; i < filterCount; i++) {
                        const { filter, params } = leadingFilters[i];

                        // Truthiness, not === true: Array.prototype.filter keeps a row on any
                        // truthy return, and these predicates are generated code that returns
                        // whatever the expression evaluated to.
                        if (!(params == null ? filter(record) : filter([record, params]))) {
                            kept = false;
                            break;
                        }
                    }

                    if (kept === false) {
                        continue;
                    }

                    cloned.push(cloneRecord(record));
                }

                /**
                 * The inner side is loaded LAST, once the outer rows are known.
                 *
                 * That ordering is the whole semi-join: the outer keys are what narrow the inner
                 * read, and they do not exist until the outer filters have run. Reading the inner
                 * side first — which is what this did before — means loading and cloning a whole
                 * collection to pair it with three rows.
                 *
                 * `cloned` is in storage shape, so the keys are read by resolved column name.
                 */
                /**
                 * No statement to quote — an ephemeral store walks its own records — so the scan
                 * is said plainly, and the PREDICATE is reported as JavaScript beside it. A count
                 * alone leaves a reader unable to tell a filter that matched nothing from one
                 * that was never applied.
                 *
                 * Before the inner side, to match execution order.
                 */
                const described = describeFilters(
                    operation.options.get("filter").map(entry => entry.option.value)
                );

                event.executedQueries.push({
                    text: `${operation.schema.collectionName}: scanned ${cloned.length} in-memory ` +
                        `${cloned.length === 1 ? "record" : "records"}, filter ${described.text}`,
                    parameters: described.parameters.length > 0 ? described.parameters : undefined
                });

                const joinOption = operation.options.getLast("join");
                const outerKeys = joinOption == null
                    ? null
                    : distinctJoinKeys(cloned, joinOption.value.outerKey, joinOption.value.semiJoinKeyThreshold, { storageShape: true });

                this.resolveJoinInnerSide(event, outerKeys, joinResult => {
                    if (joinResult.ok === "error") {
                        done(PluginEventResult.error(event.id, joinResult.error));
                        return;
                    }

                    try {
                        const translator = new JsonTranslator<TEntity, TShape>(operation, joinResult.innerSide);

                        done(PluginEventResult.success(event.id, translator.translate(cloned)));
                    } catch (e) {
                        done(PluginEventResult.error(event.id, e));
                    }
                });
            });
        } catch (e) {
            done(PluginEventResult.error(event.id, e));
        }
    }

    abstract destroy(event: DbPluginEvent, done: PluginEventCallbackResult<never>): void;
}