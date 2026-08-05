/**
 * Shared HTTP machinery for the replication plugins: timeout-aware fetch with
 * abort tracking, jittered exponential backoff, and status classification that
 * separates transient failures (retry) from permanent ones (dead-letter).
 */

/** An HTTP failure that keeps its status so callers can classify it. */
export class HttpStatusError extends Error {
    readonly status: number;
    /** Retry-After header value in milliseconds, when the server sent one. */
    readonly retryAfterMs: number | null;
    /** Parsed JSON error body when available. Used for structured batch rejection. */
    readonly responseBody: unknown;

    constructor(status: number, statusText: string, retryAfterMs: number | null = null, responseBody: unknown = null) {
        super(`HTTP ${status}: ${statusText}`);
        this.status = status;
        this.retryAfterMs = retryAfterMs;
        this.responseBody = responseBody;
    }
}

export function isAuthStatus(status: number): boolean {
    return status === 401 || status === 403;
}

export function isConflictStatus(status: number): boolean {
    return status === 409;
}

/**
 * A permanent failure: the same request will never succeed, so retrying is
 * waste and the change should dead-letter. Auth (401/403) is special-cased by
 * callers (re-auth may fix it), 408/429 are transient by definition, and
 * anything 5xx or network-level is transient.
 */
export function isPermanentStatus(status: number): boolean {
    if (status < 400 || status >= 500) {
        return false;
    }

    return !isAuthStatus(status) && status !== 408 && status !== 429;
}

export function readRetryAfterMs(res: { headers?: { get?: (name: string) => string | null } }): number | null {
    const raw = res.headers?.get?.('Retry-After');
    if (raw == null) {
        return null;
    }

    // A numeric header is a delay in seconds. Negative is malformed, and answering `null`
    // (fall back to the computed backoff) beats both trusting it and falling through to
    // Date.parse — which accepts "-5" as a year and would turn nonsense into "retry now".
    const seconds = Number(raw);
    if (!Number.isNaN(seconds)) {
        return seconds >= 0 ? seconds * 1000 : null;
    }

    const dateMs = Date.parse(raw);
    if (!Number.isNaN(dateMs)) {
        return Math.max(0, dateMs - Date.now());
    }

    return null;
}

/**
 * Equal-jitter exponential backoff: half the capped delay is fixed, half is
 * random, so a fleet of clients that failed together does not retry together.
 * An explicit Retry-After from the server overrides the computed delay.
 */
export function backoffDelayMs(attempt: number, baseDelayMs: number, maxDelayMs: number, retryAfterMs: number | null = null): number {
    if (retryAfterMs != null) {
        return Math.min(retryAfterMs, maxDelayMs);
    }

    const capped = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
    return capped / 2 + Math.random() * (capped / 2);
}

/**
 * Tracks in-flight requests so destroy() can abort them. A hung connection
 * should never outlive the plugin that started it.
 */
export class RequestTracker {
    private readonly active = new Set<AbortController>();
    private aborted = false;

    /**
     * fetch with a timeout and abort tracking. Throws HttpStatusError for non-2xx
     * responses (body intentionally unread — callers that need it use `raw`).
     */
    async fetch(url: string, init: { method: string; headers: Record<string, string>; body?: string }, timeoutMs: number): Promise<unknown> {
        const res = await this.raw(url, init, timeoutMs);

        if (!(res as { ok: boolean }).ok) {
            const r = res as {
                status: number;
                statusText: string;
                headers?: { get?: (name: string) => string | null };
                json?: () => Promise<unknown>;
                text?: () => Promise<string>;
            };
            let responseBody: unknown = null;
            try {
                responseBody = typeof r.json === 'function'
                    ? await r.json()
                    : typeof r.text === 'function'
                        ? await r.text()
                        : null;
            } catch {
                // Status is still actionable when the body is empty or malformed.
            }
            throw new HttpStatusError(r.status, r.statusText, readRetryAfterMs(r), responseBody);
        }

        return res;
    }

