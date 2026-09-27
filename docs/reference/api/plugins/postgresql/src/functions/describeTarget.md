[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/postgresql/src](../README.md) / describeTarget

# Function: describeTarget()

> **describeTarget**(`config`): `string`

Defined in: [plugins/postgresql/src/drivers/pg.ts:26](https://github.com/Agrejus/routier/blob/main/plugins/postgresql/src/drivers/pg.ts#L26)

A stable, credential-free identifier for the server and database a config points at.

The regex fallback exists so a connection string `URL` cannot parse still yields a usable
identifier rather than throwing from a constructor that previously never threw — it strips
the `user:password@` userinfo section, which is the only part that must not survive.

## Parameters

### config

[`PostgresDbPluginConfig`](../interfaces/PostgresDbPluginConfig.md)

## Returns

`string`
