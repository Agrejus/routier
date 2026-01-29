/**
 * HTTP plugin for Routier sync. Talks to per-resource server endpoints.
 *
 * - GET {baseUrl}/{collectionName}?filter=&sort=&skip=&take= for reads
 * - POST {baseUrl}/{collectionName} with { adds, updates, removes } for writes
 *
 * Server exposes one controller per collection (e.g. api/data/bookings, api/data/users).
 * Use onGetUrl(collectionName) to override; default is ${baseUrl}/${collectionName}.
 *
 * - Skips client-scope properties in filters (configurable via clientScopePropertyNames; default includes _collectionName)
 * - ignoreQueryForCollections: no query params sent; server returns full allowed set
 */

import {
    IDbPlugin,
    DbPluginQueryEvent,
    DbPluginBulkPersistEvent,
    DbPluginEvent,
    ITranslatedValue,
    JsonTranslator,
    IQuery,
} from '@routier/core/plugins';
import type {
    Expression,
    ComparatorExpression,
    OperatorExpression,
    ValueExpression,
    PropertyExpression,
} from '@routier/core/expressions';
import {
    PluginEventCallbackResult,
    PluginEventCallbackPartialResult,
    PluginEventResult,
} from '@routier/core/results';
import { BulkPersistResult } from '@routier/core/collections';
import { logger } from '@routier/core/utilities';

type QueryParams = Record<string, string>;

export interface HttpPluginOptions {
    getUrl: (collectionName: string) => string;
    /** Headers for every request (e.g. Authorization). Can be async. */
    getHeaders?: () => Promise<Record<string, string>> | Record<string, string>;
    /**
     * Collection names for which to ignore the query and select everything.
     * No filter, sort, skip, or take is sent; server returns full allowed set.
     */
    ignoreQueryForCollections?: string[];
    /**
     * Property names to exclude from the filter sent to the server (client-only scope).
     * Defaults to ['_collectionName'] if not provided.
     */
    clientScopePropertyNames?: string[];
}

/** Context passed when serializing a query into request params. */
export interface QuerySerializationContext {
    ignoreQueryForCollections: string[];
    clientScopePropertyNames: string[];
}

function parseQueryResponse(body: unknown): unknown[] {
    if (Array.isArray(body)) {
        return body;
    }
    if (body && typeof body === 'object' && 'data' in body) {
        const data = (body as { data: unknown }).data;
        if (Array.isArray(data)) {
            return data;
        }
    }
    return [];
}

function isClientScopeProperty(expr: Expression, ctx: QuerySerializationContext): boolean {
    return (
        expr.type === 'property' &&
        ctx.clientScopePropertyNames.includes((expr as PropertyExpression).property?.name ?? '')
    );
}

/**
 * Converts a Routier Expression to the JSON shape expected by the server filter param.
 * Drops any comparator on client-scope properties (see clientScopePropertyNames).
 */
function expressionToFilterJson(expr: Expression, ctx: QuerySerializationContext): unknown {
    if (expr.type === 'operator') {
        const op = expr as OperatorExpression;
        const left = op.left ? expressionToFilterJson(op.left, ctx) : undefined;
        const right = op.right ? expressionToFilterJson(op.right, ctx) : undefined;

        if (left === undefined && right === undefined) {
            return undefined;
        }

        if (left === undefined) {
            return right;
        }


        if (right === undefined) {
            return left;
        }

        return { type: 'operator', operator: op.operator ?? '&&', left, right };
    }
    if (expr.type === 'comparator') {
        const cmp = expr as ComparatorExpression;
        if (cmp.left && isClientScopeProperty(cmp.left, ctx)) {
            return undefined;
        }
        return {
            type: 'comparator',
            comparator: cmp.comparator ?? 'equals',
            negated: cmp.negated,
            left: cmp.left ? expressionToFilterJson(cmp.left, ctx) : undefined,
            right: cmp.right ? expressionToFilterJson(cmp.right, ctx) : undefined,
        };
    }
    if (expr.type === 'property') {
        const prop = expr as PropertyExpression;
        const path = (prop.property as { getPathArray?: () => string[] })?.getPathArray?.();
        return {
            type: 'property',
            name: prop.property?.name ?? '',
            ...(path && path.length > 1 ? { path } : {}),
        };
    }
    if (expr.type === 'value') {
        const val = expr as ValueExpression;
        const v = val.value instanceof Date ? val.value.toISOString() : val.value;
        return { type: 'value', value: v };
    }
    return { type: 'value', value: (expr as unknown as { value?: unknown }).value };
}

