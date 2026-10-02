import { BulkPersistChanges, BulkPersistResult } from '@routier/core/collections';
import { DbPluginBulkPersistEvent, IDbPlugin, Query } from '@routier/core/plugins';
import { Result } from '@routier/core/results';
import { CompiledSchema } from '@routier/core/schema';
import { logger, uuid } from '@routier/core/utilities';
import { entityIdKey } from './swrUtils';

type Row = Record<string, unknown>;

const readAll = (store: IDbPlugin, schema: CompiledSchema<Row>, event: DbPluginBulkPersistEvent): Promise<Row[]> =>
    new Promise((resolve, reject) => {
        store.query({
            id: uuid(8),
            schemas: event.schemas,
            source: 'OptimisticUpdatesDbPlugin',
            action: 'query',
            explain: false,
            executedQueries: [],
            operation: Query.EMPTY<Row, Row[]>(schema),
        }, (result) => (result.ok === Result.ERROR ? reject(result.error) : resolve(result.data.value)));
    });

const adoptForSchema = async (store: IDbPlugin, schema: CompiledSchema<Row>, name: string, durable: Row[], event: DbPluginBulkPersistEvent): Promise<void> => {
    const generated = new Map(durable.map(row => [entityIdKey(schema, row), row[name]]));
    const stale = (await readAll(store, schema, event)).filter(row => {
        const key = entityIdKey(schema, row);
        return generated.has(key) && generated.get(key) !== row[name];
    });

    if (stale.length === 0) {
        return;
    }

    const operation = new BulkPersistChanges();
    operation.resolve<{}>(schema.id).updates.push(...stale.map(row => ({
        entity: { ...row, [name]: generated.get(entityIdKey(schema, row)) },
        changeType: 'markedDirty' as const,
        delta: {},
    })));

    await new Promise<void>((resolve, reject) => store.bulkPersist({
        id: uuid(8),
        schemas: event.schemas,
        operation,
        source: 'OptimisticUpdatesDbPlugin',
        action: 'persist',
        reason: 'adopt-etags',
        etags: 'keep',
    }, (result) => (result.ok === Result.ERROR ? reject(result.error) : resolve())));
};

export async function adoptEtags(store: IDbPlugin, event: DbPluginBulkPersistEvent, result: BulkPersistResult): Promise<void> {
    for (const [schemaId, persisted] of result) {
        const schema = event.schemas.get<Row>(schemaId);
        const durable = [...persisted.adds, ...persisted.updates];

        if (schema?.etagProperty == null || durable.length === 0) {
            continue;
        }

        await adoptForSchema(store, schema, schema.etagProperty.getResolvedName(), durable, event).catch((error: Error) => {
            logger.warn('[OptimisticUpdatesDbPlugin] could not adopt the source etags', { collectionName: schema.collectionName, error });
        });
    }
}
