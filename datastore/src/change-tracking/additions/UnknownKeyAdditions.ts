import { CompiledSchema, IdType, InferCreateType, HashType } from "@routier/core/schema";
import { IAdditions } from "./types";

export class UnknownKeyAdditions<T extends {}> implements IAdditions<T> {

    private schema: CompiledSchema<T>;
    // A MULTIMAP, not a map: the key is a hash of the content with keys and identities
    // excluded, so two pending rows that are equal in content share a bucket. A plain map
    // silently collapsed them — one row was never inserted at all (defect #23).
    private data: Map<IdType, InferCreateType<T>[]> = new Map<IdType, InferCreateType<T>[]>();
    private count = 0;

    get size() {
        return this.count;
    }

    constructor(schema: CompiledSchema<T>) {
        this.schema = schema;
    }

    take(entity: InferCreateType<T>): InferCreateType<T> | undefined {
        const hash = this.schema.hash(entity, HashType.Object);
        const bucket = this.data.get(hash);

        if (bucket == null || bucket.length === 0) {
            return undefined;
        }

        // Rows in one bucket are equal on every hashed property and have no identity yet,
        // so which one is paired with which returned row is unobservable — any entry is
        // correct. Removing it is what lets the NEXT identical returned row find the next
        // pending entry instead of the same one twice.
        const found = bucket.shift();

        if (bucket.length === 0) {
            this.data.delete(hash);
        }

        this.count--;

        return found;
    }

    values(): InferCreateType<T>[] {
        const result: InferCreateType<T>[] = [];

        for (const bucket of this.data.values()) {
            result.push(...bucket);
        }

        return result;
    }

    set(entity: InferCreateType<T>) {
        const hash = this.schema.hash(entity, HashType.Object);
        const bucket = this.data.get(hash);

        if (bucket == null) {
            this.data.set(hash, [entity]);
        } else {
            bucket.push(entity);
        }

        this.count++;
    }

    replace(existing: InferCreateType<T>, next: InferCreateType<T>) {
        // The key is a hash of the CONTENT, so any patch moves it. Only the caller's own
        // reference is removed from the old bucket — an identical sibling row must stay.
        const bucket = this.data.get(this.schema.hash(existing, HashType.Object));

        if (bucket != null) {
            const index = bucket.indexOf(existing);

            if (index !== -1) {
                bucket.splice(index, 1);
                this.count--;

                if (bucket.length === 0) {
                    this.data.delete(this.schema.hash(existing, HashType.Object));
                }
            }
        }

        this.set(next);
    }

    clear(): void {
        this.data.clear();
        this.count = 0;
    }
}
