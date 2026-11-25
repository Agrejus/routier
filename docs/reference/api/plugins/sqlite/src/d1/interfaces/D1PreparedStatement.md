[**routier-collection**](../../../../../README.md)

***

[routier-collection](../../../../../README.md) / [plugins/sqlite/src/d1](../README.md) / D1PreparedStatement

# Interface: D1PreparedStatement

Defined in: [plugins/sqlite/src/d1.ts:57](https://github.com/Agrejus/routier/blob/main/plugins/sqlite/src/d1.ts#L57)

A bound, ready-to-run statement.

Typed structurally, like the libSQL client the Turso driver takes, so
`@cloudflare/workers-types` is not a dependency of this package and a caller's real binding
satisfies it without a cast.

## Methods

### bind()

> **bind**(...`values`): `D1PreparedStatement`

Defined in: [plugins/sqlite/src/d1.ts:59](https://github.com/Agrejus/routier/blob/main/plugins/sqlite/src/d1.ts#L59)

Binds positional parameters. Returns a new statement; D1's is not mutating.

#### Parameters

##### values

...`unknown`[]

#### Returns

`D1PreparedStatement`

***

### all()

> **all**\<`T`\>(): `Promise`\<\{ `results`: `T`[]; \}\>

Defined in: [plugins/sqlite/src/d1.ts:61](https://github.com/Agrejus/routier/blob/main/plugins/sqlite/src/d1.ts#L61)

Runs the statement and returns its rows, including a `RETURNING` clause's.

#### Type Parameters

##### T

`T` = `unknown`

#### Returns

`Promise`\<\{ `results`: `T`[]; \}\>
