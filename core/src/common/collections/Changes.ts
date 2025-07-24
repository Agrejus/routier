import { CollectionChanges, CollectionChangesResult, EntityUpdateInfo } from "../../plugins/types";
import { InferCreateType, InferType, SchemaId } from "../../schema";
import { DeepPartial } from "../../types";
import { TagCollection } from "./TagCollection";

export type ChangePackage<T extends {}> =
    { entity: InferType<T> | InferCreateType<T> | DeepPartial<InferCreateType<T>> } |
    { changes: EntityUpdateInfo<T> };

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

class ChangeSetBase<TData> {

    protected data: Map<SchemaId, TData>;

    constructor(data: Map<SchemaId, TData>) {
        this.data = data;
    }

    protected getChangesForSchema<TResult>(
        extractor: (item: TData) => TResult[]
    ): [SchemaId, TResult][];
    protected getChangesForSchema<TResult>(
        extractor: (item: TData) => TResult[],
        schemaId: SchemaId
    ): TResult[];
    protected getChangesForSchema<TResult>(
        extractor: (item: TData) => TResult[],
        schemaId?: SchemaId
    ): TResult[] | [SchemaId, TResult][] {
        if (schemaId != null) {
            const data: TResult[] = [];
            const item = this.data.get(schemaId);
            if (item) {
                data.push(...extractor(item));
            }
            return data;
        }

        const data: [SchemaId, TResult][] = [];

        for (const [id, item] of this.data.entries()) {
            for (const entity of extractor(item)) {
                data.push([id, entity]);
            }
        }

        return data;
    }
}

class ResultSet<T extends {}, TData extends { changes: CollectionChanges<T>, result: CollectionChangesResult<T> }> extends ChangeSetBase<TData> {
    set(schemaId: SchemaId, result: TData["result"]) {
        // changes must exist before a result
        this.data.set(schemaId, { result } as TData);
    }

    get(schemaId: SchemaId): TData["result"] | undefined {
        const found = this.data.get(schemaId);

        return found?.result;
    }

    adds(): { data: [SchemaId, DeepPartial<InferCreateType<T>>][] };
    adds(schemaId: number): { data: DeepPartial<InferCreateType<T>>[] };
    adds(schemaId?: number): any {
        const data = this.getChangesForSchema(
            item => item.result.adds.entities,
            schemaId
        );

        return { data }
    }

    removes(): { data: [SchemaId, InferType<T>][] };
    removes(schemaId: number): { data: InferType<T>[] };
    removes(schemaId?: number): any {
        const data = this.getChangesForSchema(
            item => item.result.removes.entities,
            schemaId
        );

        return { data };
    }

    updates(): { data: [SchemaId, InferType<T>][] };
    updates(schemaId: number): { data: InferType<T>[] };
    updates(schemaId?: number): any {
        const data = this.getChangesForSchema(
            item => item.result.updates.entities,
            schemaId
        );

        return { data };
    }

    private getAllChangesForSchema(
        schemaId: number | undefined
    ) {
        if (schemaId != null) {
            const data: (InferCreateType<T> | DeepPartial<InferCreateType<T>> | InferType<T>)[] = [];
            const item = this.data.get(schemaId);

            if (item) {

                // Add all adds
                const { data: adds } = this.adds(schemaId);
                for (const entity of adds) {
                    data.push(entity);
                }
                // Add all updates
                const { data: updates } = this.updates(schemaId);
                for (const entity of updates) {
                    data.push(entity);
                }
                // Add all removes
                const { data: removes } = this.removes(schemaId);
                for (const entity of removes) {
                    data.push(entity);
                }
            }
            return data;
        }

        const data: [SchemaId, InferCreateType<T> | DeepPartial<InferCreateType<T>> | InferType<T>][] = [];

        // Add all adds
        const { data: adds } = this.adds();
        for (const [id, entity] of adds) {
            data.push([id, entity]);
        }

        // Add all updates
        const { data: updates } = this.updates();
        for (const [id, entity] of updates) {
            data.push([id, entity]);
        }

        // Add all removes
        const { data: removes } = this.removes();
        for (const [id, entity] of removes) {
            data.push([id, entity]);
        }

        return data;
    }

    all(): { data: [SchemaId, ChangePackage<T>][], getTags: (schemaId: number) => TagCollection | undefined };
    all(schemaId: number): { data: ChangePackage<T>[], getTags: () => TagCollection | undefined };
    all(schemaId?: number): any {
        return this.getAllChangesForSchema(schemaId);
    }
}

