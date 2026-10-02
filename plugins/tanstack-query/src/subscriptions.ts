import { hashKey, type QueryClient, type QueryKey } from "@tanstack/query-core";

const registries = new WeakMap<QueryClient, Map<string, () => void>>();

const registryFor = (client: QueryClient): Map<string, () => void> => {
    const existing = registries.get(client);

    if (existing != null) {
        return existing;
    }

    const registry = new Map<string, () => void>();

    registries.set(client, registry);
    client.getQueryCache().subscribe((event) => {
        if (event.type === "removed") {
            stopSubscription(client, event.query.queryKey);
        }
    });

    return registry;
};

export const stopSubscription = (client: QueryClient, queryKey: QueryKey): void => {
    const registry = registryFor(client);
    const hash = hashKey(queryKey);

    registry.get(hash)?.();
    registry.delete(hash);
};

export const replaceSubscription = (client: QueryClient, queryKey: QueryKey, stop: () => void): void => {
    stopSubscription(client, queryKey);
    registryFor(client).set(hashKey(queryKey), stop);
};
