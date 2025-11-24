import { CompiledSchema, IdType, InferCreateType, InferType } from "@routier/core/schema";
import { IAdditionsCollection } from "./types";

export class KnownKeyAdditionCollection<T extends {}> implements IAdditionsCollection<T> {

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

        const id = this.schema.getId(value as InferType<T>);
        return this.data.has(id);
    }

    get(key: IdType): InferCreateType<T> | undefined;
    get(entity: InferCreateType<T>): InferCreateType<T> | undefined;
    get(entity: InferType<T>): InferCreateType<T> | undefined;
    get(value: InferCreateType<T> | InferType<T> | IdType): InferCreateType<T> | undefined {

        if (typeof value === "string" || typeof value === "number") {
            return this.data.get(value);
        }

        const id = this.schema.getId(value as InferType<T>);
        return this.data.get(id);
    }

    values(): InferCreateType<T>[] {
        return [...this.data.values()];
    }

    set(entity: InferCreateType<T>) {
        const id = this.schema.getId(entity as InferType<T>);
        this.data.set(id, entity);
    }

    clear(): void {
        this.data.clear();
    }
}