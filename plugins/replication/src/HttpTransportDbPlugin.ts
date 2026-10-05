import { BulkPersistResult } from '@routier/core/collections';
import {
    DbPluginBulkPersistEvent,
    DbPluginEvent,
    DbPluginQueryEvent,
    deserializePersistResult,
    IDbPlugin,
    ITranslatedValue,
    JsonTranslator,
    Query,
    reportRenamedProperties,
    serializeBulkPersist,
    serializeQueryOptions,
    SerializedRequest,
    SerializedResponse,
    splitSendableOptions,
} from '@routier/core/plugins';
import { PluginEventCallbackPartialResult, PluginEventCallbackResult, PluginEventResult } from '@routier/core/results';
import { CompiledSchema, getStorageDateReviver } from '@routier/core/schema';
import { HttpStatusError, NetworkError, readRetryAfterMs, responseHeadersOf } from './httpUtils';
import { conflictOf, runWithOnError, statusOf, type ActionKit, type Settlement } from './requestFailures';
import { emitEvent, rejectedChangesOf, type HttpRequestError, type SyncEvent, type SyncHooks } from './syncHooks';

/**
 * A plugin that owns no database.
 *
 * Every other plugin translates a query into some storage system's language. This one translates it
 * into JSON and sends it somewhere that has a database — the WHOLE query, filters and joins and all,
 * not a URL with a few parameters hung off it. The receiver (`createRequestHandler`) rebuilds it
 * against its own schemas and runs it on a real plugin.
 *
 * ```ts
 * // client
 * const store = new MyStore(new HttpTransportDbPlugin({ url: "https://api.example.com/routier" }));
 *
 * // server
 * const handle = createRequestHandler({ plugin: new SqliteDbPlugin("app.db"), schemas });
 * app.post("/routier", async (req, res) => res.json(await handle(req.body)));
 * ```
 *
 * ## How it differs from `HttpDbPlugin`
 *
 * `HttpDbPlugin` talks to an ordinary REST API: a GET per collection, with filters flattened into
 * query parameters that a hand-written server interprets however it likes. It is the right choice
 * when the server is not yours.
 *
 * This one assumes both ends are Routier. Because the query travels intact, the server can push a
 * filter to an index, execute a real SQL `JOIN`, or run an aggregate — and return the answer rather
 * than the rows. That is the difference between asking for a collection and asking a question.
 *
 * ## What still happens locally
 *
 * `map` and `group` are defined BY a closure, so they cannot be sent. `splitSendableOptions` finds
 * the longest sendable PREFIX and this plugin runs the remainder itself with `JsonTranslator` — the
 * same thing every plugin does with what its backend could not do. Ordering makes the prefix rule
 * necessary rather than tidy: sending `count` while keeping `map` local would count unmapped rows.
 *
 * ## What it does not do
 *
 * No caching, no offline queue, no retry. `HttpSwrDbPlugin` is the plugin for those, and composing
 * them is the intended path rather than growing this one — it stays a transport, so that what
 * arrives at the server is exactly what the caller asked for.
 */
export type HttpTransportDbPluginOptions = SyncHooks<HttpRequestError> & {
    /** The single endpoint every request is POSTed to. */
    url: string;
    /**
     * Identifies the database BEHIND the endpoint — see `IDbPlugin.databaseName`.
     *
     * Defaults to the URL, which is the honest answer: from this side, the endpoint IS the database,
     * and two stores pointed at one URL should share subscription channels. Override it when several
     * endpoints front the same database and should therefore be treated as one.
     */
    databaseName?: string;
    /** Headers per request, so a token refreshed between calls is picked up. Async is allowed. */
    getHeaders?: () => Record<string, string> | Promise<Record<string, string>>;
    /** Replaces `fetch`, for tests or for a non-fetch transport. */
    request?: (url: string, body: SerializedRequest, headers: Record<string, string>) => Promise<SerializedResponse>;
};

/**
 * A `SerializedResponse` if the body is one, `null` otherwise.
 *
 * Shape-checked rather than trusted: an error page, an HTML proxy response, or an empty body all
 * arrive here, and each must read as "not a Routier answer" rather than throwing while parsing.
 */
const parseRoutierResponse = (text: string): SerializedResponse | null => {
    if (text === '') {
        return null;
    }

    try {
        const parsed = JSON.parse(text) as unknown;

        if (parsed == null || typeof parsed !== 'object' || 'ok' in parsed === false) {
            return null;
        }

        const answer = parsed as SerializedResponse;

        return answer.ok === true || answer.ok === false ? answer : null;
    } catch {
        return null;
    }
};

