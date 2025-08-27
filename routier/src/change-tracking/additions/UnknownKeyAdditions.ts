import { CompiledSchema, IdType, InferCreateType, HashType } from "routier-core/schema";
import { IAdditions } from "./types";

export class UnknownKeyAdditions<T extends {}> implements IAdditions<T> {

    private schema: CompiledSchema<T>;
    private data: Map<IdType, InferCreateType<T>> = new Map<IdType, InferCreateType<T>>();

    get size() {
        return this.data.size;
    }

    constructor(schema: CompiledSchema<T>) {
        this.schema = schema;
    }

    get(entity: InferCreateType<T>): InferCreateType<T> | undefined {
        const hash = this.schema.hash(entity, HashType.Object);
        return this.data.get(hash);
    }

    values(): InferCreateType<T>[] {
        return [...this.data.values()];
    }

    set(entity: InferCreateType<T>) {
        const hash = this.schema.hash(entity, HashType.Object);
        this.data.set(hash, entity);
    }

    clear(): void {
        this.data.clear();
    }
}