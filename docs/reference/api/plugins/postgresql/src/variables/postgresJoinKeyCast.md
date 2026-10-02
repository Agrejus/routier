[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/postgresql/src](../README.md) / postgresJoinKeyCast

# Variable: postgresJoinKeyCast()

> `const` **postgresJoinKeyCast**: \<`TOuter`, `TInner`\>(`outerSchema`, `innerSchema`, `join`) => `object`

Defined in: plugins/postgres-core/dist/utils.d.ts:76

Which side of a join has to be cast, and to what.

PostgreSQL has no implicit `uuid = text`, and the everyday join shape crosses exactly that
boundary: a string identity key is a `uuid` column, and the foreign key pointing at it is an
ordinary `text` one. The uuid side is the one cast, never the text side — see `keyCast` in
`buildJoinStatement` for why casting text to uuid is not an option.

Nothing is cast when both columns are the same type, so an int-to-int or text-to-text join keeps
its indexes.

## Type Parameters

### TOuter

`TOuter` *extends* `object`

### TInner

`TInner` *extends* `object`

## Parameters

### outerSchema

`CompiledSchema`\<`TOuter`\>

### innerSchema

`CompiledSchema`\<`TInner`\>

### join

`JoinQueryOptionValue`

## Returns

`object`

### outer?

> `optional` **outer**: `string`

### inner?

> `optional` **inner**: `string`
