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

        const adds = changes.adds;
        for (let i = 0; i < adds.length; i++) {
            result.push([schemaId as SchemaId, { data: { ...adds[i] }, type: "add" }] as [SchemaId, DbEvent]);
        }

        const updates = changes.updates;
        for (let i = 0; i < updates.length; i++) {
            result.push([schemaId as SchemaId, { data: { ...updates[i] }, type: "update" }] as [SchemaId, DbEvent]);
        }

        const removes = changes.removes;
        for (let i = 0; i < removes.length; i++) {
            result.push([schemaId as SchemaId, { data: { ...removes[i] }, type: "remove" }] as [SchemaId, DbEvent]);
        }
    }

    return result
}