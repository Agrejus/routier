import { QueryOptionsCollection } from "../plugins/query";

export const combineQueryOptionsCollections = <T>(...collections: QueryOptionsCollection<T>[]) => {
    const result = new QueryOptionsCollection<T>();

    for (let i = 0, length = collections.length; i < length; i++) {
        const collection = collections[i];

        // Add scoped items first
        collection.forEach(item => {
            result.add(item.name, item.value);
        });
    }

    return result;
}