class ChangeSet<T extends {}, TData extends { changes: CollectionChanges<T> }> extends ChangeSetBase<TData> {

    private _getTags(schemaId: SchemaId) {
        return this.data.get(schemaId)?.changes?.tags;
    }

    set(schemaId: SchemaId, changes: TData["changes"]) {
        // changes must exist before a result
        this.data.set(schemaId, { changes } as TData);
    }

    get(schemaId: SchemaId): TData["changes"] | undefined {
        const found = this.data.get(schemaId);

        return found?.changes;
    }

    adds(): { data: [SchemaId, InferCreateType<T>][], getTags: (schemaId: number) => TagCollection | undefined };
    adds(schemaId: number): { data: InferCreateType<T>[], getTags: () => TagCollection | undefined };
    adds(schemaId?: number): any {
        const data = this.getChangesForSchema(
            item => item.changes.adds.entities,
            schemaId
        );

        return this.formatResponse(data);
    }

    removes(): { data: [SchemaId, InferType<T>][], getTags: (schemaId: number) => TagCollection | undefined };
    removes(schemaId: number): { data: InferType<T>[], getTags: () => TagCollection | undefined };
    removes(schemaId?: number): any {
        const data = this.getChangesForSchema(
            item => item.changes.removes.entities,
            schemaId
        );

        return this.formatResponse(data);
    }

    updates(): { data: [SchemaId, EntityUpdateInfo<T>][], getTags: (schemaId: number) => TagCollection | undefined };
    updates(schemaId: number): { data: EntityUpdateInfo<T>[], getTags: () => TagCollection | undefined };
    updates(schemaId?: number): any {
        const data = this.getChangesForSchema(
            item => item.changes.updates.changes,
            schemaId
        );

        return this.formatResponse(data);
    }

    private formatResponse<T>(data: T, schemaId?: SchemaId) {

        if (schemaId) {
            return {
                data,
                getTags: () => this._getTags(schemaId)
            }
        }

        return {
            data,
            getTags: (schemaId: SchemaId) => this._getTags(schemaId)
        }
    }

    private getAllChangesForSchema(
        schemaId: number | undefined
    ) {
        if (schemaId != null) {
            const data: ChangePackage<T>[] = [];
            const item = this.data.get(schemaId);
            if (item) {


                // Add all adds
                const { data: adds } = this.adds(schemaId);

                for (const entity of adds) {
                    data.push({ entity });
                }
                // Add all updates
                const { data: updates } = this.updates(schemaId);
                for (const changes of updates) {
                    data.push({ changes });
                }
                // Add all removes
                const { data: removes } = this.removes(schemaId);
                for (const entity of removes) {
                    data.push({ entity });
                }
            }
            return {
                data,
                getTags: () => this._getTags(schemaId)
            };
        }

        const data: [SchemaId, ChangePackage<T>][] = [];

        // Add all adds
        const { data: adds } = this.adds();
        for (const [id, entity] of adds) {
            data.push([id, { entity }]);
        }
        // Add all updates
        const { data: updates } = this.updates();
        for (const [id, changes] of updates) {
            data.push([id, { changes }]);
        }
        // Add all removes
        const { data: removes } = this.removes();
        for (const [id, entity] of removes) {
            data.push([id, { entity }]);
        }

        return {
            data,
            getTags: (schemaId: SchemaId) => this._getTags(schemaId)
        };
    }

    all(): { data: [SchemaId, ChangePackage<T>][], getTags: (schemaId: number) => TagCollection | undefined };
    all(schemaId: number): { data: ChangePackage<T>[], getTags: () => TagCollection | undefined };
    all(schemaId?: number): any {
        const data = this.getAllChangesForSchema(schemaId);

        return this.formatResponse(data);
    }
}

export class PendingChanges<T extends {}, TData extends { changes: CollectionChanges<T> } = { changes: CollectionChanges<T> }> extends ChangesBase<T, TData> {

    changes = new ChangeSet<T, TData>(this.data);

    toResult() {
        const result = new Map<SchemaId, { changes: CollectionChanges<T>, result: CollectionChangesResult<T> }>();
        for (const [schemaId, data] of this.data.entries()) {
            result.set(schemaId, {
                changes: data.changes,
                result: {
                    adds: {
                        entities: []
                    },
                    removes: {
                        entities: [],
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
    result = new ResultSet<T, { changes: CollectionChanges<T>, result: CollectionChangesResult<T> }>(this.data);
}
