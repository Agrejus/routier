import Dexie from 'dexie';
import { convertToDexieSchema } from "./utils";
import { DbPluginBulkPersistEvent, DbPluginEvent, DbPluginQueryEvent, IDbPlugin } from '@routier/core/plugins';
import { PluginEventCallbackPartialResult, PluginEventCallbackResult, PluginEventResult } from '@routier/core/results';
import { BulkPersistResult } from '@routier/core/collections';
import { InferCreateType, PropertyInfo, SchemaTypes } from '@routier/core/schema';
import { uuidv4 } from '@routier/core/utilities';
import { ParamsFilter } from '@routier/core/expressions';
import { DexieTranslator } from './DexieTranslator';

const cache = new Map<string, Record<string, string>>();

export class DexiePlugin implements IDbPlugin, Disposable {

    private readonly dbName: string;

    constructor(dbName: string) {
        this.dbName = dbName;
    }

    private _doWork<TResult>(event: DbPluginEvent, work: (db: Dexie, done: (result: TResult, error?: any) => void) => void, done: (result: TResult, error?: any) => void, shouldClose: boolean = true) {
        const db = new Dexie(this.dbName);

        const stores = this.getSchemas(event);

        db.version(1).stores(stores);

        try {
            work(db, (result, error) => {

                if (shouldClose) {
                    db.close();
                }

                done(result, error);
            });
        } catch (e) {
            done(null, e);
        }
    }

    destroy(event: DbPluginEvent, done: PluginEventCallbackResult<never>): void {
        const db = new Dexie(this.dbName);
        db.delete().then(() => done(PluginEventResult.success(event.id))).catch(e => done(PluginEventResult.error(event.id, event)));
    }

    private trySetId<TRoot extends {}>(instance: InferCreateType<TRoot>, stringProperty: PropertyInfo<TRoot>) {
        const value = stringProperty.getValue(instance);

        // If we are using optimistic inserts, the id will already be set, ignore it
        if (value == null) {
            stringProperty.setValue(instance, uuidv4());
        }
    }

    bulkPersist(event: DbPluginBulkPersistEvent, done: PluginEventCallbackPartialResult<BulkPersistResult>) {

        this._doWork(event, async (db, d) => {
            const jobs: Promise<any>[] = [];
            const operationResult = event.operation.toResult();
            try {
                for (const [schemaId, schema] of event.schemas) {
                    const changes = event.operation.get(schemaId);
                    const schemaSpecificResult = operationResult.get(schemaId);

                    if (changes.hasItems === false) {
                        continue;
                    }

                    const collection = db.table(schema.collectionName);

                    if (changes.removes.length > 0) {
                        const ids = changes.removes.map(x => {

                            if (schema.idProperties.length === 1) {
                                // Handle single key, return the value
                                return schema.getIds(x)[0];
                            }

                            // Handle composite keys, should return a tuple
                            return schema.getIds(x);
                        });
                        const remove = async () => {
                            await collection.bulkDelete(ids);

                            // Assume everything succeeds
                            schemaSpecificResult.removes.push(...changes.removes);
                        }
                        jobs.push(remove());
                    }

                    if (changes.updates.length > 0) {
                        const updatedDocuments = changes.updates.map(x => x.entity);
                        const update = async () => {

                            await collection.bulkPut(updatedDocuments);

                            // Assume everything succeeds
                            schemaSpecificResult.updates.push(...updatedDocuments);
                        }
                        jobs.push(update());
                    }

                    if (changes.adds.length > 0) {
                        if (schema.hasIdentities === true) {

                            // generate UUID's, Dexie does not generate them
                            const stringIds = schema.idProperties.filter(x => x.type === SchemaTypes.String);
                            const hasAllStringIds = schema.idProperties.length === stringIds.length;

                            for (let i = 0, length = changes.adds.length; i < length; i++) {
                                const add = changes.adds[i];

                                if (stringIds.length === 1) {
                                    const stringId = stringIds[0];
                                    this.trySetId(add, stringId);
                                } else {
                                    for (let j = 0, length = stringIds.length; j < length; j++) {
                                        const stringId = stringIds[j];

                                        this.trySetId(add, stringId);
                                    }
                                }
                            }

                            if (hasAllStringIds === true) {
                                await collection.bulkAdd(changes.adds);

                                // Assume everything succeeds
                                schemaSpecificResult.adds.push(...changes.adds);
                            } else {
                                jobs.push(db.transaction('rw', collection, async () => Promise.all(changes.adds.map(async x => {

                                    const id = await collection.add(x);

                                    schema.idProperties[0].setValue(x, id);

                                    schemaSpecificResult.adds.push(x);

                                    return x;
                                }))));
                            }
                        } else {

                            const add = async () => {

                                await collection.bulkAdd(changes.adds);

                                // Assume everything succeeds
                                schemaSpecificResult.adds.push(...changes.adds);
                            }
                            jobs.push(add());
                        }
                    }
                }

                await Promise.all(jobs);
                d(PluginEventResult.success(event.id, operationResult));
            } catch (e) {
                d(PluginEventResult.error(event.id, e));
            }
        }, done);
    }

    private getSchemas(event: DbPluginEvent): Record<string, string> {
        if (cache.has(this.dbName)) {
            return cache.get(this.dbName);
        }

        const result: Record<string, string> = {};

        for (const [, schema] of event.schemas) {
            result[schema.collectionName] = convertToDexieSchema(schema)
        }

        cache.set(this.dbName, result);

        return result;
    }

    private getSelectedProperties<TEntity extends {}, TShape extends any = TEntity>(event: DbPluginQueryEvent<TEntity, TShape>) {

        const { options } = event.operation;

        const map = options.getLast("map");

        if (map != null) {

            return map.value.fields.map(x => x.property!);
        }

        return event.operation.schema.properties;
    }

    query<TEntity extends {}, TShape extends any = TEntity>(event: DbPluginQueryEvent<TEntity, TShape>, done: PluginEventCallbackResult<TShape>): void {
        this._doWork(event, (db, d) => {

            const { collectionName } = event.operation.schema;
            const { options } = event.operation;
            const translator = new DexieTranslator<TEntity, TShape>(event.operation);

            // Start with the base collection
            let collection = db.table(collectionName).toCollection();

            options.forEach(option => {

                if (option.name === "filter") {
                    if (option.value.params == null) {
                        // standard filtering
                        collection = collection.filter(option.value.filter);
                    } else {
                        // params filtering
                        const selector = option.value.filter as ParamsFilter<unknown, {}>
                        collection = collection.filter(item => selector([item, option.value.params]));
                    }
                    return;
                }

                if (option.name === "skip") {
                    collection = collection.offset(option.value);
                    return
                }

                if (option.name === "take") {
                    collection = collection.limit(option.value);
                    return
                }

                if (option.name === "distinct") {

                    const selectedProperties = this.getSelectedProperties(event);

                    // distinct only works on properties that have an index,
                    // convert database operation to memory operation
                    if (selectedProperties.some(x => x.indexes.length === 0)) {
                        translator.options.useTranslatorDistinct = true;
                    } else {
                        collection = collection.distinct();
                    }
                    return
                }
            });

            // Get the data first
            collection.toArray().then(data => {
                const result = translator.translate(data);

                d(PluginEventResult.success(event.id, result));
            }).catch(e => d(PluginEventResult.error(event.id, e)));
        }, done);
    }

    [Symbol.dispose](): void {

    }
}