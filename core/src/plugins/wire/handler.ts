import { ReadonlySchemaCollection } from "../../collections/ReadonlySchemaCollection";
import { Expression, Filter, ParamsFilter, toExpression, toStrictPredicate } from "../../expressions";
import { PluginEventResult, Result } from "../../results";
import { CompiledSchema } from "../../schema";
import { UnknownRecord, uuid } from "../../utilities";
import { IDbPlugin } from "../types";
import { ExecutedQuery } from "../query/explain";
import { Query } from "../query/Query";
import { deserializeBulkPersist, serializePersistResult } from "./persist";
import { deserializeQueryOptions, SchemaResolver, ScopeProvider } from "./query";
import { SerializedRequest, SerializedResponse } from "./types";

/**
 * The receiving half: takes a serialized request, executes it, returns a serialized response.
 *
 * Deliberately not a server. It is one async function from JSON to JSON, with no notion of HTTP, so
 * the same handler sits behind Express, a Cloudflare Worker, a Lambda, a WebSocket message, or a
 * worker `postMessage`. Transport is the caller's business; this is the part that would otherwise be
 * rewritten per framework.
 *
 * ```ts
 * const handle = createRequestHandler({ plugin, schemas });
 *
 * app.post("/routier", async (req, res) => res.json(await handle(req.body)));
 * ```
 *
 * ## Security is YOURS, and this gives you the two places to put it
 *
 * There is no built-in notion of a user, a tenant, a role or a token, and there should not be: this
 * library cannot know what your identities are or what they may see. What it can do is make sure
 * there is nowhere for a decision to be forgotten. Two hooks, and both receive a `context` you built
 * from the request:
 *
 *  - **`authorize`** — may this caller do this at all? Called once per request, before anything is
 *    deserialized or executed, with the action and every collection the request touches.
 *  - **`scope`** — which ROWS may this caller see? A filter the receiver ANDs into every read of a
 *    collection, and checks every written row against.
 *
 * With neither supplied, the endpoint answers anything for anyone. That is the correct default for a
 * function with no idea who is calling it — and the moment you name a context type, passing one
 * becomes required, so a policy cannot be half-wired.
 *
 * ```ts
 * const handle = createRequestHandler<{ tenantId: string }>({
 *     plugin,
 *     schemas,
 *     authorize: ({ action, context }) => context.tenantId != null || "not signed in",
 *     scope: ({ context }) => ({ filter: ([row, p]) => row.tenantId === p.tenantId, params: context }),
 * });
 *
 * app.post("/routier", async (req, res) => {
 *     const context = { tenantId: req.user?.tenantId };   // from the REQUEST, never from the body
 *     res.json(await handle(req.body, context));
 * });
 * ```
 *
 * ## Errors are values
 *
 * A failure comes back as `{ ok: false, error }` rather than as a rejected promise, so a transport
 * cannot accidentally turn a query error into a 500 with no body. The caller decides the status.
 */

/** What a hook is told about the request it is judging. */
export type RequestInfo<TContext> = {
    action: "query" | "persist" | "destroy";
    /** Every collection this request touches, including the inner side of any join. */
    collectionNames: string[];
    /** Whatever the transport built from the request — a user, a tenant, a token. Never the body. */
    context: TContext;
    /** The raw request, for a policy that needs to look closer. Treat it as caller-controlled input. */
    request: SerializedRequest;
};

/**
 * May this request proceed?
 *
 * `true` to allow. `false` or a string to refuse — a string becomes the error message, which is the
 * cheapest way to say WHY without inventing an error type. Throwing also refuses.
 *
 * Called once, before deserialization, so a refused request never reaches a schema or a plugin.
 */
export type AuthorizeHook<TContext> = (info: RequestInfo<TContext>) => boolean | string | Promise<boolean | string>;

/** What a scope hook is asked. One collection at a time, since each may be scoped differently. */
export type ScopeInfo<TContext> = {
    collectionName: string;
    schema: CompiledSchema<any>;
    context: TContext;
    action: "query" | "persist";
};

