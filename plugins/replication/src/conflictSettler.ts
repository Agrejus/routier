import { isDeferred, type ConflictResolution, type ConflictResolver } from '@routier/core/plugins';
import type { CompiledSchema } from '@routier/core/schema';
import { logger, type UnknownRecord } from '@routier/core/utilities';
import { HttpStatusError, isConflictStatus } from './httpUtils';
import { NOTHING_DELIVERED, type ConflictSettler, type DeliveryOutcome } from './queuedWrites';
import { failureKindOf } from './requestFailures';
import { isRecord } from './records';
import { buildUpdatePayload } from './swrUtils';
import { emitEvent, type FailureKind, type SyncEvent } from './syncHooks';
import type { QueuedChange, UnsyncedFlushUnit, UnsyncedQueue } from './UnsyncedQueue';

export type ConflictHandlingOptions = {
    /** Decides a write the server refused as a conflict. Without it, a conflict is handled like any other failed write. */
    resolveConflict?: ConflictResolver;
    /** Whether a failed write is a conflict. Default: an HTTP 409. */
    isConflict?: (failure: FailureKind) => boolean;
    /** Reads the server's current row when the conflict response does not carry it. */
    fetchRemote?: (collectionName: string, local: UnknownRecord) => Promise<UnknownRecord | null>;
};

/** A row to write into the local store: the server's or the merged one, or the local one to remove. */
export type ResolvedRow = { put: UnknownRecord } | { remove: UnknownRecord };

export type ConflictSettlerDependencies = {
    queue: UnsyncedQueue;
    schemaOf: (collectionName: string) => CompiledSchema<UnknownRecord> | null;
    fetchRemote: (schema: CompiledSchema<UnknownRecord>, local: UnknownRecord) => Promise<UnknownRecord | null>;
    applyRow: (schema: CompiledSchema<UnknownRecord>, row: ResolvedRow) => Promise<void>;
    onEvent?: (event: SyncEvent) => void;
    flushSoon: () => void;
};

type Schema = CompiledSchema<UnknownRecord>;

const SETTLED: DeliveryOutcome = { ...NOTHING_DELIVERED, resolved: 1 };
const STILL_QUEUED: DeliveryOutcome = { ...NOTHING_DELIVERED, failed: 1 };

export const isConflictResponse = (failure: FailureKind): boolean =>
    failure.kind === 'http' && isConflictStatus(failure.status);


const idsOf = (schema: Schema, row: UnknownRecord) => JSON.stringify(schema.idProperties.map(property => row[property.getResolvedName()]));

export const sameKeys = (schema: Schema, left: UnknownRecord, right: UnknownRecord): boolean => idsOf(schema, left) === idsOf(schema, right);

/** The server's row, when the conflict response carries it as the body or as its `current` or `remote` field. */
export const remoteInResponse = (schema: Schema, local: UnknownRecord, error: Error): UnknownRecord | null => {
    const body = error instanceof HttpStatusError ? error.responseBody : null;

    if (isRecord(body) === false) {
        return null;
    }

    const wanted = idsOf(schema, local);
    const candidates = [body, Reflect.get(body, 'current'), Reflect.get(body, 'remote')];

    return candidates.find((candidate): candidate is UnknownRecord => isRecord(candidate) && idsOf(schema, candidate) === wanted) ?? null;
};

/** A stored row in the application's shape. The schema here is untyped, as everywhere in this plugin, so its rows are cast at the call. */
const toApp = (schema: Schema, row: UnknownRecord): UnknownRecord => schema.deserialize(row as never);

/** An application row in the stored shape. */
const toStored = (schema: Schema, row: UnknownRecord): UnknownRecord => schema.serialize(row as never);

const rootColumns = (schema: Schema) => schema.properties.filter(property => property.parent == null);

/**
 * The values `stored` holds for the fields an update changes: the fields in `delta`, or every
 * root field when the delta is empty, which means the whole row was written.
 */
export const baseOf = (schema: Schema, stored: UnknownRecord | undefined, delta: UnknownRecord): UnknownRecord => {
    if (stored == null) {
        return {};
    }

    const changed = Object.keys(delta);
    const columns = changed.length > 0 ? changed : rootColumns(schema).map(property => property.getResolvedName());

    return Object.fromEntries(columns.filter(column => column in stored).map(column => [column, stored[column]]));
};

const appBase = (schema: Schema, base: UnknownRecord) => schema.deserializePartial(base, rootColumns(schema));

