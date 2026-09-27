[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / QueryOption

# Type Alias: QueryOption\<T, K\>

> **QueryOption**\<`T`, `K`\> = \{ `name`: [`QueryOptionName`](QueryOptionName.md); `value`: [`QueryOptionValueMap`](QueryOptionValueMap.md)\<`T`\>\[`K`\]; `target`: `"database"`; `reason`: [`DatabaseExecutionReason`](DatabaseExecutionReason.md); \} \| \{ `name`: [`QueryOptionName`](QueryOptionName.md); `value`: [`QueryOptionValueMap`](QueryOptionValueMap.md)\<`T`\>\[`K`\]; `target`: `"memory"`; `reason`: [`MemoryExecutionReason`](MemoryExecutionReason.md); \}

Defined in: [core/src/plugins/query/types.ts:82](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/types.ts#L82)

One option, and where it runs.

`target` narrows what `reason` can say, so an option cannot carry a reason that does not belong to
the half it was planned for. An option is never moved between arms — the database arm records what
became of it, which is what makes a redirect readable:

```ts
option.target === "database" && option.reason === "missing-capability"
```

## Type Parameters

### T

`T`

### K

`K` *extends* [`QueryOptionName`](QueryOptionName.md)
