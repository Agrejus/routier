import * as http from 'node:http';
import type { AddressInfo } from 'node:net';
import { applySort, matchesFilter, type FilterNode } from './filter';

/**
 * A real HTTP server speaking the Routier replication wire contract.
 *
 * The repository already had an in-process server inside one test file
 * (`plugins/replication/src/httpServer.e2e.test.ts`). This is that idea promoted to a
 * workspace, for one reason the inline version cannot serve: **a test needs to change the
 * server's data without the client having asked for it.**
 *
 * Every replication test written so far drives the server through the client — write, flush,
 * read back. That only ever exercises client→server. The interesting direction is the other
 * one: a row deleted by another user, a row edited by a background job, a page of results
 * that shifts under a paginated reader. None of that is reachable unless the test can reach
 * past the client and mutate the server directly, which is what {@link SyncServer.admin} is.
 *
 * ## Wire contract
 *
 * - `GET /{collection}?filter=&sort=&skip=&take=` — the query parameters
 *   `buildQueryParams` emits. All four are honoured server-side; see the note on `filter`.
 * - `POST /{collection}` — `{ adds, updates, removes, meta: { opIds } }`. Replays are deduped
 *   by opId. Responds `{ saved: [...] }`, the shape `translatePersistResponse` reads.
 *
 * ## Faults
 *
 * `latencyMs`, `failNextRequests`, `status` and `hang` exist so a test can make the network
 * behave badly on purpose. They are deliberately crude: a test that needs a specific failure
 * should set it, assert, and clear it.
 */

export type Row = Record<string, unknown>;

/** What a test uses to change the world behind the client's back. */
export interface SyncServerAdmin {
    /** Replaces a collection's contents outright. */
    seed(collection: string, rows: Row[]): void;
    /** Inserts or replaces rows, keyed by `id`. */
    upsert(collection: string, rows: Row[]): void;
    /** Deletes by id. Returns how many actually went. */
    remove(collection: string, ids: string[]): number;
    /** Applies a mutation to one row in place. No-op when the row is absent. */
    patch(collection: string, id: string, changes: Row): void;
    /** Everything currently stored, sorted by id — the oracle a test asserts against. */
    rows(collection: string): Row[];
    /** Drops every collection and all opId history. */
    reset(): void;
}

export interface SyncServerOptions {
    /** Port to bind. 0 (default) picks a free one. */
    port?: number;
    /** Property holding each row's identity. Default `id`. */
    idProperty?: string;
    /**
     * Rewrites a row on the way in, so the server can be canonical about something the
     * client cannot know — a server-assigned timestamp or version. Applied to adds and
     * updates, and the result is what lands in storage and comes back in `saved`.
     */
    stamp?: (row: Row, context: { collection: string; kind: 'add' | 'update' }) => Row;
}

export interface RequestLogEntry {
    method: string;
    collection: string;
    /** Query parameters as sent, so a test can assert the client really pushed a filter down. */
    query: Record<string, string>;
    status: number;
    at: number;
}

export class SyncServer {
    private readonly collections = new Map<string, Map<string, Row>>();
    private readonly seenOpIds = new Set<string>();
    private readonly idProperty: string;
    private readonly stamp: SyncServerOptions['stamp'];
    private server: http.Server | null = null;
    private boundPort = 0;

    /** Every request served, in order. Reset with `clearLog()`. */
    readonly requestLog: RequestLogEntry[] = [];

    /** Artificial delay before responding, in milliseconds. */
    latencyMs = 0;
    /** Accept and never answer, for exercising client timeouts. */
    hang = false;
    /** Fail this many upcoming requests with `failStatus`, then behave. */
    failNextRequests = 0;
    failStatus = 500;

    constructor(private readonly options: SyncServerOptions = {}) {
        this.idProperty = options.idProperty ?? 'id';
        this.stamp = options.stamp;
    }

    async start(): Promise<void> {
        const server = http.createServer((req, res) => {
            void this.handle(req, res);
        });

        this.server = server;

        await new Promise<void>(resolve =>
            server.listen(this.options.port ?? 0, '127.0.0.1', () => resolve())
        );

        this.boundPort = (server.address() as AddressInfo).port;
    }

    /** Closes the listener and drops live sockets, so a hung request cannot outlive a test. */
    async stop(): Promise<void> {
        const server = this.server;

        if (server == null) {
            return;
        }

        this.server = null;
        (server as { closeAllConnections?: () => void }).closeAllConnections?.();

        await new Promise<void>(resolve => server.close(() => resolve()));
    }

    get port(): number {
        return this.boundPort;
    }

    get origin(): string {
        return `http://127.0.0.1:${this.boundPort}`;
    }

    /** The URL to hand a plugin for one collection. */
    url(collection: string): string {
        return `${this.origin}/${collection}`;
    }

    clearLog(): void {
        this.requestLog.length = 0;
    }

    /** GETs served for a collection — how a test proves a revalidate did or did not happen. */
    getCount(collection?: string): number {
        return this.requestLog.filter(
            entry => entry.method === 'GET' && (collection == null || entry.collection === collection)
        ).length;
    }

    readonly admin: SyncServerAdmin = {
        seed: (collection, rows) => {
            const map = new Map<string, Row>();

            for (const row of rows) {
                map.set(String(row[this.idProperty]), { ...row });
            }

            this.collections.set(collection, map);
        },

        upsert: (collection, rows) => {
            const map = this.collectionFor(collection);

            for (const row of rows) {
                map.set(String(row[this.idProperty]), { ...row });
            }
        },

        remove: (collection, ids) => {
            const map = this.collectionFor(collection);
            let removed = 0;

            for (const id of ids) {
                if (map.delete(String(id))) {
                    removed++;
                }
            }

            return removed;
        },

        patch: (collection, id, changes) => {
            const map = this.collectionFor(collection);
            const existing = map.get(String(id));

            if (existing == null) {
                return;
            }

            map.set(String(id), { ...existing, ...changes });
        },

        rows: collection => this.sortedRows(collection),

        reset: () => {
            this.collections.clear();
            this.seenOpIds.clear();
            this.requestLog.length = 0;
        },
    };