const same = <TValue>(left: TValue, right: TValue) => JSON.stringify(left) === JSON.stringify(right);

/** The root columns where `row` differs from `remote`. */
const changedFrom = (schema: Schema, remote: UnknownRecord, row: UnknownRecord): UnknownRecord => {
    const changed: UnknownRecord = {};

    for (const property of rootColumns(schema)) {
        const column = property.getResolvedName();

        if (same(row[column], remote[column]) === false) {
            changed[column] = row[column];
        }
    }

    return changed;
};

const withServerEtag = (schema: Schema, row: UnknownRecord, remote: UnknownRecord): UnknownRecord => {
    const etag = schema.etagProperty?.getResolvedName();

    return etag == null ? row : { ...row, [etag]: remote[etag] };
};

/**
 * The row to keep and the change that sends it over the server's version, or `null` when it
 * already matches the server's row.
 */
export const requeuedChange = (schema: Schema, row: UnknownRecord, remote: UnknownRecord | null): { entity: UnknownRecord; change: QueuedChange } | null => {
    if (remote == null) {
        return { entity: row, change: { kind: 'add', entity: row } };
    }

    const entity = withServerEtag(schema, row, remote);
    const changed = changedFrom(schema, remote, entity);

    if (Object.keys(changed).length === 0) {
        return null;
    }

    const base = Object.fromEntries(Object.keys(changed).map(column => [column, remote[column]]));

    return { entity, change: { kind: 'update', entity, payload: buildUpdatePayload(schema, entity, changed), base } };
};

export const createConflictSettler = (
    resolver: ConflictResolver,
    isConflict: (failure: FailureKind) => boolean,
    dependencies: ConflictSettlerDependencies
): ConflictSettler => {
    const { queue, onEvent } = dependencies;

    const resolved = (collectionName: string, outcome: 'merged' | 'server' | 'deferred') =>
        emitEvent(onEvent, { type: 'conflict-resolved', collectionName, outcome });

    const applyResolution = async (collectionName: string, schema: Schema, unit: UnsyncedFlushUnit, local: UnknownRecord, remote: UnknownRecord | null, resolution: ConflictResolution): Promise<DeliveryOutcome> => {
        if (isDeferred(resolution)) {
            await queue.recordFailedAttempt(unit.rows);
            resolved(collectionName, 'deferred');
            return STILL_QUEUED;
        }

        const row = resolution == null ? null : toStored(schema, resolution);
        const requeued = row == null ? null : requeuedChange(schema, row, remote);

        if (requeued == null) {
            await dependencies.applyRow(schema, remote == null ? { remove: local } : { put: remote });
            await queue.removeRows(unit.rows);
            resolved(collectionName, 'server');
            return SETTLED;
        }

        await dependencies.applyRow(schema, { put: requeued.entity });
        await queue.removeRows(unit.rows);
        await queue.addMany(schema, [requeued.change]);
        resolved(collectionName, 'merged');
        dependencies.flushSoon();
        return SETTLED;
    };

    const settle = async (collectionName: string, unit: UnsyncedFlushUnit, error: Error): Promise<DeliveryOutcome | 'reject'> => {
        const schema = dependencies.schemaOf(collectionName);
        const local = unit.entity;

        if (schema == null || isRecord(local) === false) {
            return 'reject';
        }

        let remote: UnknownRecord | null;

        try {
            remote = remoteInResponse(schema, local, error) ?? await dependencies.fetchRemote(schema, local);
        } catch (fetchError) {
            logger.warn('[HttpSwrDbPlugin] could not read the server row for a conflict; the change stays queued', { collectionName, error: fetchError });
            await queue.recordFailedAttempt(unit.rows);
            return STILL_QUEUED;
        }

        let resolution: ConflictResolution;

        try {
            resolution = await resolver({
                collectionName,
                kind: unit.kind,
                base: appBase(schema, unit.base),
                local: toApp(schema, local),
                remote: remote == null ? null : toApp(schema, remote),
            });
        } catch (resolverError) {
            logger.warn('[HttpSwrDbPlugin] resolveConflict threw; the change is rejected', { collectionName, error: resolverError });
            return 'reject';
        }

        return applyResolution(collectionName, schema, unit, local, remote, resolution);
    };

    return {
        isConflict: error => {
            const failure = failureKindOf(error);

            return failure != null && isConflict(failure);
        },
        settle,
    };
};