    /** fetch with timeout + abort tracking, returning the raw response (ok or not). */
    async raw(url: string, init: { method: string; headers: Record<string, string>; body?: string }, timeoutMs: number): Promise<unknown> {
        if (this.aborted) {
            throw new Error('Plugin destroyed; request not sent');
        }

        const controller = new AbortController();
        this.active.add(controller);

        const timer = timeoutMs > 0
            ? setTimeout(() => controller.abort(new Error(`Request timed out after ${timeoutMs}ms`)), timeoutMs)
            : null;
        // Stryker disable next-line OptionalChaining: `unref` is Node-only — a browser's
        // setTimeout returns a number with no such method. Under Node the inner `?.` is
        // unobservable, so no test can distinguish the mutant; dropping it breaks browsers.
        (timer as { unref?: () => void } | null)?.unref?.();

        try {
            return await fetch(url, { ...init, signal: controller.signal });
        } finally {
            // Stryker disable next-line ConditionalExpression,EqualityOperator,BlockStatement: pure
            // hygiene. The timer is unref'd and its only effect is aborting a controller nothing
            // uses once this returns, so clearing it — or not — is unobservable. Kept because
            // leaving thousands of pending timers per session is still wrong.
            if (timer != null) {
                clearTimeout(timer);
            }
            this.active.delete(controller);
        }
    }

    /** Aborts every in-flight request and refuses new ones. */
    abortAll(): void {
        this.aborted = true;
        for (const controller of this.active) {
            controller.abort(new Error('Plugin destroyed'));
        }
        this.active.clear();
    }
}

/**
 * Paces outbound calls so an app cannot flood the service it depends on.
 *
 * Two different problems, deliberately two methods rather than one fuzzy one:
 *
 *  - `share` is for calls where the key *is* the request. Ten components reading the same
 *    query on a cold cache want one GET, not ten, and they can all have the same answer.
 *  - `serialize` is for work that must remain ordered after any higher-level batching. Calls
 *    never overlap and never start closer together than `minIntervalMs`.
 *
 * Both are per key, so unrelated collections never wait on each other.
 */
export class RequestPacer {
    private readonly mutex = new KeyedMutex();
    private readonly shared = new Map<string, Promise<unknown>>();
    private readonly lastStartedAt = new Map<string, number>();
    /**
     * Calls accepted but not finished, including ones still waiting out the interval. Counted
     * because "no socket is open" is not the same as "nothing is on its way out" once calls can
     * be held at a gate — anything watching for idleness needs the difference.
     */
    private pending = 0;

    /** @param minIntervalMs Floor between two calls for one key. 0 orders them without waiting. */
    constructor(private readonly minIntervalMs: number = 0) { }

    /** Identical concurrent calls collapse into one. */
    share<T>(key: string, work: () => Promise<T>): Promise<T> {
        const existing = this.shared.get(key) as Promise<T> | undefined;
        if (existing != null) {
            return existing;
        }

        const run = this.serialize(key, work);

        // The cleanup is chained into the promise callers await, not attached as a side branch.
        // A side branch runs a microtask later, so a caller that awaited and immediately asked
        // again would be handed the settled call it had just consumed.
        const settled = run.finally(() => {
            if (this.shared.get(key) === settled) {
                this.shared.delete(key);
            }
        }) as Promise<T>;

        this.shared.set(key, settled);

        return settled;
    }

    /** Calls for one key never overlap, and never start closer than minIntervalMs. */
    serialize<T>(key: string, work: () => Promise<T>): Promise<T> {
        this.pending++;

        // The decrement is chained into the promise the caller awaits, not a side branch: on a
        // side branch it lands a microtask late, so code that awaits a call and then reads
        // pendingCount() sees the call it just finished still counted.
        return this.mutex.run(key, async () => {
            if (this.minIntervalMs > 0) {
                const sinceLast = Date.now() - (this.lastStartedAt.get(key) ?? 0);

                if (sinceLast < this.minIntervalMs) {
                    await new Promise((resolve) => {
                        const timer = setTimeout(resolve, this.minIntervalMs - sinceLast);
                        (timer as { unref?: () => void }).unref?.();
                    });
                }

                this.lastStartedAt.set(key, Date.now());
            }

            return work();
        }).finally(() => { this.pending--; });
    }

    /**
     * Calls accepted and not yet finished — waiting at the interval gate counts. Whatever waits
     * for the plugin to go quiet has to use this rather than counting open sockets.
     */
    pendingCount(): number {
        return this.pending;
    }
}

interface PendingJsonWrite<T> {
    body: string;
    send: (body: string) => Promise<T>;
    resolve: (value: T) => void;
    reject: (reason: unknown) => void;
}

interface JsonWriteGroup<T> {
    timer: ReturnType<typeof setTimeout>;
    writes: PendingJsonWrite<T>[];
}

/**
 * Debounces compatible JSON write bodies and combines them into one request.
 *
 * Replication POSTs all use the same `{ adds, updates, removes, meta.opIds }`
 * envelope. Calls for the same URL that arrive during the quiet window can
 * therefore share one HTTP request without losing an entity or idempotency key.
 * A singleton is forwarded byte-for-byte so batching does not alter the normal
 * wire format.
 */
