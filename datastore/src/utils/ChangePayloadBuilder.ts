import { UnknownRecord } from "@routier/core";
import type { QueueEntry } from "../SyncDataStore";
import { RecordIdsBuilder } from "./RecordIdsBuilder";

/**
 * Utility class for building change payloads from queue entries
 * Converts queue entries into the format expected by the server
 */
export class ChangePayloadBuilder {
    /**
     * Builds change payloads from queue entries
     * Extracts entityId from recordIds using the first key property
     */
    static buildChangePayloads(
        idProperties: Array<{ name: string }>,
        pendingChanges: QueueEntry[]
    ): Array<{ type: string; entityId: string; entity?: UnknownRecord; localTimestamp: number }> {
        return pendingChanges.map((q: QueueEntry) => {
            const recordIds = q.recordIds as UnknownRecord;
            const entityId = RecordIdsBuilder.extractFirstKeyValue(idProperties, recordIds);

            return {
                type: q.changeType,
                entityId,
                entity: q.entityData,
                localTimestamp: q.timestamp
            };
        });
    }
}
