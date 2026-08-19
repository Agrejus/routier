[**routier-collection**](../../../../../README.md)

***

[routier-collection](../../../../../README.md) / [plugins/sqlite/src/d1](../README.md) / D1DbPluginOptions

# Type Alias: D1DbPluginOptions

> **D1DbPluginOptions** = `object`

Defined in: [plugins/sqlite/src/d1.ts:75](https://github.com/Agrejus/routier/blob/main/plugins/sqlite/src/d1.ts#L75)

## Properties

### deleteDatabase()?

> `optional` **deleteDatabase**: () => `Promise`\<`void`\>

Defined in: [plugins/sqlite/src/d1.ts:85](https://github.com/Agrejus/routier/blob/main/plugins/sqlite/src/d1.ts#L85)

How to drop the database, if dropping it is something the caller wants to allow.

Absent by default, and `destroy` then refuses. A D1 database is provisioned out of band
— by Wrangler, the dashboard, or the API — and a binding gives an application no way to
tell a scratch database from the production one it was pointed at by a misconfigured
environment variable. Refusing is the same decision the Turso driver made, and for the
same reason: a caller who knows which database this is can supply the teardown.

#### Returns

`Promise`\<`void`\>

***

### databaseName?

> `optional` **databaseName**: `string`

Defined in: [plugins/sqlite/src/d1.ts:92](https://github.com/Agrejus/routier/blob/main/plugins/sqlite/src/d1.ts#L92)

See `IDbPlugin.databaseName`. A D1 binding carries no name a plugin can read, so this
is the only way to tell two of them apart. Required in practice if one Worker binds
more than one D1 database and they share a schema — without it both get the default
and would see each other's subscription notifications.
