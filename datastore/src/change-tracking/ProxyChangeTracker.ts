import { IdType, unsafeCast } from "@routier/core";
import { IChangeTracker, TrackedEntity } from "./types";
import { ChangeTrackedEntity } from "../types";

export class ProxyChangeTracker<T extends {}> implements IChangeTracker<T> {

    private data: Map<IdType, TrackedEntity<T>> = new Map<IdType, TrackedEntity<T>>();

    get size(): number {
        return this.data.size;
    }

    hasChanges() {
        let hasChanges = false;

        for (const [, attachment] of this.data) {

            const changeTrackedDoc = unsafeCast<ChangeTrackedEntity<{}>>(attachment.doc);
            const changeType = attachment.changeType;

            if (changeTrackedDoc.__tracking__?.isDirty === true || changeType !== "notModified") {
                hasChanges = true;
                break
            }
        }

        return hasChanges;
    }

    set(key: IdType, value: TrackedEntity<T>) {
        this.data.set(key, value);
    }

    get(key: IdType): TrackedEntity<T> | undefined {
        return this.data.get(key);
    }

    has(key: IdType): boolean {
        return this.data.has(key);
    }

    delete(key: IdType): boolean {
        return this.data.delete(key);
    }

    entries() {
        return this.data.entries();
    }

    values() {
        return this.data.values();
    }

    [Symbol.iterator](): IterableIterator<[IdType, TrackedEntity<T>]> {
        return this.data[Symbol.iterator]();
    }

}