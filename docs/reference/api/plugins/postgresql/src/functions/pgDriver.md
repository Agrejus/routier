[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/postgresql/src](../README.md) / pgDriver

# Function: pgDriver()

> **pgDriver**(`config`): [`PostgresDriver`](../interfaces/PostgresDriver.md)

Defined in: [plugins/postgresql/src/drivers/pg.ts:64](https://github.com/Agrejus/routier/blob/main/plugins/postgresql/src/drivers/pg.ts#L64)

PostgreSQL over the network, through a `pg` connection pool.

Concurrent `connect` calls are the point of a pool, so unlike a single-connection engine
this driver does not serialise them.

## Parameters

### config

[`PostgresDbPluginConfig`](../interfaces/PostgresDbPluginConfig.md)

## Returns

[`PostgresDriver`](../interfaces/PostgresDriver.md)