function combineExpressionsAsAnd(expressions: Expression[], ctx: QuerySerializationContext): unknown {
    if (expressions.length === 0) {
        return undefined;
    }
    let acc: unknown = expressionToFilterJson(expressions[0], ctx);
    for (let i = 1; i < expressions.length; i++) {
        const right = expressionToFilterJson(expressions[i], ctx);
        if (acc === undefined && right === undefined) {
            acc = undefined;
        } else if (acc === undefined) {
            acc = right;
        } else if (right === undefined) {
            acc = acc;
        } else {
            acc = { type: 'operator', operator: '&&', left: acc, right };
        }
    }
    return acc;
}

function getOrderedQueryOptions<TRoot extends {}, TShape>(
    operation: IQuery<TRoot, TShape>
): Array<{ name: string; value: unknown; index: number }> {
    const items: Array<{ name: string; value: unknown; index: number }> = [];
    for (const [name, collectionItems] of operation.options.items) {
        for (const item of collectionItems) {
            items.push({
                name: name as string,
                value: (item.option as { value: unknown }).value,
                index: item.index,
            });
        }
    }
    items.sort((a, b) => a.index - b.index);
    return items;
}

function buildQueryParams<TRoot extends {}, TShape>(
    operation: IQuery<TRoot, TShape>,
    ctx: QuerySerializationContext
): QueryParams {
    const { schema } = operation;
    if (ctx.ignoreQueryForCollections.includes(schema.collectionName)) {
        return {};
    }

    const params: QueryParams = {};
    const ops = getOrderedQueryOptions(operation);

    const filterOps = ops.filter((o) => o.name === 'filter' || o.name === 'where');
    const sortOps = ops.filter((o) => o.name === 'sort');
    const skipTakeOps = ops.filter((o) => o.name === 'skip' || o.name === 'take');

    if (filterOps.length > 0) {
        const expressions = filterOps
            .map((o) => (o.value as { expression?: Expression })?.expression)
            .filter(Boolean) as Expression[];
        const filterJson = combineExpressionsAsAnd(expressions, ctx);
        if (filterJson !== undefined) {
            params.filter = JSON.stringify(filterJson);
        }
    }

    if (sortOps.length > 0) {
        params.sort = sortOps
            .map(
                (o) =>
                    `${((o.value as { propertyName?: string }).propertyName ?? 'id')}:${((o.value as { direction?: string }).direction ?? 'asc')}`
            )
            .join(',');
    }

    for (const op of skipTakeOps) {
        if (op.name === 'skip') {
            params.skip = String(op.value);
        }
        if (op.name === 'take') {
            params.take = String(op.value);
        }
    }

    return params;
}

function buildUrlWithQuery(baseUrl: string, params: QueryParams): string {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== '') {
            search.set(k, String(v));
        }
    }
    const qs = search.toString();
    return qs ? `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}${qs}` : baseUrl;
}

export class HttpDbPlugin implements IDbPlugin {
    protected readonly getUrl: (collectionName: string) => string;
    protected readonly getHeaders?: () => Promise<Record<string, string>> | Record<string, string>;
    protected readonly querySerializationContext: QuerySerializationContext;

    constructor(options: HttpPluginOptions) {
        this.getUrl = options.getUrl;
        this.getHeaders = options.getHeaders;
        this.querySerializationContext = {
            ignoreQueryForCollections: options.ignoreQueryForCollections ?? [],
            clientScopePropertyNames: options.clientScopePropertyNames ?? ['_collectionName'],
        };
    }

    protected collectionUrl(collectionName: string): string {
        return this.getUrl(collectionName);
    }

    protected async requestHeaders(): Promise<Record<string, string>> {
        const h = this.getHeaders?.();
        return h instanceof Promise ? h : (h ?? {});
    }

