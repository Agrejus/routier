/**
 * Helpers for serializing Routier queries into HTTP query params (filter, sort, skip, take).
 * Used by HttpDbPlugin to build GET URLs for collection endpoints.
 */

import type { IQuery } from '@routier/core/plugins';
import type {
    Expression,
    ComparatorExpression,
    OperatorExpression,
    ValueExpression,
    PropertyExpression,
} from '@routier/core/expressions';

export type QueryParams = Record<string, string>;

/** Context passed when serializing a query into request params. */
export interface QuerySerializationContext {
    ignoreQueryForCollections: string[];
}

/**
 * Converts a Routier Expression to the JSON shape expected by the server filter param.
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

export function buildQueryParams<TRoot extends {}, TShape>(
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

export function buildUrlWithQuery(baseUrl: string, params: QueryParams): string {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== '') {
            search.set(k, String(v));
        }
    }
    const qs = search.toString();
    return qs ? `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}${qs}` : baseUrl;
}
