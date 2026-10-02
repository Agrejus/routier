import { BulkPersistChanges, BulkPersistResult, ReadonlySchemaCollection } from '@routier/core/collections';
import { entityIdKey } from './swrUtils';
import type { DbPluginBulkPersistEvent } from '@routier/core/plugins';

export type EtagOwner = 'source' | 'mirrors';

const without = <T extends Record<string, unknown>>(row: T, name: string): T => {
    const copy = { ...row };
    delete copy[name];
    return copy;
};

export function withoutEtags(changes: BulkPersistChanges, schemas: ReadonlySchemaCollection): BulkPersistChanges {
    const stripped = new BulkPersistChanges();
    const etagNames = new Map([...schemas].map(([schemaId, schema]) => [schemaId, schema.etagProperty?.getResolvedName()]));

    for (const [schemaId, schemaChanges] of changes) {
        const name = etagNames.get(schemaId);

        if (name == null) {
            stripped.set(schemaId, schemaChanges);
            continue;
        }

        const target = stripped.resolve(schemaId);
        target.adds = schemaChanges.adds.map(add => without(add, name));
        target.updates = schemaChanges.updates.map(update => ({ ...update, entity: without(update.entity, name) }));
        target.removes = schemaChanges.removes.map(remove => without(remove, name));
        target.tags = schemaChanges.tags;
    }

    return stripped;
}

export function carriesEtags(event: DbPluginBulkPersistEvent): boolean {
    return [...event.operation].some(([schemaId, changes]) => changes.hasItems && event.schemas.get(schemaId)?.etagProperty != null);
}

export function withSourceEtags(changes: BulkPersistChanges, result: BulkPersistResult, schemas: ReadonlySchemaCollection): BulkPersistChanges {
    const stamped = new BulkPersistChanges();

    for (const [schemaId, schemaChanges] of changes) {
        const schema = schemas.get<Record<string, unknown>>(schemaId);

        if (schema?.etagProperty == null) {
            stamped.set(schemaId, schemaChanges);
            continue;
        }

        const name = schema.etagProperty.getResolvedName();

        const generated = new Map(result.get(schemaId)?.updates.map(row => [entityIdKey(schema, row), row[name]]) ?? []);
        const target = stamped.resolve(schemaId);
        target.adds = schemaChanges.adds;
        target.removes = schemaChanges.removes;
        target.tags = schemaChanges.tags;
        target.updates = schemaChanges.updates.map(update => {
            const key = entityIdKey(schema, update.entity);
            return generated.has(key) ? { ...update, entity: { ...update.entity, [name]: generated.get(key) } } : update;
        });
    }

    return stamped;
}
