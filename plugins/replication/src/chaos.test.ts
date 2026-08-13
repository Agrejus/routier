import { describe, it, expect, afterAll } from '@jest/globals';
import { MemoryPlugin } from '@routier/memory-plugin';
import { Result } from '@routier/core/results';
import { uuid } from '@routier/core/utilities';
import { HttpSwrDbPlugin } from './HttpSwrDbPlugin';
import {
    createPersistEvent,
    destroyEvent,
    installFetchMock,
    queryPlugin,
    readQueueRows,
    sleep,
    waitFor,
    type FetchCall,
    type HttpResponseSpec,
} from './__tests__/httpTestKit';

/**
 * Tier 4b — chaos. A model server behind the fetch mock takes real writes while the
 * network misbehaves: requests lost before the server saw them, acks lost after it
 * applied them, throttling, and latency. Every choice comes from a seeded PRNG, so a
 * failure reproduces from its test name alone.
 *
 * What it is really testing is the promise at the top of the hardening effort: no acked
 * write is ever lost. Once the network heals and the queue drains, the server must hold
 * exactly the writes the caller was told succeeded — no more, no less — and the SWR
 * store must agree with the server.
 */

/** Widen the sweep for a soak run: CHAOS_SEEDS=200 npx jest chaos */
const SEEDS = Number(process.env.CHAOS_SEEDS ?? 25);
const OPS_PER_SEED = Number(process.env.CHAOS_OPS ?? 40);

type Row = { id: string; name: string };

/** mulberry32 — small, fast, and seeded, so no op sequence depends on Math.random. */
function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

interface PostBody {
    adds: Row[];
    updates: Row[];
    removes: Row[];
    meta?: { opIds?: { adds?: string[]; updates?: string[]; removes?: string[] } };
}

/** Totals across every seed, so the run can prove the fault modes were actually reached. */
const totals = { replaysDeduped: 0, lostRequests: 0, lostAcks: 0, throttled: 0, metaViolations: 0 };

/**
 * A server that stores rows and remembers the opIds it has processed. The opId set is the
 * whole point of the `meta` block on the wire: when an ack is lost the client replays the
 * change, and a server that tracks opIds applies it exactly once.
 */
class ModelServer {
    readonly rows = new Map<string, Row>();
    private readonly seenOpIds = new Set<string>();
    private faultsEnabled = true;

    constructor(private readonly rng: () => number) { }

    heal(): void {
        this.faultsEnabled = false;
    }

    snapshot(): Row[] {
        return [...this.rows.values()].map((r) => ({ id: r.id, name: r.name })).sort(byId);
    }

    get(): HttpResponseSpec {
        const latencyMs = Math.floor(this.rng() * 8);

        if (this.faultsEnabled && this.rng() < 0.15) {
            return { status: 503, headers: { 'Retry-After': '0' }, delayMs: latencyMs };
        }

        return { status: 200, body: this.snapshot(), delayMs: latencyMs };
    }

    post(call: FetchCall): HttpResponseSpec {
        const body = call.body as PostBody;
        this.validateMeta(body);
        const latencyMs = Math.floor(this.rng() * 8);

        if (!this.faultsEnabled) {
            this.apply(body);
            return { status: 200, body: {}, delayMs: latencyMs };
        }

        const roll = this.rng();

        // Lost on the way there: the server never saw it, so the change must stay queued
        if (roll < 0.15) {
            totals.lostRequests++;
            return { status: 500, delayMs: latencyMs };
        }

        // Lost on the way back: applied, but the client is told it failed. The replay that
        // follows is what opId dedupe exists for.
        if (roll < 0.3) {
            totals.lostAcks++;
            this.apply(body);
            return { status: 500, delayMs: latencyMs };
        }

        if (roll < 0.4) {
            totals.throttled++;
            return { status: 503, headers: { 'Retry-After': '0' }, delayMs: latencyMs };
        }

        this.apply(body);
        return { status: 200, body: {}, delayMs: latencyMs };
    }

