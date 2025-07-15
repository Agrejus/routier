import { CollectionChanges, CollectionChangesResult } from "../../plugins/types";
import { SchemaId } from "../../schema";
import { assertIsNotNull } from "../../utilities";

export class ChangesBase<T extends {}, TData extends { changes: CollectionChanges<T> }> {

    protected data: Map<SchemaId, TData>;

    constructor(data?: Map<SchemaId, TData>) {
        if (data != null) {
            this.data = data;
        } else {
            this.data = new Map<SchemaId, TData>();
        }
    }
}

export class PendingChanges<T extends {}, TData extends { changes: CollectionChanges<T> } = { changes: CollectionChanges<T> }> extends ChangesBase<T, TData> {

    changes = {
        set: (schemaId: SchemaId, changes: TData["changes"]) => {
            this.data.set(schemaId, { changes } as TData);
        },
        get: (schemaId: SchemaId): TData["changes"] | undefined => {
            const found = this.data.get(schemaId);

            return found?.changes;
        },
        count: (schemaId?: SchemaId) => {

            if (schemaId == null) {
                return [...this.data].reduce((a, v) => a + v[1].changes.adds.entities.length + v[1].changes.updates.changes.length + v[1].changes.removes.entities.length, 0);
            }

            const found = this.data.get(schemaId);

            if (found == null) {
                return 0
            }

            return found.changes.adds.entities.length + found.changes.updates.changes.length + found.changes.removes.entities.length;
        },
        entries: () => {
            return this.data.entries()
        }
    }

    toResult() {
        const result = new Map<SchemaId, { changes: CollectionChanges<T>, result: CollectionChangesResult<T> }>();
        for (const [schemaId, data] of this.changes.entries()) {
            result.set(schemaId, {
                changes: data.changes,
                result: {
                    adds: {
                        entities: []
                    },
                    removed: {
                        count: 0,
                    },
                    updates: {
                        entities: []
                    }
                }
            })
        }

        return new ResolvedChanges<T>(result);
    }
}

export class ResolvedChanges<T extends {}> extends PendingChanges<T, { changes: CollectionChanges<T>, result: CollectionChangesResult<T> }> {

    result = {
        set: (schemaId: SchemaId, result: CollectionChangesResult<T>) => {
            const found = this.data.get(schemaId);

            assertIsNotNull(found, `Cannot find data for schemaId.  SchemaId: ${schemaId}`);

            // since this inherits from PendingChanges, we should already have an item for the schema Id
            found.result = result;
        },
        get: (schemaId: SchemaId): CollectionChangesResult<T> | undefined => {
            const found = this.data.get(schemaId);

            return found?.result;
        },
        count: (schemaId?: SchemaId) => {

            if (schemaId == null) {
                return [...this.data].reduce((a, v) => a + v[1].result.adds.entities.length + v[1].result.updates.entities.length + v[1].result.removed.count, 0);
            }

            const found = this.data.get(schemaId);

            if (found == null) {
                return 0
            }

            return found.result.adds.entities.length + found.result.updates.entities.length + found.result.removed.count;
        },
        entries: () => {
            return this.data.entries()
        }
    }
}
