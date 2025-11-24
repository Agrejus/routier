import { CompiledSchema, IdType, InferCreateType, HashType, InferType } from "@routier/core/schema";
import { IAdditionsCollection } from "./types";

export class UnknownKeyAdditionCollection<T extends {}> implements IAdditionsCollection<T> {

    private schema: CompiledSchema<T>;
    private data: Map<IdType, InferCreateType<T>> = new Map<IdType, InferCreateType<T>>();

    get size() {
        return this.data.size;
    }

    constructor(schema: CompiledSchema<T>) {
        this.schema = schema;
    }

    has(key: IdType): boolean;
    has(entity: InferCreateType<T>): boolean;
    has(entity: InferType<T>): boolean;
    has(value: InferCreateType<T> | InferType<T> | IdType): boolean {

        if (typeof value === "string" || typeof value === "number") {
            return this.data.has(value);
        }

        const hash = this.schema.hash(value as InferCreateType<T>, HashType.Object);
        return this.data.has(hash);
    }

    get(key: IdType): InferCreateType<T> | undefined;
    get(entity: InferCreateType<T>): InferCreateType<T> | undefined;
    get(entity: InferType<T>): InferCreateType<T> | undefined;
    get(value: InferCreateType<T> | InferType<T> | IdType): InferCreateType<T> | undefined {

        if (typeof value === "string" || typeof value === "number") {
            return this.data.get(value);
        }

        const hash = this.schema.hash(value as InferCreateType<T>, HashType.Object);
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