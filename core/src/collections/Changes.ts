import { EntityUpdateInfo } from "../plugins/types";
import { InferCreateType, InferType, SchemaId } from "../schema";
import { TagCollection } from "./TagCollection";
export class BulkPersistResult extends Map<SchemaId, SchemaPersistResult> {

    resolve(schemaId: SchemaId): SchemaPersistResult {
        if (this.has(schemaId)) {
            return this.get(schemaId);
        }

        this.set(schemaId, new SchemaPersistResult());

        return this.get(schemaId);
    }

    override get<T extends {} = Record<string, unknown>>(schemaId: SchemaId) {
        return super.get(schemaId) as SchemaPersistResult<T>
    }

    get aggregate() {
        return {
            size: this.aggregateSize,
            adds: this.aggregateAddsSize,
            updates: this.aggregateUpdatesSize,
            removes: this.aggregateRemovesSize
        }
    }

    private get aggregateSize() {
        let count = 0;

        for (const [, result] of this) {
            count += result.total;
        }

        return count;
    }

    private get aggregateAddsSize() {
        let count = 0;

        for (const [, result] of this) {
            count += result.adds.length;
        }

        return count;
    }

    private get aggregateUpdatesSize() {
        let count = 0;

        for (const [, result] of this) {
            count += result.updates.length;
        }

        return count;
    }

    private get aggregateRemovesSize() {
        let count = 0;

        for (const [, result] of this) {
            count += result.removes.length;
        }

        return count;
    }
}

export class BulkPersistChanges extends Map<SchemaId, SchemaPersistChanges> {

    resolve(schemaId: SchemaId): SchemaPersistChanges {
        if (this.has(schemaId)) {
            return this.get(schemaId);
        }

        this.set(schemaId, new SchemaPersistChanges());

        return this.get(schemaId);
    }

    override get<T extends {} = Record<string, unknown>>(schemaId: SchemaId) {
        return super.get(schemaId) as SchemaPersistChanges<T>
    }

    get aggregate() {
        return {
            size: this.aggregateSize,
            adds: this.aggregateAddsSize,
            updates: this.aggregateUpdatesSize,
            removes: this.aggregateRemovesSize
        }
    }

    private get aggregateSize() {
        let count = 0;

        for (const [, result] of this) {
            count += result.total;
        }

        return count;
    }

    private get aggregateAddsSize() {
        let count = 0;

        for (const [, result] of this) {
            count += result.adds.length;
        }

        return count;
    }

    private get aggregateUpdatesSize() {
        let count = 0;

        for (const [, result] of this) {
            count += result.updates.length;
        }

        return count;
    }

    private get aggregateRemovesSize() {
        let count = 0;

        for (const [, result] of this) {
            count += result.removes.length;
        }

        return count;
    }

    /**
     * Ensures the result has the same result sets as the change sets
     * @returns 
     */
    toResult() {
        const result = new BulkPersistResult();

        for (const [schemaId] of this) {
            result.set(schemaId, new SchemaPersistResult());
        }

        return result;
    }
}

export class SchemaPersistChanges<T extends {} = Record<string, unknown>> {
    adds: InferCreateType<T>[] = [];
    updates: EntityUpdateInfo<T>[] = [];
    removes: InferType<T>[] = [];
    tags: TagCollection = new TagCollection();

    get hasItems() {
        return this.total > 0;
    }

    get total() {
        return this.adds.length + this.updates.length + this.removes.length;
    }
}

export class SchemaPersistResult<T extends {} = Record<string, unknown>> {
    adds: InferType<T>[] = [];
    updates: InferType<T>[] = [];
    removes: InferType<T>[] = [];

    get hasItems() {
        return this.total > 0;
    }

    get total() {
        return this.adds.length + this.updates.length + this.removes.length;
    }
}