import { UnknownRecord } from "@routier/core";
import type { QueueEntry } from "../SyncDataStore";

/**
 * Utility class for matching queue entries by comparing recordIds objects
 * Supports composite keys by comparing all key properties
 */
export class QueueEntryMatcher {
    /**
     * Checks if two recordIds objects match by comparing all key properties
     */
    static recordIdsMatch(
        idProperties: Array<{ name: string }>,
        recordIds1: UnknownRecord,
        recordIds2: UnknownRecord
    ): boolean {
        if (!recordIds1 || !recordIds2 || typeof recordIds1 !== 'object' || typeof recordIds2 !== 'object') {
            return false;
        }

        // Compare all key properties
        return idProperties.every(prop => {
            const value1 = recordIds1[prop.name];
            const value2 = recordIds2[prop.name];
            return value1 !== undefined && value1 !== null &&
                value2 !== undefined && value2 !== null &&
                String(value1) === String(value2);
        });
    }

    /**
     * Filters queue entries to only those that match the pending changes
     * by comparing recordIds objects
     */
    static findMatchingEntries(
        idProperties: Array<{ name: string }>,
        queueEntries: QueueEntry[],
        pendingChanges: QueueEntry[]
    ): QueueEntry[] {
        return queueEntries.filter(entry => {
            const entryRecordIds = entry.recordIds as UnknownRecord;
            return pendingChanges.some(pending => {
                const pendingRecordIds = pending.recordIds as UnknownRecord;
                return this.recordIdsMatch(idProperties, entryRecordIds, pendingRecordIds);
            });
        });
    }
}
