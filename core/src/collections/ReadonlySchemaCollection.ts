import { CompiledSchema, SchemaId } from "../schema";

/**
 * Collection of schemas with generic typing for type-safe schema retrieval
 */
export class ReadonlySchemaCollection {

    protected data: Map<SchemaId, CompiledSchema<Record<string, unknown>>>;

    constructor(data?: [SchemaId, CompiledSchema<Record<string, unknown>>][]) {
        this.data = new Map<SchemaId, CompiledSchema<Record<string, unknown>>>(data);
    }

    get<T>(schemaId: SchemaId): CompiledSchema<T> | undefined {
        return this.data.get(schemaId) as CompiledSchema<T> | undefined;
    }

    has(schemaId: SchemaId): boolean {
        return this.data.has(schemaId);
    }

    get size(): number {
        return this.data.size;
    }

    keys(): IterableIterator<SchemaId> {
        return this.data.keys();
    }

    values(): IterableIterator<CompiledSchema<Record<string, unknown>>> {
        return this.data.values();
    }

    entries(): IterableIterator<[SchemaId, CompiledSchema<Record<string, unknown>>]> {
        return this.data.entries();
    }

    forEach(callbackfn: (value: CompiledSchema<Record<string, unknown>>, key: SchemaId, map: Map<SchemaId, CompiledSchema<Record<string, unknown>>>) => void, thisArg?: any): void {
        this.data.forEach(callbackfn, thisArg);
    }

    [Symbol.iterator](): IterableIterator<[SchemaId, CompiledSchema<Record<string, unknown>>]> {
        return this.data[Symbol.iterator]();
    }

    getByName<T>(collectionName: string): CompiledSchema<T> | undefined {
        const found = [...this.data].find(x => x[1].collectionName === collectionName);

        if (found != null) {
            return found[1] as CompiledSchema<T>;
        }

        return undefined;
    }
}