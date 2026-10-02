import { DbPluginQueryEvent, ITranslatedValue, JsonTranslator } from '@routier/core/plugins';
import { CompiledSchema, getStorageDateReviver } from '@routier/core/schema';
import { logger, UnknownRecord } from '@routier/core/utilities';
import { buildAuthErrorEvent, type AuthErrorEvent } from './auth';
import { backoffDelayMs, HttpStatusError, isAuthStatus, readRetryAfterMs, RequestPacer, RequestTracker } from './httpUtils';

export type ConditionalQueryResult<TShape> =
    | { kind: 'modified'; data: ITranslatedValue<TShape>; etag: string | null }
    | { kind: 'not-modified' }
    | { kind: 'failed'; error: Error };

export type HttpQueryRunnerOptions = {
    requests: RequestTracker;
    pacer: RequestPacer;
    requestTimeoutMs: number;
    retryBaseDelayMs: number;
    retryMaxDelayMs: number;
    retryMaxAttempts: number;
    translateRemoteResponse?: (schema: CompiledSchema<UnknownRecord>, data: unknown) => unknown;
    requestHeaders: () => Promise<Record<string, string>>;
    notifyAuthError: (event: AuthErrorEvent | null) => Promise<boolean>;
};

type SharedGet =
    | { etag: string | null; text: string }
    | { status: number; statusText: string; retryAfterMs: number | null };

type RawResponse = {
    ok: boolean;
    status: number;
    statusText: string;
    headers?: { get?: (name: string) => string | null };
    json: () => Promise<unknown>;
    text?: () => Promise<string>;
};

type AttemptResult<TShape> =
    | ConditionalQueryResult<TShape>
    | { kind: 'retryable'; error: Error; isAuthError: boolean; retryAfterMs: number | null };

const NOT_MODIFIED = 304;

export class HttpQueryRunner {
    private readonly options: HttpQueryRunnerOptions;

    constructor(options: HttpQueryRunnerOptions) {
        this.options = options;
    }

    async run<TRoot extends {}, TShape>(event: DbPluginQueryEvent<TRoot, TShape>, url: string, ifNoneMatch: string | null): Promise<ConditionalQueryResult<TShape>> {
        const collectionName = event.operation.schema.collectionName;
        let attemptsAllowed = Math.max(1, this.options.retryMaxAttempts);
        let reauthAttempted = false;

        for (let attempt = 0; ; attempt++) {
            const result = await this.attempt(event, url, ifNoneMatch);

            if (result.kind !== 'retryable') {
                return result;
            }

            if (result.isAuthError) {
                const reauthSucceeded = await this.options.notifyAuthError(buildAuthErrorEvent(result.error, 'query'));

                if (reauthSucceeded && !reauthAttempted) {
                    reauthAttempted = true;
                    attemptsAllowed++;
                    logger.info('[HttpDbPlugin] re-auth succeeded, retrying query once', { collectionName });
                    continue;
                }

                logger.warn('[HttpDbPlugin] query auth error, not retrying', { collectionName, error: result.error });
                return { kind: 'failed', error: result.error };
            }

            if (this.options.retryBaseDelayMs > 0 && attempt < attemptsAllowed - 1) {
                const delayMs = backoffDelayMs(attempt, this.options.retryBaseDelayMs, this.options.retryMaxDelayMs, result.retryAfterMs);
                logger.warn('[HttpDbPlugin] query failed, retrying', { collectionName, attempt: attempt + 1, maxAttempts: attemptsAllowed, delayMs, error: result.error });
                await new Promise((r) => setTimeout(r, delayMs));
                continue;
            }

            logger.error('[HttpDbPlugin] query failed', { collectionName, eventId: event.id, error: result.error });
            return { kind: 'failed', error: result.error };
        }
    }

    private async attempt<TRoot extends {}, TShape>(event: DbPluginQueryEvent<TRoot, TShape>, url: string, ifNoneMatch: string | null): Promise<AttemptResult<TShape>> {
        const { operation } = event;
        const schema = operation.schema as CompiledSchema<UnknownRecord>;

        try {
            const fetched = await this.getShared(url, await this.options.requestHeaders(), ifNoneMatch);

            if ('status' in fetched) {
                if (fetched.status === NOT_MODIFIED) {
                    event.executedQueries.push({ text: `GET ${url} (304)` });
                    return { kind: 'not-modified' };
                }

                const error = new HttpStatusError(fetched.status, fetched.statusText, fetched.retryAfterMs);
                return { kind: 'retryable', error, isAuthError: isAuthStatus(fetched.status), retryAfterMs: error.retryAfterMs };
            }

            const data = new JsonTranslator(operation).translate(this.readRows(schema, fetched.text));
            event.executedQueries.push({ text: `GET ${url}` });

            return { kind: 'modified', data, etag: fetched.etag };
        } catch (err) {
            return { kind: 'retryable', error: err instanceof Error ? err : new Error(String(err)), isAuthError: false, retryAfterMs: null };
        }
    }

    private readRows(schema: CompiledSchema<UnknownRecord>, text: string): unknown {
        const body = text === '' ? null : JSON.parse(text);
        const rows = this.options.translateRemoteResponse != null ? this.options.translateRemoteResponse(schema, body) : body;
        const reviveDates = getStorageDateReviver(schema);

        if (reviveDates != null && Array.isArray(rows)) {
            for (const row of rows) {
                if (row instanceof Object) {
                    reviveDates(row);
                }
            }
        }

        return rows;
    }

    private getShared(url: string, headers: Record<string, string>, ifNoneMatch: string | null): Promise<SharedGet> {
        const conditional: Record<string, string> = ifNoneMatch == null ? {} : { 'If-None-Match': ifNoneMatch };

        return this.options.pacer.share(`GET ${url} If-None-Match ${ifNoneMatch}`, async (): Promise<SharedGet> => {
            const res = await this.options.requests.raw(url, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json', ...headers, ...conditional },
            }, this.options.requestTimeoutMs) as RawResponse;

            if (!res.ok) {
                return { status: res.status, statusText: res.statusText, retryAfterMs: readRetryAfterMs(res) };
            }

            const text = typeof res.text === 'function' ? await res.text() : JSON.stringify(await res.json());

            return { etag: res.headers?.get?.('ETag') ?? null, text };
        });
    }
}
