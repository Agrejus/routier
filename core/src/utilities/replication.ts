import { BulkPersistResult, BulkPersistChanges } from "../collections";
import { DbPluginBulkPersistEvent } from "../plugins";

export const resolveBulkPersistChanges = (event: DbPluginBulkPersistEvent, result: BulkPersistResult, bulkPersistChanges: BulkPersistChanges) => {
    // make sure we swap the adds here, that way we can make sure other persist events
    // don't take their additions and try to change subsequent calls
    for (const [schemaId, changes] of event.operation) {

        const schemmaBulkPersistResult = result.get(schemaId);
        const schemaBulkPersistChanges = bulkPersistChanges.resolve(schemaId);

        // Set the original removes
        schemaBulkPersistChanges.removes = changes.removes;

        // Set the original updates
        schemaBulkPersistChanges.updates = changes.updates;

        // Take the adds from the result and set them to be persisted
        // in the replicated plugins
        schemaBulkPersistChanges.adds = schemmaBulkPersistResult.adds;
    }
}