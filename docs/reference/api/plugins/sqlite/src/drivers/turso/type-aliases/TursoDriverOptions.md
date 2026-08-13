[**routier-collection**](../../../../../../README.md)

***

[routier-collection](../../../../../../README.md) / [plugins/sqlite/src/drivers/turso](../README.md) / TursoDriverOptions

# Type Alias: TursoDriverOptions

> **TursoDriverOptions** = `object`

Defined in: [plugins/sqlite/src/drivers/turso.ts:168](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/sqlite/src/drivers/turso.ts#L168)

## Properties

### deleteDatabase()?

> `readonly` `optional` **deleteDatabase**: () => `Promise`\<`void`\>

Defined in: [plugins/sqlite/src/drivers/turso.ts:180](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/sqlite/src/drivers/turso.ts#L180)

What `destroy` does, which only the caller can know.

A libSQL database is provisioned out of band — by the Turso CLI, the platform API, or
the file system — so there is no operation this driver could perform that is right for
every deployment. Dropping a remote database from inside an application is destructive
in a way it cannot scope, so the default REFUSES rather than guesses.

A caller who knows what their URL points at supplies the teardown. For a local
`file:` database that is an unlink; for a disposable test database it might be a drop.

#### Returns

`Promise`\<`void`\>