    /** opIds are parallel to the change arrays; a mismatch would silently misattribute them. */
    private validateMeta(body: PostBody): void {
        const opIds = body.meta?.opIds;
        if (
            opIds == null ||
            opIds.adds?.length !== body.adds.length ||
            opIds.updates?.length !== body.updates.length ||
            opIds.removes?.length !== body.removes.length
        ) {
            totals.metaViolations++;
        }
    }

    private apply(body: PostBody): void {
        const opIds = body.meta?.opIds;

        this.applyEach(body.adds, opIds?.adds, (row) => this.rows.set(row.id, row));
        // Upsert on update: an update can outlive an add whose request was lost, and the
        // client's coalescing means this is the newest local state either way.
        this.applyEach(body.updates, opIds?.updates, (row) => this.rows.set(row.id, row));
        this.applyEach(body.removes, opIds?.removes, (row) => this.rows.delete(row.id));
    }

    private applyEach(rows: Row[], opIds: string[] | undefined, apply: (row: Row) => void): void {
        rows.forEach((row, index) => {
            const opId = opIds?.[index];

            if (opId != null && opId !== '' && this.seenOpIds.has(opId)) {
                totals.replaysDeduped++;
                return;
            }

            if (opId != null && opId !== '') {
                this.seenOpIds.add(opId);
            }

            apply(row);
        });
    }
}