export class JsonWriteBatcher {
    private readonly groups = new Map<string, JsonWriteGroup<unknown>>();
    private pending = 0;
    private aborted = false;

    constructor(private readonly delayMs: number) { }

    enqueue<T>(key: string, body: string, send: (body: string) => Promise<T>): Promise<T> {
        if (this.aborted) {
            return Promise.reject(new Error('Plugin destroyed; request not sent'));
        }
        if (this.delayMs <= 0) {
            return send(body);
        }

        this.pending++;
        return new Promise<T>((resolve, reject) => {
            const existing = this.groups.get(key) as JsonWriteGroup<T> | undefined;
            if (existing != null) {
                clearTimeout(existing.timer);
                existing.writes.push({ body, send, resolve, reject });
                existing.timer = setTimeout(() => void this.flush(key, existing), this.delayMs);
                return;
            }

            const group: JsonWriteGroup<T> = {
                writes: [{ body, send, resolve, reject }],
                timer: setTimeout(() => void this.flush(key, group), this.delayMs),
            };
            this.groups.set(key, group as JsonWriteGroup<unknown>);
        });
    }

    pendingCount(): number {
        return this.pending;
    }

    abortAll(): void {
        this.aborted = true;
        const error = new Error('Plugin destroyed; request not sent');
        for (const group of this.groups.values()) {
            clearTimeout(group.timer);
            for (const write of group.writes) {
                this.pending--;
                write.reject(error);
            }
        }
        this.groups.clear();
    }

    private async flush<T>(key: string, group: JsonWriteGroup<T>): Promise<void> {
        if (this.groups.get(key) !== group) {
            return;
        }
        this.groups.delete(key);

        try {
            const body = group.writes.length === 1
                ? group.writes[0].body
                : this.mergeBodies(group.writes.map((write) => write.body));

            // All writes in a group target the same transport. Use the first callback once and
            // settle every logical caller from that one physical response.
            const response = await group.writes[0].send(body);
            for (const write of group.writes) write.resolve(response);
        } catch (err) {
            for (const write of group.writes) write.reject(err);
        } finally {
            this.pending -= group.writes.length;
        }
    }

    private mergeBodies(bodies: string[]): string {
        const merged: {
            adds: unknown[];
            updates: unknown[];
            removes: unknown[];
            meta?: { opIds: { adds: string[]; updates: string[]; removes: string[] } };
        } = { adds: [], updates: [], removes: [] };
        let hasOpIds = false;
        const seenOpIds = new Set<string>();

        for (const body of bodies) {
            const parsed = JSON.parse(body) as {
                adds?: unknown[];
                updates?: unknown[];
                removes?: unknown[];
                meta?: { opIds?: { adds?: string[]; updates?: string[]; removes?: string[] } };
            };
            const opIds = parsed.meta?.opIds;
            if (opIds != null) {
                hasOpIds = true;
                merged.meta ??= { opIds: { adds: [], updates: [], removes: [] } };
            }

            const append = (kind: 'adds' | 'updates' | 'removes') => {
                const values = parsed[kind] ?? [];
                const ids = opIds?.[kind];
                for (let i = 0; i < values.length; i++) {
                    const opId = ids?.[i] ?? '';
                    // An immediate SWR send and syncNow() can meet in this window. They carry the
                    // same opId, so keep one copy rather than putting the entity in the batch twice.
                    if (opId !== '' && seenOpIds.has(opId)) continue;
                    if (opId !== '') seenOpIds.add(opId);
                    merged[kind].push(values[i]);
                    if (opIds != null) merged.meta!.opIds[kind].push(opId);
                }
            };

            append('adds');
            append('updates');
            append('removes');
        }

        if (!hasOpIds) delete merged.meta;
        return JSON.stringify(merged);
    }
}

/**
 * Per-key async mutex: mutations against the same key run one at a time, in
 * arrival order. Used to serialize SWR store writes per collection so a
 * revalidate diff can never interleave with a user write it did not see.
 */
export class KeyedMutex {
    private readonly tails = new Map<string, Promise<void>>();

    async run<T>(key: string, work: () => Promise<T>): Promise<T> {
        const previous = this.tails.get(key) ?? Promise.resolve();

        let release!: () => void;
        const current = new Promise<void>((resolve) => { release = resolve; });
        const tail = previous.then(() => current);
        this.tails.set(key, tail);

        await previous;
        try {
            return await work();
        } finally {
            release();
            // Drop the tail when nothing is queued behind us, so the map cannot grow forever
            if (this.tails.get(key) === tail) {
                this.tails.delete(key);
            }
        }
    }
}