/**
 * The rows of one collection this caller may touch, as a filter.
 *
 * Written exactly like a collection's own `.scope()` — a filter, optionally with params — so the same
 * expression is pushed into the database on reads and checked against each row on writes. Return
 * `null` for a collection this caller may see in full.
 *
 * ```ts
 * scope: ({ collectionName, context }) =>
 *     collectionName === "orders"
 *         ? { filter: ([row, p]) => row.tenantId === p.tenantId, params: { tenantId: context.tenantId } }
 *         : null
 * ```
 */
export type ScopeHook<TContext> = (info: ScopeInfo<TContext>) =>
    | { filter: Filter<any> | ParamsFilter<any, any>; params?: {} }
    | null;

export type RequestHandlerOptions<TContext> = {
    /** The plugin that actually holds the data. Anything implementing `IDbPlugin`. */
    plugin: IDbPlugin;
    /** Every collection this endpoint will answer for. A name absent from here is refused. */
    schemas: ReadonlySchemaCollection;
    /** May this caller do this? See `AuthorizeHook`. Absent means yes, to everyone. */
    authorize?: AuthorizeHook<TContext>;
    /** Which rows may this caller touch? See `ScopeHook`. Absent means all of them. */
    scope?: ScopeHook<TContext>;
    /**
     * Whether a `destroy` request may drop the database. **Defaults to false.**
     *
     * `HttpTransportDbPlugin` never sends one, but an endpoint answers whatever arrives — and a
     * hand-written `{"kind":"destroy"}` would otherwise wipe the store for anyone who could reach
     * the route. Destroying a database is not something a remote caller should be able to ask for by
     * default, so it is opt-in and still passes through `authorize`.
     */
    allowDestroy?: boolean;
};

export type RequestHandler<TContext> = (request: SerializedRequest, context: TContext) => Promise<SerializedResponse>;

/** Every collection a request touches, joins included — what `authorize` is given. */
const collectionsIn = (request: SerializedRequest): string[] => {
    if (request.kind === "destroy") {
        return [];
    }

    if (request.kind === "persist") {
        return request.changes.map(change => change.collectionName);
    }

    const names = [request.collectionName];

    const walk = (options: typeof request.options) => {
        for (const option of options) {
            if (option.name === "join") {
                names.push(option.value.innerCollectionName);
                walk(option.value.innerOptions);
            }
        }
    };

    walk(request.options);

    return names;
};

