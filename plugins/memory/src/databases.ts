import type { MemoryDataCollection } from "@routier/core/collections";

export type MemoryDatabase = Record<string, MemoryDataCollection>;

const databases = new Map<string, MemoryDatabase>();

export const openDatabase = (name: string): MemoryDatabase => {
    const existing = databases.get(name);

    if (existing != null) {
        return existing;
    }

    const created: MemoryDatabase = {};

    databases.set(name, created);

    return created;
};

export const closeDatabase = (name: string): void => {
    databases.delete(name);
};

export const databaseNames = (): string[] => [...databases.keys()];
