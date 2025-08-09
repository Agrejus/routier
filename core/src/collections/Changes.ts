import { EntityUpdateInfo } from "../plugins/types";
import { InferCreateType, InferType, SchemaId } from "../schema";
import { DeepPartial } from "../types";
import { TagCollection } from "./TagCollection";

export type ChangePackage<T extends {}> =
    { entity: InferType<T> | InferCreateType<T> | DeepPartial<InferCreateType<T>> } |
    { changes: EntityUpdateInfo<T> };

class ChangesBase<T extends {}, TData extends { changes: CollectionChanges<T> }> {

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

    get schemaIds(): Set<SchemaId> {
        return new Set<SchemaId>(this.data.keys());
    }

    constructor(data: Map<SchemaId, TData>) {
        this.data = data;
    }

    protected resolveData<TResult>(extractor: (item: TData) => TResult[], schemaIdsOrId?: SchemaId | SchemaId[]) {
        if (schemaIdsOrId != null) {

            if (Array.isArray(schemaIdsOrId)) {
                const data = this.getChangesForSchema(
                    extractor,
                    schemaIdsOrId
                );

                return { data }
            }


            const data = this.getChangesForSchema(
                extractor,
                schemaIdsOrId
            );

            return { data }
        }

        const data = this.getChangesForSchema(
            extractor,
        );

        return { data }
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
        schemaIds: SchemaId[]
    ): [SchemaId, TResult][];
    protected getChangesForSchema<TResult>(
        extractor: (item: TData) => TResult[],
        schemaIdOrIds?: SchemaId | SchemaId[]
    ): TResult[] | [SchemaId, TResult][] {
        if (schemaIdOrIds != null) {

            if (Array.isArray(schemaIdOrIds)) {
                const data: [SchemaId, TResult][] = [];

                for (let i = 0, length = schemaIdOrIds.length; i < length; i++) {
                    const item = this.data.get(schemaIdOrIds[i]);
                    if (item) {
                        data.push(...extractor(item).map(x => [schemaIdOrIds[i], x] as [SchemaId, TResult]));
                    }
                    return data;
                }

                return data;
            }

            const data: TResult[] = [];
            const item = this.data.get(schemaIdOrIds);
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

    count() {
        let total = 0;
        for (const schemaId of this.schemaIds) {
            const found = this.data.get(schemaId);

            total += (found?.result.adds.entities.length ?? 0) +
                (found?.result.updates.entities.length ?? 0) +
                (found?.result.removes.entities.length ?? 0);
        }

        return total;
    }

    set(schemaId: SchemaId, result: TData["result"]) {
        // changes must exist before a result

        const data = this.data.get(schemaId);
        data.result = result;
    }

    get(schemaId: SchemaId): TData["result"] | undefined {
        const found = this.data.get(schemaId);

        return found?.result;
    }

    adds(): { data: [SchemaId, DeepPartial<InferCreateType<T>>][], count: () => number };
    adds(schemaId: SchemaId): { data: DeepPartial<InferCreateType<T>>[], count: () => number };
    adds(schemaIds: SchemaId[]): { data: [SchemaId, DeepPartial<InferCreateType<T>>][], count: () => number };
    adds(schemaIdsOrId?: SchemaId | SchemaId[]): any {

        const { data } = this.resolveData(item => item.result.adds.entities, schemaIdsOrId);

        return {
            data,
            count: () => data.length
        }
    }

    removes(): { data: [SchemaId, InferType<T>][], count: () => number };
    removes(schemaId: SchemaId): { data: InferType<T>[], count: () => number };
    removes(schemaIds: SchemaId[]): { data: [SchemaId, InferType<T>][], count: () => number };
    removes(schemaIdsOrId?: SchemaId | SchemaId[]): any {

        const { data } = this.resolveData(item => item.result.removes.entities, schemaIdsOrId);

        return {
            data,
            count: () => data.length
        }
    }

    updates(): { data: [SchemaId, InferType<T>][], count: () => number };
    updates(schemaId: SchemaId): { data: InferType<T>[], count: () => number };
    updates(schemaIds: SchemaId[]): { data: [SchemaId, InferType<T>][], count: () => number };
    updates(schemaIdsOrId?: SchemaId | SchemaId[]): any {

        const { data } = this.resolveData(item => item.result.updates.entities, schemaIdsOrId);

        return {
            data,
            count: () => data.length
        }
    }

    private getAllChangesForSchema(
        schemaId: SchemaId | undefined
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

    all(): { data: [SchemaId, ChangePackage<T>][], getTags: (schemaId: SchemaId) => TagCollection | undefined };
    all(schemaId: SchemaId): { data: ChangePackage<T>[], getTags: () => TagCollection | undefined };
    all(schemaId?: SchemaId): any {
        return this.getAllChangesForSchema(schemaId);
    }
}

class ChangeSet<T extends {}, TData extends { changes: CollectionChanges<T> }> extends ChangeSetBase<TData> {

    private _getTags(schemaId: SchemaId) {
        return this.data.get(schemaId)?.changes?.tags;
    }

    count() {
        let total = 0;
        for (const schemaId of this.schemaIds) {
            const found = this.data.get(schemaId);

            total += (found?.changes.adds.entities.length ?? 0) +
                (found?.changes.updates.changes.length ?? 0) +
                (found?.changes.removes.entities.length ?? 0);
        }

        return total;
    }

    set(schemaId: SchemaId, changes: TData["changes"]) {
        // changes must exist before a result
        this.data.set(schemaId, { changes } as TData);
    }

    get(schemaId: SchemaId): TData["changes"] | undefined {
        const found = this.data.get(schemaId);

        return found?.changes;
    }

    adds(): { data: [SchemaId, InferCreateType<T>][], count: () => number, getTags: (schemaId: SchemaId) => TagCollection | undefined };
    adds(schemaId: SchemaId): { data: InferCreateType<T>[], count: () => number, getTags: () => TagCollection | undefined };
    adds(schemaIds: SchemaId[]): { data: [SchemaId, InferCreateType<T>][], count: () => number, getTags: (schemaId: SchemaId) => TagCollection | undefined };
    adds(schemaIdsOrId?: SchemaId | SchemaId[]): any {

        const { data } = this.resolveData(item => item.changes.adds.entities, schemaIdsOrId);

        return this.formatResponse(data);
    }

    removes(): { data: [SchemaId, InferType<T>][], count: () => number, getTags: (schemaId: SchemaId) => TagCollection | undefined };
    removes(schemaId: SchemaId): { data: InferType<T>[], count: () => number, getTags: () => TagCollection | undefined };
    removes(schemaIds: SchemaId[]): { data: [SchemaId, InferType<T>][], count: () => number, getTags: (schemaId: SchemaId) => TagCollection | undefined };
    removes(schemaIdsOrId?: SchemaId | SchemaId[]): any {
        const { data } = this.resolveData(item => item.changes.removes.entities, schemaIdsOrId);

        return this.formatResponse(data);
    }

    updates(): { data: [SchemaId, EntityUpdateInfo<T>][], count: () => number, getTags: (schemaId: SchemaId) => TagCollection | undefined };
    updates(schemaId: SchemaId): { data: EntityUpdateInfo<T>[], count: () => number, getTags: () => TagCollection | undefined };
    updates(schemaIds: SchemaId[]): { data: [SchemaId, EntityUpdateInfo<T>][], count: () => number, getTags: (schemaId: SchemaId) => TagCollection | undefined };
    updates(schemaIdsOrId?: SchemaId | SchemaId[]): any {
        const { data } = this.resolveData(item => item.changes.updates.changes, schemaIdsOrId);

        return this.formatResponse(data);
    }

    private formatResponse<T>(data: T, schemaId?: SchemaId) {

        if (schemaId) {
            return {
                data,
                count: () => Array.isArray(data) ? data.length : 0,
                getTags: () => this._getTags(schemaId)
            }
        }

        return {
            data,
            count: () => Array.isArray(data) ? data.length : 0,
            getTags: (schemaId: SchemaId) => this._getTags(schemaId)
        }
    }

    private getAllChangesForSchema(
        schemaId: SchemaId | undefined
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

    all(): { data: [SchemaId, ChangePackage<T>][], getTags: (schemaId: SchemaId) => TagCollection | undefined };
    all(schemaId: SchemaId): { data: ChangePackage<T>[], getTags: () => TagCollection | undefined };
    all(schemaId?: SchemaId): any {
        const { data } = this.getAllChangesForSchema(schemaId);

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
                result: CollectionChangesResult.EMPTY<T>()
            })
        }

        return new ResolvedChanges<T>(result);
    }
}

export class ResolvedChanges<T extends {}> extends PendingChanges<T, { changes: CollectionChanges<T>, result: CollectionChangesResult<T> }> {
    result = new ResultSet<T, { changes: CollectionChanges<T>, result: CollectionChangesResult<T> }>(this.data);
}

export class CollectionChanges<T extends {}> {
    readonly adds: { entities: InferCreateType<T>[] };
    readonly updates: { changes: EntityUpdateInfo<T>[] };
    readonly removes: { entities: InferType<T>[] }; // Do not pass in the query, we want more visibility into what is going on
    readonly tags: TagCollection = new TagCollection();

