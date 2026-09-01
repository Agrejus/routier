import { ChunkEncoder, TransferPlan } from '@routier/core/transfer';

/**
 * A routier-owned channel for reads, running beside PGlite's own worker protocol.
 *
 * PGlite's `worker()` proxies every query over a `BroadcastChannel`, and a `BroadcastChannel`
 * cannot transfer anything — every result is structured-cloned before routier sees it. Measured in
 * a real browser, that crossing is 19-34% of a read. Encoding the rows columnar and transferring
 * the buffers instead reclaims almost all of it: 1.23-1.34x, with identical entities.
 *
 * The two protocols coexist rather than one replacing the other, and the reason is leader
 * election. PGlite elects one tab to own the database and proxies the rest to it, which is what
 * makes this plugin multi-tab where the SQLite one cannot be. Replacing the proxy would take that
 * away.
 *
 * They do not collide. After start-up PGlite's RPC lives entirely on its `BroadcastChannel`; the
 * worker's own `postMessage` carries only three start-up notices, and its listener for those is
 * `{ once: true }` and matched on `type`. This adds a listener that answers only its own tagged
 * messages and ignores everything else.
 *
 * **Only the leader's worker can serve these.** A worker that loses the election blocks before
 * `init` and never constructs a database, so `source()` answers `null` there and the caller falls
 * back to the proxy — which reaches the leader the ordinary way.
 */

/** Marks a message as routier's, so neither protocol has to understand the other's. */
export const CODED_READ = 'routier-coded-read';

export type CodedReadRequest = {
    type: typeof CODED_READ;
    id: number;
    sql: string;
    params: readonly unknown[];
    plan: TransferPlan;
};

export type CodedReadResponse =
    | { type: typeof CODED_READ; id: number; ok: true; chunk: unknown; last: boolean }
    | { type: typeof CODED_READ; id: number; ok: false; error: string }
    /** This worker is not the leader, so it has no database. The caller uses the proxy. */
    | { type: typeof CODED_READ; id: number; ok: false; unavailable: true; error: string };

/** The part of PGlite this needs. Structural, so the worker file owns the import. */
export type CodedReadSource = {
    query(sql: string, params?: unknown[], options?: { rowMode?: 'array' }): Promise<{ rows: unknown[] }>;
};

const isCodedRead = (value: unknown): value is CodedReadRequest =>
    (value as { type?: unknown } | null)?.type === CODED_READ;

/**
 * Answers coded reads on this worker's own `postMessage`.
 *
 * @param source Yields the database, or `null` when this worker is not the leader and therefore
 * never built one.
 */
export const serveCodedReads = (source: () => CodedReadSource | null): void => {
    const post = (message: CodedReadResponse, transferables: readonly ArrayBufferLike[] = []) =>
        (self as unknown as Worker).postMessage(message, transferables as Transferable[]);

    self.addEventListener('message', async (event: MessageEvent<unknown>) => {
        if (isCodedRead(event.data) === false) {
            // PGlite's own start-up traffic. Not ours to answer.
            return;
        }

        const request = event.data;

        try {
            const database = source();

            if (database == null) {
                post({
                    type: CODED_READ,
                    id: request.id,
                    ok: false,
                    unavailable: true,
                    error: 'this worker does not hold the database',
                });
                return;
            }

            await streamCoded(database, request, post);
        } catch (error) {
            post({
                type: CODED_READ,
                id: request.id,
                ok: false,
                error: (error as Error)?.message ?? String(error),
            });
        }
    });
};

/**
 * Runs the statement and posts its rows as columnar chunks.
 *
 * `rowMode: 'array'` gives values positionally in select-list order — exactly what the encoder
 * takes, and it skips PGlite building a keyed object per row that nothing here would read.
 *
 * PGlite resolves with every row at once rather than yielding a cursor, so this cannot overlap
 * encoding with the engine's work the way a stepping statement can. Chunking still bounds each
 * message and lets the main thread decode one chunk while the next is in flight.
 */
const streamCoded = async (
    database: CodedReadSource,
    request: CodedReadRequest,
    post: (message: CodedReadResponse, transferables?: readonly ArrayBufferLike[]) => void
): Promise<void> => {
    const result = await database.query(request.sql, request.params as unknown[], { rowMode: 'array' });
    const rows = result.rows as unknown[][];
    const encoder = new ChunkEncoder(request.plan);

    if (rows.length === 0) {
        const { payload, transferables } = encoder.take();

        post({ type: CODED_READ, id: request.id, ok: true, chunk: payload, last: true }, transferables);
        return;
    }

    for (let i = 0; i < rows.length; i++) {
        encoder.appendRow(rows[i]);

        const last = i === rows.length - 1;

        if (encoder.isFull || last) {
            const { payload, transferables } = encoder.take();

            post({ type: CODED_READ, id: request.id, ok: true, chunk: payload, last }, transferables);
        }
    }
};
