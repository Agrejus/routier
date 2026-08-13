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
 * The body to send for an update: the key fields, so the server knows which row, plus the
 * fields that actually changed. Returns `null` when the whole entity has to go instead.
 *
 * An empty delta is not "nothing changed" — it is core's documented convention for "no tracked
 * change list, write the whole entity", which is what a diff-tracked or explicitly-dirtied
 * update produces (see `EntityDelta` in `@routier/core/plugins`, and the same fallback in
 * `@routier/sql-plugin-core`'s `buildConditionalUpdateOperations`). Sending keys alone in that
 * case would look like a well-formed update that changes nothing, and the edit would vanish.
 */
export function buildUpdatePayload(
    schema: CompiledSchema<Record<string, unknown>>,
    entity: unknown,
    delta: unknown
): Record<string, unknown> | null {
    if (delta == null || typeof delta !== 'object' || Object.keys(delta as object).length === 0) {
        return null;
    }

    const source = entity as Record<string, unknown>;
    const payload: Record<string, unknown> = {};

    // Storage-side names, matching what the delta and the serialized entity use
    for (const idProperty of schema.idProperties) {
        const name = idProperty.getResolvedName();
        payload[name] = source[name];
    }

    return { ...payload, ...(delta as Record<string, unknown>) };
}

/**
 * Merges two update payloads, newest winning per field.
 *
 * Needed because a queue row is keyed by (collection, kind, ids): a second update to the same
 * entity overwrites the first row, and if each row carried only its own changed fields the
 * earlier edit would be lost on the way to the server. `null` on either side means "whole
 * entity", which absorbs everything.
 */
export function mergeUpdatePayloads(
    older: Record<string, unknown> | null,
    newer: Record<string, unknown> | null
): Record<string, unknown> | null {
    if (older == null || newer == null) {
        return null;
    }

    return { ...older, ...newer };
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
