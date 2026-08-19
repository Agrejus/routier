[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/mysql/src](../README.md) / MysqlDbPluginConfig

# Interface: MysqlDbPluginConfig

Defined in: [plugins/mysql/src/MysqlDbPlugin.ts:10](https://github.com/Agrejus/routier/blob/main/plugins/mysql/src/MysqlDbPlugin.ts#L10)

## Properties

### host?

> `optional` **host**: `string`

Defined in: [plugins/mysql/src/MysqlDbPlugin.ts:11](https://github.com/Agrejus/routier/blob/main/plugins/mysql/src/MysqlDbPlugin.ts#L11)

***

### port?

> `optional` **port**: `number`

Defined in: [plugins/mysql/src/MysqlDbPlugin.ts:12](https://github.com/Agrejus/routier/blob/main/plugins/mysql/src/MysqlDbPlugin.ts#L12)

***

### database?

> `optional` **database**: `string`

Defined in: [plugins/mysql/src/MysqlDbPlugin.ts:14](https://github.com/Agrejus/routier/blob/main/plugins/mysql/src/MysqlDbPlugin.ts#L14)

Required unless `connectionString` is given, which carries the database itself.

***

### user?

> `optional` **user**: `string`

Defined in: [plugins/mysql/src/MysqlDbPlugin.ts:15](https://github.com/Agrejus/routier/blob/main/plugins/mysql/src/MysqlDbPlugin.ts#L15)

***

### password?

> `optional` **password**: `string`

Defined in: [plugins/mysql/src/MysqlDbPlugin.ts:16](https://github.com/Agrejus/routier/blob/main/plugins/mysql/src/MysqlDbPlugin.ts#L16)

***

### connectionString?

> `optional` **connectionString**: `string`

Defined in: [plugins/mysql/src/MysqlDbPlugin.ts:25](https://github.com/Agrejus/routier/blob/main/plugins/mysql/src/MysqlDbPlugin.ts#L25)

A `mysql://user:password@host:port/database` URI, passed straight to mysql2.

Mutually exclusive with the discrete fields above — supplying both throws rather than
silently picking one. There is no correct precedence to guess: a connection string
that disagrees with an explicit `host` means the caller believes something untrue
about where their data is going.

***

### pool?

> `optional` **pool**: `object`

Defined in: [plugins/mysql/src/MysqlDbPlugin.ts:26](https://github.com/Agrejus/routier/blob/main/plugins/mysql/src/MysqlDbPlugin.ts#L26)

#### max?

> `optional` **max**: `number`

Maximum pooled connections (mysql2's `connectionLimit`). Default 10.

There is no `min`: mysql2 opens connections on demand and has no minimum-size
concept. The field used to exist here and was silently discarded, which is worse
than not offering it.
