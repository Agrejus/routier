import { CompiledSchema, IdType, InferType, InferCreateType, HashType } from "routier-core/schema";
import { IAdditions } from "./types";

export class UnknownKeyAdditions<T extends {}> implements IAdditions<T> {

    private schema: CompiledSchema<T>;
    private data: Map<IdType, InferType<T>> = new Map<IdType, InferType<T>>();

    get size() {
        return this.data.size;
    }

    constructor(schema: CompiledSchema<T>) {
        this.schema = schema;
    }

    get(entity: InferType<T>): InferType<T> | undefined {
        const hash = this.schema.hash(entity as InferCreateType<T>, HashType.Object);
        return this.data.get(hash);
    }

    values(): InferType<T>[] {
        return [...this.data.values()];
    }

    set(entity: InferType<T>) {
        const hash = this.schema.hash(entity as InferCreateType<T>, HashType.Object);
        this.data.set(hash, entity);
    }

    clear(): void {
        this.data.clear();
    }
}