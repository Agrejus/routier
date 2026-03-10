import { CompiledSchema } from "@routier/core/schema";
import { UnknownRecord } from "@routier/core";

/**
 * Utility class for building and extracting recordIds objects from entities
 * Supports both single and composite primary keys
 */
export class RecordIdsBuilder {
    /**
     * Builds a recordIds object from an entity using the schema's idProperties
     * For single keys: { id: "value" } or { userId: "value" }
     * For composite keys: { key1: "value1", key2: "value2", ... }
     */
    static buildFromEntity(
        schema: CompiledSchema<UnknownRecord>,
        entity: UnknownRecord
    ): UnknownRecord {
        const recordIds: UnknownRecord = {};
        const idProperties = schema.idProperties;

        for (const idProperty of idProperties) {
            const keyValue = entity[idProperty.name];
            if (keyValue !== undefined && keyValue !== null) {
                recordIds[idProperty.name] = keyValue;
            }
        }

        return recordIds;
    }

    /**
     * Extracts the first key value from recordIds object as a string
     * Used for entityId when sending to server (server expects first key value for composite keys)
     */
    static extractFirstKeyValue(
        idProperties: Array<{ name: string }>,
        recordIds: UnknownRecord
    ): string {
        if (!recordIds || typeof recordIds !== 'object' || idProperties.length === 0) {
            return '';
        }

        const firstKeyValue = recordIds[idProperties[0].name];
        return firstKeyValue !== null && firstKeyValue !== undefined
            ? String(firstKeyValue)
            : '';
    }
}
