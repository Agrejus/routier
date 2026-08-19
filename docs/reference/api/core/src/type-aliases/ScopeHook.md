[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / ScopeHook

# Type Alias: ScopeHook()\<TContext\>

> **ScopeHook**\<`TContext`\> = (`info`) => \{ `filter`: [`Filter`](Filter.md)\<`any`\> \| [`ParamsFilter`](ParamsFilter.md)\<`any`, `any`\>; `params?`: \{ \}; \} \| `null`

Defined in: [core/src/plugins/wire/handler.ts:106](https://github.com/Agrejus/routier/blob/main/core/src/plugins/wire/handler.ts#L106)

The rows of one collection this caller may touch, as a filter.

Written exactly like a collection's own `.scope()` — a filter, optionally with params — so the same
expression is pushed into the database on reads and checked against each row on writes. Return
`null` for a collection this caller may see in full.

```ts
scope: ({ collectionName, context }) =>
    collectionName === "orders"
        ? { filter: ([row, p]) => row.tenantId === p.tenantId, params: { tenantId: context.tenantId } }
        : null
```

## Type Parameters

### TContext

`TContext`

## Parameters

### info

[`ScopeInfo`](ScopeInfo.md)\<`TContext`\>

## Returns

\{ `filter`: [`Filter`](Filter.md)\<`any`\> \| [`ParamsFilter`](ParamsFilter.md)\<`any`, `any`\>; `params?`: \{ \}; \} \| `null`