export class HttpTransportDbPlugin implements IDbPlugin {

    readonly databaseName: string;
    private readonly url: string;
    private readonly getHeaders?: HttpTransportDbPluginOptions["getHeaders"];
    private readonly request: NonNullable<HttpTransportDbPluginOptions["request"]>;
    private readonly onEvent?: (event: SyncEvent) => void;
    private readonly onError?: (error: HttpRequestError) => void;

    constructor(options: HttpTransportDbPluginOptions) {
        this.url = options.url;
        this.databaseName = options.databaseName ?? options.url;
        this.getHeaders = options.getHeaders;
        this.request = options.request ?? this.fetchJson.bind(this);
        this.onEvent = options.onEvent;
        this.onError = options.onError;
    }

    private async fetchJson(url: string, body: SerializedRequest, headers: Record<string, string>): Promise<SerializedResponse> {
        let response: Response;

        try {
            response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...headers },
                body: JSON.stringify(body),
            });
        } catch (error) {
            throw new NetworkError(error);
        }

        const text = await response.text();
        const answer = parseRoutierResponse(text);

        if (response.ok === false) {
            const reason = answer != null && answer.ok === false ? answer.error : response.statusText;
            throw new HttpStatusError(response.status, reason, readRetryAfterMs(response), answer ?? text, responseHeadersOf(response));
        }

        if (answer != null) {
            return answer;
        }

        throw new Error(
            `The Routier endpoint returned ${response.status} with a body that is not a Routier response.  ` +
            `Check that the route passes the request to createRequestHandler and returns its result as JSON.`
        );
    }

    private async send(body: SerializedRequest): Promise<SerializedResponse> {
        const headers = this.getHeaders == null ? {} : await this.getHeaders();

        return await this.request(this.url, body, headers);
    }

    private sendWithHooks(body: SerializedRequest, operation: 'read' | 'write', collectionName: string): Promise<Settlement<SerializedResponse>> {
        return runWithOnError({
            attempt: () => this.send(body),
            context: { operation, collectionName, method: 'POST', url: this.url, storeSource: false },
            onError: this.onError,
            actions: ({ retry, done }: ActionKit) => ({ retry, done }),
            unhandled: (kit: ActionKit) => kit.done(),
        });
    }

    query<TRoot extends {}, TShape extends any = TRoot>(
        event: DbPluginQueryEvent<TRoot, TShape>,
        done: PluginEventCallbackResult<ITranslatedValue<TShape>>
    ): void {
        this.handleQuery(event, done).catch(error => done(PluginEventResult.error(event.id, error)));
    }

    private async handleQuery<TRoot extends {}, TShape>(
        event: DbPluginQueryEvent<TRoot, TShape>,
        done: PluginEventCallbackResult<ITranslatedValue<TShape>>
    ): Promise<void> {
        const { operation } = event;

        /**
         * Renames are handed back rather than sent. What runs them is the server's plugin, which this
         * side cannot see, and the handler returns that plugin's rows as they are: an option the far
         * plugin reported would come back unapplied. The rows reach the datastore here, which
         * finishes the query by the in-memory names.
         */
        reportRenamedProperties(operation.options);

        const { sendable, local } = splitSendableOptions(operation.options);

        /**
         * A join names its inner collection, and only this side can turn the id into a name — the
         * schema collection lives here. Written onto the option value for the serializer, which sees
         * options and not schemas.
         */
        const joinOption = sendable.getLast("join");

        if (joinOption != null) {
            const innerSchema = event.schemas.get(joinOption.value.innerSchemaId);

            if (innerSchema == null) {
                done(PluginEventResult.error(event.id, new Error(
                    `Cannot send a join: no schema is registered for the inner collection.  SchemaId: ${joinOption.value.innerSchemaId}`
                )));
                return;
            }

            (joinOption.value as { innerCollectionName?: string }).innerCollectionName = innerSchema.collectionName;
        }

        const collectionName = operation.schema.collectionName;
        const fail = (error: Error) => {
            emitEvent(this.onEvent, { type: 'read', ok: false, collectionName, status: statusOf(error), error });
            done(PluginEventResult.error(event.id, error));
        };
        const settled = await this.sendWithHooks({
            kind: 'query',
            collectionName,
            options: serializeQueryOptions(sendable),
            explain: event.explain,
        }, 'read', collectionName);

        if (settled.outcome !== 'success') {
            fail(settled.error);
            return;
        }

        const response = settled.value;

        if (response.ok === false) {
            fail(new Error(response.error));
            return;
        }

        if (response.kind !== 'query') {
            fail(new Error(`Expected a query response and received '${response.kind}'.`));
            return;
        }

        // What the SERVER ran, if its plugin reported. A server whose plugin reports nothing
        // omits this, and the explanation marks the remote step as not reported — the rest of
        // the explanation is built from the query options and does not depend on the remote end.
        for (const executed of response.executedQueries ?? []) {
            event.executedQueries.push(executed);
        }

        // Whatever the server could not be asked to do, done here with the closures it could not be
        // given. An empty `local` makes this a no-op pass.
        const translator = new JsonTranslator(new Query(local, operation.schema, false));

        // The rows crossed as JSON, where a date is a string, and the closures run here compare and
        // call Dates. Nothing sent defines a projection, so an array is rows (or a join's tuples,
        // which have no such keys). Only the dates: keys stay as sent, for the datastore to deserialize.
        const reviveDates = local.items.size > 0 ? getStorageDateReviver(operation.schema) : null;

        if (reviveDates != null && Array.isArray(response.value)) {
            for (const row of response.value) {
                if (row != null && typeof row === 'object') {
                    reviveDates(row as Record<string, unknown>);
                }
            }
        }

        emitEvent(this.onEvent, { type: 'read', ok: true, collectionName, status: 200 });
        done(PluginEventResult.success(event.id, translator.translate(response.value) as ITranslatedValue<TShape>));
    }

    bulkPersist(event: DbPluginBulkPersistEvent, done: PluginEventCallbackPartialResult<BulkPersistResult>): void {
        this.handlePersist(event, done).catch(error => done(PluginEventResult.error(event.id, error)));
    }

    private async handlePersist(event: DbPluginBulkPersistEvent, done: PluginEventCallbackPartialResult<BulkPersistResult>): Promise<void> {
        const request = serializeBulkPersist(event.operation, event.schemas);

        if (request.changes.length === 0) {
            // Nothing to send. A round trip that writes nothing still costs the caller a wait.
            done(PluginEventResult.success(event.id, event.operation.toResult()));
            return;
        }

        const fail = (error: Error) => {
            this.reportRejected(event, error);
            done(PluginEventResult.error(event.id, error));
        };
        const collectionNames = Array.from(new Set(request.changes.map(change => change.collectionName))).join(', ');
        const settled = await this.sendWithHooks(request, 'write', collectionNames);

        if (settled.outcome !== 'success') {
            fail(settled.error);
            return;
        }

        const response = settled.value;

        if (response.ok === false) {
            fail(new Error(response.error));
            return;
        }

        if (response.kind !== 'persist') {
            fail(new Error(`Expected a persist response and received '${response.kind}'.`));
            return;
        }

        const byName = new Map<string, CompiledSchema<any>>();

        for (const [, schema] of event.schemas) {
            byName.set(schema.collectionName, schema as CompiledSchema<any>);
        }

        // Rebuilt against THIS side's schema ids, which is what the change tracker holds. The echo
        // carries the rows as the database wrote them, including any identity it assigned.
        done(PluginEventResult.success(
            event.id,
            deserializePersistResult(response, name => byName.get(name) ?? null)
        ));
    }

    private reportRejected(event: DbPluginBulkPersistEvent, error: Error): void {
        for (const [schemaId, schema] of event.schemas) {
            const changes = event.operation.get(schemaId);

            if (changes?.hasItems !== true) {
                continue;
            }

            emitEvent(this.onEvent, {
                type: 'changes-rejected',
                collectionName: schema.collectionName,
                changes: rejectedChangesOf({ adds: changes.adds, updates: changes.updates.map(update => update.entity), removes: changes.removes }),
                conflict: conflictOf(error),
                status: statusOf(error),
                error,
            });
        }
    }

    /**
     * Does NOT destroy the remote database.
     *
     * `destroy` means "release what this plugin holds", and this plugin holds a URL. Forwarding it
     * would let any client drop the server's database, which is not a decision a transport gets to
     * make — and `DataStore.destroy` is called in ordinary teardown, including by tests.
     */
    destroy(event: DbPluginEvent, done: PluginEventCallbackResult<never>): void {
        done(PluginEventResult.success(event.id));
    }
}

/** Re-exported so a caller wrapping the response shape does not have to reach into core. */
export type { SerializedRequest, SerializedResponse };
