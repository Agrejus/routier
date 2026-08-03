import { assertIsNotNull } from '../assertions';
import { OptimisticConcurrencyError } from '../errors';
import { BulkPersistResult } from '../collections';
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

    bulkPersist(event: DbPluginBulkPersistEvent, done: PluginEventCallbackPartialResult<BulkPersistResult>) {
        try {
            const bulkPersistResult = event.operation.toResult();
            const schemas = event.schemas;
            const pipeline = new WorkPipeline();
            let hasWork = false;

            for (const [schemaId, changes] of event.operation) {
                const { adds, hasItems, removes, updates } = changes;

                if (!hasItems) {
                    continue;
                }

                hasWork = true;
                const result = bulkPersistResult.get(schemaId);
                const schema = schemas.get(schemaId);
                assertIsNotNull(schema);

                pipeline.pipe((d) => {
                    try {
                        const collection = this.resolveCollection(schema);
                        const addsLength = adds.length;
                        const updatesLength = updates.length;
                        const removesLength = removes.length;

                        // Only need to load if we have updates or removes (need existing data)
                        // For adds-only operations, we can skip load for better performance
                        const needsLoad = updatesLength > 0 || removesLength > 0;

                        const processChanges = () => {
                            // Optimistic concurrency: verify EVERY conditional update
                            // against the stored rows before anything is applied, so a
                            // conflict aborts this collection's save with nothing written.
                            const conflicts: IdType[] = [];

                            for (let j = 0; j < updatesLength; j++) {
                                const { entity, concurrency } = updates[j];

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

                            result.adds = Array.from({ length: addsLength });
                            result.updates = Array.from({ length: updatesLength });
                            result.removes = Array.from({ length: removesLength });

                            for (let j = 0; j < addsLength; j++) {
                                const item = adds[j];
                                collection.add(item);
                                result.adds[j] = item as DeepPartial<InferCreateType<UnknownRecord>>;
                            }

                            for (let j = 0; j < updatesLength; j++) {
                                const item = updates[j].entity;
                                collection.update(item);
                                result.updates[j] = item;
                            }

                            for (let j = 0; j < removesLength; j++) {
                                collection.remove(removes[j]);
                                result.removes[j] = removes[j];
                            }

                            collection.save(saveResult => {
                                if (saveResult.ok === Result.ERROR) {
                                    d(saveResult);
                                    return;
                                }
                                d(Result.success());
                            });
                        };

                        if (needsLoad) {
                            collection.load(readResult => {
                                if (readResult.ok === Result.ERROR) {
                                    d(readResult);
                                    return;
                                }
                                processChanges();
                            });
                        } else {
                            // Skip load for adds-only operations
                            processChanges();
                        }
                    } catch (e) {
                        d(Result.error(e));
                    }
                });
            }

            // If there is no work, just return the result
            if (!hasWork) {
                done(PluginEventResult.success(event.id, bulkPersistResult));
                return;
            }

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