    get hasChanges() {
        return this.adds.entities.length > 0 ||
            this.updates.changes.length > 0 ||
            this.removes.entities.length > 0;
    };

    constructor(changes?: {
        adds?: { entities: InferCreateType<T>[] },
        updates?: { changes: EntityUpdateInfo<T>[] },
        removes?: { entities: InferType<T>[] }
    }) {
        this.adds = changes?.adds ?? { entities: [] };
        this.updates = changes?.updates ?? { changes: [] };
        this.removes = changes?.removes ?? { entities: [] };
    }

    static EMPTY<T extends {}>() {
        return new CollectionChanges<T>();
    }

    combine(changes: CollectionChanges<T>) {
        this.adds.entities.push(...changes.adds.entities);
        this.updates.changes.push(...changes.updates.changes);
        this.removes.entities.push(...changes.removes.entities);
        this.tags.combine(changes.tags);
    }
}

export class CollectionChangesResult<T extends {}> {
    readonly adds: { entities: DeepPartial<InferCreateType<T>>[] } = { entities: [] };
    readonly removes: { entities: InferType<T>[]; } = { entities: [] };
    readonly updates: { entities: InferType<T>[]; } = { entities: [] };

    get hasChanges() {
        return this.adds.entities.length > 0 ||
            this.updates.entities.length > 0 ||
            this.removes.entities.length > 0;
    };

    static EMPTY<T extends {}>() {
        return new CollectionChangesResult<T>();
    }

    combine(changes: CollectionChangesResult<T>) {
        this.adds.entities.push(...changes.adds.entities);
        this.updates.entities.push(...changes.updates.entities);
        this.removes.entities.push(...changes.removes.entities);
    }
}