    private collectionFor(collection: string): Map<string, Row> {
        const existing = this.collections.get(collection);

        if (existing != null) {
            return existing;
        }

        const created = new Map<string, Row>();
        this.collections.set(collection, created);

        return created;
    }

    private sortedRows(collection: string): Row[] {
        return [...this.collectionFor(collection).values()]
            .map(row => ({ ...row }))
            .sort((a, b) => {
                const left = String(a[this.idProperty]);
                const right = String(b[this.idProperty]);

                return left < right ? -1 : left > right ? 1 : 0;
            });
    }

    private async handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        if (this.hang) {
            return;
        }

        if (this.latencyMs > 0) {
            await new Promise<void>(resolve => setTimeout(resolve, this.latencyMs));
        }

        const url = new URL(req.url ?? '/', this.origin);
        const collection = url.pathname.slice(1);
        const query: Record<string, string> = {};

        url.searchParams.forEach((value, key) => {
            query[key] = value;
        });

        const log = (status: number) => {
            this.requestLog.push({ method: req.method ?? 'GET', collection, query, status, at: Date.now() });
        };

        if (this.failNextRequests > 0) {
            this.failNextRequests--;
            log(this.failStatus);
            this.send(res, this.failStatus, { error: 'injected failure' });
            return;
        }

        if (req.method === 'GET') {
            log(200);
            this.send(res, 200, this.read(collection, url));
            return;
        }

        if (req.method !== 'POST') {
            log(405);
            this.send(res, 405, { error: 'method not allowed' });
            return;
        }

        let raw = '';
        req.setEncoding('utf8');
        req.on('data', (chunk: string) => {
            raw += chunk;
        });

        req.on('end', () => {
            let body: PostBody;

            try {
                body = JSON.parse(raw) as PostBody;
            } catch {
                log(400);
                this.send(res, 400, { error: 'malformed body' });
                return;
            }

            const saved = this.write(collection, body);
            log(200);
            this.send(res, 200, { saved });
        });
    }

    /**
     * Applies `filter`, `sort`, `skip` and `take` before responding.
     *
     * Doing the work rather than returning everything is the point: a client that pushes a
     * predicate down and a client that fetches the world and filters locally are
     * indistinguishable against a server that ignores the parameters, and only one of them
     * is correct.
     */
    private read(collection: string, url: URL): Row[] {
        let rows = this.sortedRows(collection);

        const filterParam = url.searchParams.get('filter');

        if (filterParam != null && filterParam !== '') {
            let node: FilterNode;

            try {
                node = JSON.parse(filterParam) as FilterNode;
            } catch {
                throw new Error(`sync-server: filter parameter is not valid JSON: ${filterParam}`);
            }

            rows = rows.filter(row => matchesFilter(row, node));
        }

        rows = applySort(rows, url.searchParams.get('sort'));

        const skip = Number(url.searchParams.get('skip') ?? '0');
        const take = url.searchParams.get('take');

        if (Number.isFinite(skip) && skip > 0) {
            rows = rows.slice(skip);
        }

        if (take != null && take !== '') {
            const limit = Number(take);

            if (Number.isFinite(limit) && limit >= 0) {
                rows = rows.slice(0, limit);
            }
        }

        return rows;
    }

    private write(collection: string, body: PostBody): Row[] {
        const map = this.collectionFor(collection);
        const opIds = body.meta?.opIds;
        const saved: Row[] = [];

        const each = (rows: Row[] | undefined, ids: string[] | undefined, apply: (row: Row) => void) => {
            (rows ?? []).forEach((row, index) => {
                const opId = ids?.[index];

                // Replay protection. The client retries a flush it never saw acknowledged, so
                // without this a dropped response turns one write into two.
                if (opId != null && opId !== '') {
                    if (this.seenOpIds.has(opId)) {
                        return;
                    }

                    this.seenOpIds.add(opId);
                }

                apply(row);
            });
        };

        each(body.adds, opIds?.adds, row => {
            const stored = this.stamp?.({ ...row }, { collection, kind: 'add' }) ?? { ...row };
            map.set(String(stored[this.idProperty]), stored);
            saved.push(stored);
        });

        each(body.updates, opIds?.updates, row => {
            const stored = this.stamp?.({ ...row }, { collection, kind: 'update' }) ?? { ...row };
            map.set(String(stored[this.idProperty]), stored);
            saved.push(stored);
        });

        each(body.removes, opIds?.removes, row => {
            map.delete(String(row[this.idProperty]));
        });

        return saved;
    }

    private send(res: http.ServerResponse, status: number, body: unknown): void {
        const payload = JSON.stringify(body);

        res.writeHead(status, {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
        });

        res.end(payload);
    }
}

interface PostBody {
    adds?: Row[];
    updates?: Row[];
    removes?: Row[];
    meta?: { opIds?: { adds?: string[]; updates?: string[]; removes?: string[] } };
}

/** Starts a server on a free port. `await using` or call `stop()` yourself. */
export async function startSyncServer(options: SyncServerOptions = {}): Promise<SyncServer> {
    const server = new SyncServer(options);
    await server.start();

    return server;
}
