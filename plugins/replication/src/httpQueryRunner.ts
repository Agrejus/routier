import { DbPluginQueryEvent, ITranslatedValue, JsonTranslator } from '@routier/core/plugins';
import { CompiledSchema, getStorageDateReviver } from '@routier/core/schema';
import { UnknownRecord } from '@routier/core/utilities';
import { HttpStatusError, readRetryAfterMs, RequestPacer, RequestTracker, responseHeadersOf } from './httpUtils';
import type { ResponseHeaders } from './syncHooks';

export type ConditionalQueryResult<TShape> =
    | { kind: 'modified'; data: ITranslatedValue<TShape>; etag: string | null }
    | { kind: 'not-modified' }
    | { kind: 'failed'; error: Error };

export type HttpQueryRunnerOptions = {
    requests: RequestTracker;
    pacer: RequestPacer;
    requestTimeoutMs: number;
    translateRemoteResponse?: (schema: CompiledSchema<UnknownRecord>, data: unknown) => unknown;
    requestHeaders: () => Promise<Record<string, string>>;
};

type SharedGet =
    | { etag: string | null; text: string }
    | { status: number; statusText: string; retryAfterMs: number | null; headers: ResponseHeaders; body: unknown };

type RawResponse = {
    ok: boolean;
    status: number;
    statusText: string;
    headers?: { get?: (name: string) => string | null };
    json: () => Promise<unknown>;
    text?: () => Promise<string>;
};

const NOT_MODIFIED = 304;

const readErrorBody = async (res: RawResponse): Promise<unknown> => {
    try {
        const text = typeof res.text === 'function' ? await res.text() : JSON.stringify(await res.json());
        return text === '' ? null : parseOrText(text);
    } catch {
        return null;
    }
};

const parseOrText = (text: string): unknown => {
    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
};

export class HttpQueryRunner {
    private readonly options: HttpQueryRunnerOptions;

    constructor(options: HttpQueryRunnerOptions) {
        this.options = options;
    }

    async run<TRoot extends {}, TShape>(event: DbPluginQueryEvent<TRoot, TShape>, url: string, ifNoneMatch: string | null): Promise<ConditionalQueryResult<TShape>> {
        const { operation } = event;
        const schema = operation.schema as CompiledSchema<UnknownRecord>;

        try {
            const fetched = await this.getShared(url, await this.options.requestHeaders(), ifNoneMatch);

            if ('status' in fetched) {
                if (fetched.status === NOT_MODIFIED) {
                    event.executedQueries.push({ text: `GET ${url} (304)` });
                    return { kind: 'not-modified' };
                }

                return { kind: 'failed', error: new HttpStatusError(fetched.status, fetched.statusText, fetched.retryAfterMs, fetched.body, fetched.headers) };
            }

            const data = new JsonTranslator(operation).translate(this.readRows(schema, fetched.text));
            event.executedQueries.push({ text: `GET ${url}` });

            return { kind: 'modified', data, etag: fetched.etag };
        } catch (err) {
            return { kind: 'failed', error: err instanceof Error ? err : new Error(String(err)) };
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
                return { status: res.status, statusText: res.statusText, retryAfterMs: readRetryAfterMs(res), headers: responseHeadersOf(res), body: await readErrorBody(res) };
            }

            const text = typeof res.text === 'function' ? await res.text() : JSON.stringify(await res.json());

            return { etag: res.headers?.get?.('ETag') ?? null, text };
        });
    }
}
