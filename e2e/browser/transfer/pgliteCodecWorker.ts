/**
 * A routier-owned channel beside PGlite, for measuring only.
 *
 * `PGliteWorker` proxies every query through a protocol routier does not own, and that protocol
 * structured-clones results before routier sees them. To use the codec at all, routier would have
 * to run its own channel to a worker that holds the database — which is what this is, minus the
 * leader election and lifecycle the real thing would need.
 *
 * It exists to answer one question before that plumbing gets built: of the 19-34% of a read that
 * crossing costs, how much does the codec actually reclaim?
 */
import { PGlite } from '@electric-sql/pglite';
import { ChunkEncoder, TransferPlan } from '@routier/core/transfer';

type Queryable = {
    query(sql: string, params?: unknown[], options?: { rowMode?: 'object' | 'array' }): Promise<{ rows: unknown[] }>;
    exec(sql: string): Promise<unknown>;
};

let database: Queryable | null = null;

type Request =
    | { id: number; kind: 'open'; dataDir: string }
    | { id: number; kind: 'exec'; sql: string }
    | { id: number; kind: 'all'; sql: string; plan?: TransferPlan };

const post = (message: unknown, transferables: readonly ArrayBufferLike[] = []) =>
    (self as unknown as Worker).postMessage(message, transferables as Transferable[]);

/**
 * Reads a whole result, then encodes it in chunks.
 *
 * PGlite has no cursor — `query` resolves with every row at once — so this cannot overlap encoding
 * with the engine's own work the way the SQLite worker does. Chunking still bounds each message
 * and lets the main thread decode chunk k while k+1 is in flight.
 *
 * `rowMode: 'array'` gives values positionally in select-list order, which is exactly what the
 * encoder wants and skips PGlite building a keyed object per row that nothing would read.
 */
const streamCoded = async (id: number, sql: string, plan: TransferPlan) => {
    const result = await database!.query(sql, [], { rowMode: 'array' });
    const rows = result.rows as unknown[][];
    const encoder = new ChunkEncoder(plan);

    if (rows.length === 0) {
        const { payload, transferables } = encoder.take();

        post({ id, ok: true, chunk: payload, last: true }, transferables);
        return;
    }

    for (let i = 0; i < rows.length; i++) {
        encoder.appendRow(rows[i]);

        const last = i === rows.length - 1;

        if (encoder.isFull || last) {
            const { payload, transferables } = encoder.take();

            post({ id, ok: true, chunk: payload, last }, transferables);
        }
    }
};

self.onmessage = async (event: MessageEvent<Request>) => {
    const request = event.data;

    try {
        if (request.kind === 'open') {
            database = new PGlite(request.dataDir) as unknown as Queryable;
            await database.query('SELECT 1');
            post({ id: request.id, ok: true });
            return;
        }

        if (request.kind === 'exec') {
            await database!.exec(request.sql);
            post({ id: request.id, ok: true });
            return;
        }

        if (request.plan == null) {
            const result = await database!.query(request.sql);

            post({ id: request.id, ok: true, rows: result.rows });
            return;
        }

        await streamCoded(request.id, request.sql, request.plan);
    } catch (error) {
        post({ id: request.id, ok: false, error: (error as Error)?.message ?? String(error) });
    }
};