function byId(a: Row, b: Row): number {
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Waits until the plugin has no request in flight and no revalidate running. */
async function quiesce(plugin: HttpSwrDbPlugin): Promise<void> {
    // Every request now goes through httpPlugin, so idleness is asked of it: open sockets, plus
    // anything still held at its pacing gate. missPacer covers the fetch-and-store work on top.
    const internals = plugin as never as {
        httpPlugin: { requests: { active: Set<unknown> }; pendingRequestCount: () => number };
        missPacer: { pendingCount: () => number };
    };

    await waitFor(
        () => internals.httpPlugin.requests.active.size === 0
            && internals.httpPlugin.pendingRequestCount() === 0
            && internals.missPacer.pendingCount() === 0,
        'the plugin to go idle',
        4000
    );
    // Let the dequeue / store writes that follow a settled request finish
    await sleep(5);
}

/**
 * Reads through the plugin and waits for the revalidate the read triggers.
 *
 * A stale cache hit answers from the store and schedules the revalidate on a timer, so the
 * read resolving says nothing about the fetch having started — waiting for the plugin to look
 * idle would just observe the moment before it got busy. Waiting for the GET first is what
 * keeps the op sequence sequential, and therefore reproducible from the seed.
 */
async function queryAndSettle(plugin: HttpSwrDbPlugin, http: ReturnType<typeof installFetchMock>): Promise<void> {
    const getsBefore = http.gets.length;
    await queryPlugin(plugin);
    await waitFor(() => http.gets.length > getsBefore, 'the read to reach the network', 4000);
}

/**
 * Resolves on the ack itself — no settle delay. The ack is the contract under test: from
 * here on the write is the queue's responsibility, whatever the network does.
 */
function persistAck(plugin: HttpSwrDbPlugin, changes: { adds?: Row[]; updates?: Row[]; removes?: Row[] }): Promise<void> {
    return new Promise((resolve, reject) => {
        plugin.bulkPersist(createPersistEvent(changes), (result) => {
            if (result.ok === Result.ERROR) {
                reject(result.error);
                return;
            }
            resolve();
        });
    });
}

describe('chaos: an acked write always reaches the server once the network heals', () => {
    afterAll(() => {
        // A run where no fault ever fired would pass every invariant while testing nothing
        expect(totals.lostRequests).toBeGreaterThan(0);
        expect(totals.lostAcks).toBeGreaterThan(0);
        expect(totals.throttled).toBeGreaterThan(0);
        // Lost acks force replays, and every replay must be recognized by its opId
        expect(totals.replaysDeduped).toBeGreaterThan(0);
        // Every POST body carried opIds parallel to its change arrays
        expect(totals.metaViolations).toBe(0);
    });

    for (let seed = 1; seed <= SEEDS; seed++) {
        it(`converges under a hostile network (seed ${seed})`, async () => {
            const rng = mulberry32(seed);
            const server = new ModelServer(rng);
            const http = installFetchMock();
            http.respondToGet(() => server.get());
            http.respondToPost((call) => server.post(call));

            const swrStore = new MemoryPlugin(`swr-${uuid(8)}`);
            const queueStore = new MemoryPlugin(`queue-${uuid(8)}`);
            const deadLetters: unknown[] = [];
            const plugin = new HttpSwrDbPlugin(swrStore, {
                // The background loop is off so each test drives syncNow() itself
                autoSync: false,
                getUrl: (collection) => `https://api.test/${collection}`,
                unsyncedQueueStore: queueStore,
                maxAgeMs: 0,
                // No pacing here: this harness drives requests as fast as it can on purpose, and
                // an interval gate would only make each seed slower without testing anything
                minRequestIntervalMs: 0,
                bulkPersistRetryMaxAttempts: 1,
                bulkPersistRetryBaseDelayMs: 60_000,
                onSyncDeadLetter: (changes) => { deadLetters.push(...changes); },
            });
            // The flush is driven by hand so the op sequence stays reproducible
            const flush = () => plugin.syncNow();

            /** Every write the caller was told succeeded, applied in order. */
            const expected = new Map<string, Row>();
            let nextId = 0;

            try {
                for (let op = 0; op < OPS_PER_SEED; op++) {
                    const live = [...expected.values()].sort(byId);
                    const roll = rng();

                    if (roll < 0.4 || live.length === 0) {
                        const row: Row = { id: `s${seed}-e${nextId++}`, name: `v${op}` };
                        await persistAck(plugin, { adds: [row] });
                        expected.set(row.id, row);
                    } else if (roll < 0.6) {
                        const target = live[Math.floor(rng() * live.length)];
                        const row: Row = { id: target.id, name: `v${op}` };
                        await persistAck(plugin, { updates: [row] });
                        expected.set(row.id, row);
                    } else if (roll < 0.75) {
                        const target = live[Math.floor(rng() * live.length)];
                        await persistAck(plugin, { removes: [{ ...target }] });
                        expected.delete(target.id);
                    } else if (roll < 0.9) {
                        await queryAndSettle(plugin, http);
                    } else {
                        await flush();
                    }

                    await quiesce(plugin);
                }

                // Heal the network, then drain the queue the way the background loop would
                server.heal();
                for (let i = 0; i < 50; i++) {
                    const rows = await readQueueRows(queueStore);
                    if (rows.filter((r) => r.status !== 'dead').length === 0) break;
                    await flush();
                    await quiesce(plugin);
                }

                const pending = (await readQueueRows(queueStore)).filter((r) => r.status !== 'dead');
                expect(pending).toHaveLength(0);
                // Nothing here is permanently rejectable, so nothing may be given up on
                expect(deadLetters).toHaveLength(0);

                // Invariant 1: the server holds exactly the acked writes
                expect(server.snapshot()).toEqual([...expected.values()].sort(byId));

                // Invariant 2: a revalidate brings the local store in line with the server
                await queryAndSettle(plugin, http);
                await quiesce(plugin);
                const stored = (await queryPlugin(swrStore) as Row[])
                    .map((r) => ({ id: r.id, name: r.name }))
                    .sort(byId);
                expect(stored).toEqual(server.snapshot());
            } finally {
                await new Promise<void>((resolve) => plugin.destroy(destroyEvent(), () => resolve()));
            }
        });
    }
});
