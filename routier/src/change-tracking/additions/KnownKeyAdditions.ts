import { CompiledSchema, IdType, InferType } from "routier-core";
import { IAdditions } from "./types";

export class KnownKeyAdditions<T extends {}> implements IAdditions<T> {

    private schema: CompiledSchema<T>;
    private data: Map<IdType, InferType<T>> = new Map<IdType, InferType<T>>();

    get size() {
        return this.data.size;
    }

    constructor(schema: CompiledSchema<T>) {
        this.schema = schema;
    }

    get(entity: InferType<T>): InferType<T> | undefined {
        const id = this.schema.getId(entity);
        return this.data.get(id) as InferType<T> | undefined;
    }

    values(): InferType<T>[] {
        return [...this.data.values()];
    }

    set(entity: InferType<T>) {
        const id = this.schema.getId(entity);
        this.data.set(id, entity);
    }

    clear(): void {
        this.data.clear();
    }
}