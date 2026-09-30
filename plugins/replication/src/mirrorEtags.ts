import { BulkPersistChanges, ReadonlySchemaCollection } from '@routier/core/collections';

export type EtagOwner = 'source' | 'mirrors';

const without = <T extends Record<string, unknown>>(row: T, name: string): T => {
    const copy = { ...row };
    delete copy[name];
    return copy;
};

export function withoutEtags(changes: BulkPersistChanges, schemas: ReadonlySchemaCollection): BulkPersistChanges {
    const stripped = new BulkPersistChanges();
    const etagNames = new Map([...schemas].map(([schemaId, schema]) => [schemaId, schema.etagProperty?.name]));

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
