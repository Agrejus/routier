import { InferCreateType, InferType, SchemaId } from "../schema";
import { DbPluginBulkPersistEvent, EntityUpdateInfo } from "../plugins";

type DbEvent = {
    type: "add",
    data: InferCreateType<unknown>;
} | {
    type: "update",
    data: EntityUpdateInfo<unknown>;
} | {
    type: "remove",
    data: InferType<unknown>;
}

export const toEventArray = (event: DbPluginBulkPersistEvent): [SchemaId, DbEvent][] => {

    const result: [SchemaId, DbEvent][] = [];
    for (const [schemaId, changes] of event.operation) {

        if (changes.hasItems === false) {
            continue;
        }

        if (changes.adds.length > 0) {
            result.push(...changes.adds.map(add => {
                return [schemaId as SchemaId, { data: { ...add }, type: "add" }] as [SchemaId, DbEvent];
            }));
        }

        if (changes.updates.length > 0) {
            result.push(...changes.updates.map(update => {
                return [schemaId as SchemaId, { data: { ...update }, type: "update" }] as [SchemaId, DbEvent];
            }));
        }

        if (changes.removes.length > 0) {
            result.push(...changes.removes.map(remove => {
                return [schemaId as SchemaId, { data: { ...remove }, type: "remove" }] as [SchemaId, DbEvent];
            }));
        }
    }

    return result
}