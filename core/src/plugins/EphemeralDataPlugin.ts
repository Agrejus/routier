import { assertIsNotNull } from '../assertions';
import { OptimisticConcurrencyError } from '../errors';
import { BulkPersistResult, SchemaPersistChanges } from '../collections';
import { WorkPipeline } from '../pipeline';
import { DbPluginBulkPersistEvent, DbPluginEvent, DbPluginQueryEvent, IDbPlugin, ITranslatedValue, JsonTranslator } from '.';
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

    if (left.property.isKey !== true || left.transformer != null || right.value == null) {
        return null;
    }

    return { value: right.value as IdType };
}

export abstract class EphemeralDataPlugin implements IDbPlugin {

    protected databaseName: string;

    constructor(databaseName: string) {
        this.databaseName = databaseName;
    }

    /** Scopes subscription channels to this database — see IDbPlugin.identity. */
    get identity(): string {
        return this.databaseName;
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

    query<TEntity extends {}, TShape extends any = TEntity>(event: DbPluginQueryEvent<TEntity, TShape>, done: PluginEventCallbackResult<ITranslatedValue<TShape>>): void {
        try {
            const operation = event.operation;
            const schema = operation.schema;
            const translator = new JsonTranslator<TEntity, TShape>(operation);
            const collection = this.resolveCollection(schema);

            // Stored records use the storage shape (`from` names).  The generated
            // clone reads in-memory property names and would silently drop renamed
            // fields, so schemas with renames deep-copy structurally instead
            const hasRenamedProperties = schema.properties.some(w => w.from != null);
            const cloneRecord = (hasRenamedProperties
                ? structuredClone
                : schema.clone) as (record: Record<string, unknown>) => Record<string, unknown>;

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

                if (source == null) {
                    source = collection.records;
                }

                // Apply the leading filter options against the raw records before cloning
                // so only surviving rows pay the clone cost.  Filter predicates are pure,
                // so re-running them inside translate() is a no-op pass over the survivors.
                for (let i = 0; i < leadingFilterCount; i++) {
                    const value = orderedOptions[i].value;

                    if (value.filter == null) {
                        continue;
                    }

                    if (value.params == null) {
                        source = source.filter(value.filter);
                        continue;
                    }

                    source = source.filter(w => value.filter([w, value.params]));
                }

                const length = source.length;
                const cloned: Record<string, unknown>[] = Array.from({ length });

                for (let i = 0; i < length; i++) {
                    cloned[i] = cloneRecord(source[i]);
                }

                done(PluginEventResult.success(event.id, translator.translate(cloned)));
            });
        } catch (e) {
            done(PluginEventResult.error(event.id, e));
        }
    }

    abstract destroy(event: DbPluginEvent, done: PluginEventCallbackResult<never>): void;
}