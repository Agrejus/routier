/**
 * Shared utilities for SWR (stale-while-revalidate) logic.
 */

import type { CompiledSchema } from '@routier/core/schema';

/**
 * Serializes entity id(s) to a stable string key (e.g. for unsynced queue or deduplication).
 */
export function entityIdKey(schema: CompiledSchema<Record<string, unknown>>, entity: unknown): string {
    return JSON.stringify(schema.getIds(entity as never));
}

/**
 * Compares two result arrays using the schema's compare and compareIds.
 * Order-independent: treats as sets (match by id, then compare).
 */
export function resultSetsEqual(
    schema: CompiledSchema<Record<string, unknown>>,
    cached: unknown[],
    source: unknown[]
): boolean {
    if (cached.length !== source.length) {
        return false;
    }
    const used = new Set<number>();
    for (const sourceItem of source) {
        let found = false;
        for (let i = 0; i < cached.length; i++) {
            if (used.has(i)) {
                continue;
            }
            const cachedItem = cached[i];
            if (
                schema.compareIds(sourceItem as never, cachedItem as never) &&
                schema.compare(sourceItem as never, cachedItem as never)
            ) {
                used.add(i);
                found = true;
                break;
            }
        }
        if (!found) {
            return false;
        }
    }
    return true;
}
