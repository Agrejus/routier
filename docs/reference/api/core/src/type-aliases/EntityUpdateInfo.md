[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / EntityUpdateInfo

# Type Alias: EntityUpdateInfo\<T\>

> **EntityUpdateInfo**\<`T`\> = `object`

Defined in: [core/src/plugins/types.ts:140](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/types.ts#L140)

## Type Parameters

### T

`T` *extends* `object`

## Properties

### entity

> **entity**: [`InferType`](InferType.md)\<`T`\>

Defined in: [core/src/plugins/types.ts:141](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/types.ts#L141)

***

### changeType

> **changeType**: [`EntityChangeType`](EntityChangeType.md)

Defined in: [core/src/plugins/types.ts:142](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/types.ts#L142)

***

### delta

> **delta**: [`EntityDelta`](EntityDelta.md)\<`T`\>

Defined in: [core/src/plugins/types.ts:143](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/types.ts#L143)

***

### concurrency?

> `optional` **concurrency**: `object`

Defined in: [core/src/plugins/types.ts:151](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/types.ts#L151)

Present when the schema declares a `.concurrency()` token: the update must be
applied ONLY IF the stored row's `column` still equals `expected` (the value the
writer read). The entity/delta already carry the bumped value to store on success.
A plugin that finds a mismatch must fail the whole save with an
OptimisticConcurrencyError naming the conflicted rows — never apply partially.

#### column

> **column**: `string`

#### expected

> **expected**: `number`

***

### previous?

> `optional` **previous**: [`EntityDelta`](EntityDelta.md)\<`T`\>

Defined in: [core/src/plugins/types.ts:171](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/types.ts#L171)

The values these properties held BEFORE this update — keyed like `delta`, which holds
the values they hold after.

DATASTORE-INTERNAL. The datastore strips it before the plugin is called
(`DataStore.onSavePreparedChanges`), so no plugin ever receives it and nothing goes over
a wire. It exists for save-pipeline participants that must undo work keyed by an old
value — a search index has to delete the rows for terms that just left a field, and
`delta` only says what the field says now.

Always populated for an update. It is part of what an update IS, not something a
declaration switches on — a consumer can rely on it without knowing what else the store
declared, and there is one code path to reason about rather than two.

Which properties appear depends on what the change-tracking mode can know. Proxy and
immutable name exactly the properties that changed. Diff detects change by comparing a
content hash, so it cannot say WHICH property moved and reports every root property —
the same "assume everything" convention its empty `delta` already uses.
