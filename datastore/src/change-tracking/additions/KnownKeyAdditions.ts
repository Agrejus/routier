import { CompiledSchema, IdType, InferCreateType, InferType } from "@routier/core/schema";
import { IAdditions } from "./types";

export class KnownKeyAdditions<T extends {}> implements IAdditions<T> {

    private schema: CompiledSchema<T>;
    private data: Map<IdType, InferCreateType<T>> = new Map<IdType, InferCreateType<T>>();

    get size() {
        return this.data.size;
    }

    constructor(schema: CompiledSchema<T>) {
        this.schema = schema;
    }

    take(entity: InferCreateType<T>): InferCreateType<T> | undefined {
        const id = this.schema.getId(entity as InferType<T>);
        const found = this.data.get(id);

        // Destructive to honor the interface contract; with unique ids per pending row it
        // makes no behavioral difference, since each id is resolved at most once per save.
        this.data.delete(id);

        return found;
    }

    values(): InferCreateType<T>[] {
        return [...this.data.values()];
    }

    set(entity: InferCreateType<T>) {
        const id = this.schema.getId(entity as InferType<T>);
        this.data.set(id, entity);
    }

    replace(existing: InferCreateType<T>, next: InferCreateType<T>) {
        // The key is the id, so it only moves when the patch changed the key itself.
        this.data.delete(this.schema.getId(existing as InferType<T>));
        this.set(next);
    }

    clear(): void {
        this.data.clear();
    }
}