    query<TRoot extends {}, TShape>(
        event: DbPluginQueryEvent<TRoot, TShape>,
        done: PluginEventCallbackResult<ITranslatedValue<TShape>>
    ): void {
        this.handleQuery(event, done).catch((err) => {
            done(PluginEventResult.error(event.id, err instanceof Error ? err : new Error(String(err))));
        });
    }

    protected async handleQuery<TRoot extends {}, TShape>(
        event: DbPluginQueryEvent<TRoot, TShape>,
        done: PluginEventCallbackResult<ITranslatedValue<TShape>>
    ): Promise<void> {
        const { operation } = event;
        const { schema } = operation;
        const collectionName = schema.collectionName;
        try {
            const params = buildQueryParams(operation, this.querySerializationContext);
            const url = buildUrlWithQuery(this.collectionUrl(collectionName), params);
            console.debug('[HttpDbPlugin] query', { collectionName, eventId: event.id });

            const headers = await this.requestHeaders();
            const res = await fetch(url, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json', ...headers },
            });

            if (!res.ok) {
                console.warn('[HttpDbPlugin] query HTTP error', { collectionName, status: res.status, statusText: res.statusText });
                throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }

            const body = await res.json();
            const rows = parseQueryResponse(body);
            const translated = new JsonTranslator(operation).translate(rows);
            const count = Array.isArray(translated?.value) ? (translated.value as unknown[]).length : 0;
            console.debug('[HttpDbPlugin] query success', { collectionName, rowCount: count });
            done(PluginEventResult.success(event.id, translated));
        } catch (err) {
            console.error('[HttpDbPlugin] query failed', { collectionName, eventId: event.id, error: err });
            done(PluginEventResult.error(event.id, err instanceof Error ? err : new Error(String(err))));
        }
    }

    bulkPersist(
        event: DbPluginBulkPersistEvent,
        done: PluginEventCallbackPartialResult<BulkPersistResult>
    ): void {
        this.handleBulkPersist(event, done).catch((err) => {
            done(PluginEventResult.error(event.id, err instanceof Error ? err : new Error(String(err))));
        });
    }

    protected async handleBulkPersist(
        event: DbPluginBulkPersistEvent,
        done: PluginEventCallbackPartialResult<BulkPersistResult>
    ): Promise<void> {
        const result = event.operation.toResult();
        try {
            const schemaIds: number[] = [];
            for (const [schemaId, changes] of event.operation) {
                if (!changes?.hasItems) {
                    continue;
                }
                const schema = event.schemas.get(schemaId);
                if (!schema) {
                    continue;
                }
                schemaIds.push(schemaId);

                const adds = (changes.adds ?? []) as unknown[];
                const updates = (changes.updates ?? []).map(
                    (u: { entity?: unknown }) => u?.entity ?? u
                ) as unknown[];
                const removes = (changes.removes ?? []) as unknown[];

                console.debug('[HttpDbPlugin] bulkPersist', {
                    eventId: event.id,
                    schemaId,
                    collectionName: schema.collectionName,
                    adds: adds.length,
                    updates: updates.length,
                    removes: removes.length,
                });

                const url = this.collectionUrl(schema.collectionName);
                const headers = await this.requestHeaders();
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...headers },
                    body: JSON.stringify({ adds, updates, removes }),
                });
                if (!res.ok) {
                    console.warn('[HttpDbPlugin] bulkPersist HTTP error', {
                        collectionName: schema.collectionName,
                        status: res.status,
                        statusText: res.statusText,
                    });
                    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
                }

                const persistResult = result.get(schemaId);
                (persistResult.adds as unknown[]).push(...adds);
                (persistResult.updates as unknown[]).push(...updates);
                (persistResult.removes as unknown[]).push(...removes);
            }
            if (schemaIds.length > 0) {
                console.debug('[HttpDbPlugin] bulkPersist success', { eventId: event.id, schemaIds });
            }
            done(PluginEventResult.success(event.id, result));
        } catch (err) {
            console.error('[HttpDbPlugin] bulkPersist failed', { eventId: event.id, error: err });
            done(PluginEventResult.error(event.id, err instanceof Error ? err : new Error(String(err))));
        }
    }

    destroy(_event: DbPluginEvent, done: PluginEventCallbackResult<never>): void {
        done(PluginEventResult.success(_event.id));
    }
}