export const createRequestHandler = <TContext = void>(options: RequestHandlerOptions<TContext>): RequestHandler<TContext> => {
    const { plugin, schemas, authorize, scope, allowDestroy = false } = options;

    const byName = new Map<string, CompiledSchema<any>>();

    for (const [, schema] of schemas) {
        byName.set(schema.collectionName, schema as CompiledSchema<any>);
    }

    const resolveSchema: SchemaResolver = (collectionName) => byName.get(collectionName) ?? null;

    const failed = (error: unknown): SerializedResponse => ({
        ok: false,
        error: error instanceof Error ? error.message : String(error)
    });

    /**
     * Turns a scope hook's filter into an expression, once per collection per request.
     *
     * `toExpression` rather than only keeping the closure, because an expression is what a backend
     * can push down — a scope that could only run in memory would mean reading the whole collection
     * to hide most of it. A filter that cannot be parsed is REFUSED rather than silently degraded:
     * a scope is the boundary, and one that quietly stops applying is worse than an error.
     */
    const scopeExpressionFor = (schema: CompiledSchema<any>, context: TContext, action: "query" | "persist"): Expression | null => {
        if (scope == null) {
            return null;
        }

        const declared = scope({ collectionName: schema.collectionName, schema, context, action });

        if (declared == null) {
            return null;
        }

        const expression = toExpression(schema, declared.filter as never, declared.params as never);

        if (Expression.isNotParsable(expression)) {
            throw new Error(
                `The scope declared for '${schema.collectionName}' cannot be expressed as a filter, so it cannot be enforced.  ` +
                `Scopes must be parseable — they are the boundary between callers, and one that cannot be applied must not be ignored.`
            );
        }

        return expression;
    };

    return async (request, context) => {
        try {
            if (request.kind === "destroy" && allowDestroy === false) {
                return failed(new Error(
                    "This endpoint does not allow destroy.  Dropping the database is opt-in: pass allowDestroy to createRequestHandler if a remote caller really should be able to ask for it."
                ));
            }

            if (authorize != null) {
                const verdict = await authorize({
                    action: request.kind,
                    collectionNames: collectionsIn(request),
                    context,
                    request
                });

                if (verdict !== true) {
                    return failed(new Error(typeof verdict === "string" ? verdict : "Not authorized."));
                }
            }

            if (request.kind === "query") {
                const schema = resolveSchema(request.collectionName);

                if (schema == null) {
                    return failed(new Error(`This endpoint has no collection named '${request.collectionName}'.`));
                }

                const queryOptions = deserializeQueryOptions(
                    request.options,
                    schema,
                    resolveSchema,
                    // Applied to the outer collection AND to every collection a join reaches, so a
                    // join cannot be used to read around a scope
                    (target) => scopeExpressionFor(target, context, "query")
                );

                const executedQueries: ExecutedQuery[] = [];

                return await new Promise<SerializedResponse>(resolve => {
                    plugin.query({
                        // `false`: nothing here attaches to a change tracker — the tracker lives on
                        // the caller, on the other side of the wire.
                        operation: new Query(queryOptions, schema, false),
                        schemas: schemas as never,
                        id: uuid(8),
                        source: "RequestHandler",
                        action: "query",
                        explain: request.explain,
                        executedQueries
                    }, result => {
                        if (result.ok === PluginEventResult.ERROR) {
                            resolve(failed(result.error));
                            return;
                        }

                        resolve({
                            ok: true,
                            kind: "query",
                            value: result.data.value as unknown,
                            // Only when asked, and only what the plugin reported. A plugin
                            // that reported nothing sends nothing, and the caller marks the
                            // remote step as not reported.
                            ...(request.explain === true && executedQueries.length > 0 ? { executedQueries } : {})
                        });
                    });
                });
            }

            if (request.kind === "persist") {
                const { changes } = deserializeBulkPersist(request, resolveSchema);

                /**
                 * A scope has to be enforced on WRITES too, and differently.
                 *
                 * On a read it narrows what comes back. On a write there is nothing to narrow — the
                 * rows are supplied by the caller — so each one is CHECKED against the same
                 * expression, and a single row outside the scope refuses the whole save. Without
                 * this, a caller who can only read their own rows could still write somebody else's.
                 *
                 * All-or-nothing on purpose: a partial save would leave the caller believing the
                 * rejected rows were stored.
                 */
                for (const [schemaId, schemaChanges] of changes) {
                    const schema = schemas.get(schemaId);

                    if (schema == null) {
                        continue;
                    }

                    const expression = scopeExpressionFor(schema as CompiledSchema<any>, context, "persist");

                    if (expression == null) {
                        continue;
                    }

                    const permitted = toStrictPredicate(expression);

                    const rows = [
                        ...schemaChanges.adds as UnknownRecord[],
                        ...schemaChanges.updates.map(update => update.entity as UnknownRecord),
                        ...schemaChanges.removes as UnknownRecord[]
                    ];

                    for (const row of rows) {
                        if (permitted(row) === false) {
                            return failed(new Error(
                                `This save was refused: a row of '${schema.collectionName}' falls outside the scope allowed for this caller.`
                            ));
                        }
                    }
                }

                return await new Promise<SerializedResponse>(resolve => {
                    plugin.bulkPersist({
                        operation: changes,
                        schemas: schemas as never,
                        id: uuid(8),
                        source: "RequestHandler",
                        action: "persist"
                    }, result => {
                        if (result.ok === Result.ERROR) {
                            resolve(failed(result.error));
                            return;
                        }

                        // A PARTIAL result carries data AND an error. Reported as a failure, because
                        // the caller must not treat a half-applied save as a success.
                        if (result.ok === Result.PARTIAL) {
                            resolve(failed(result.error));
                            return;
                        }

                        resolve(serializePersistResult(result.data, schemas));
                    });
                });
            }

            return await new Promise<SerializedResponse>(resolve => {
                plugin.destroy({
                    schemas: schemas as never,
                    id: uuid(8),
                    source: "RequestHandler",
                    action: "destroy"
                }, result => {
                    if (result.ok === PluginEventResult.ERROR) {
                        resolve(failed(result.error));
                        return;
                    }

                    resolve({ ok: true, kind: "destroy" });
                });
            });
        } catch (error) {
            return failed(error);
        }
    };
};

/** Re-exported so a caller can type its own scope provider without reaching for the query module. */
export type { ScopeProvider };
