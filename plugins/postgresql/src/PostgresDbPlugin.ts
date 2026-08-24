import { PostgresDbPluginBase } from '@routier/postgres-plugin-core';
import { pgDriver, PostgresDbPluginConfig } from './drivers/pg';

export type { PostgresDbPluginConfig } from './drivers/pg';

/**
 * PostgreSQL over the network, through `node-postgres`.
 *
 * Everything this plugin does with a statement lives in `@routier/postgres-plugin-core`, which
 * knows nothing about `pg` and nothing about Node. This class supplies the engine.
 */
export class PostgresDbPlugin extends PostgresDbPluginBase {
    constructor(config: PostgresDbPluginConfig) {
        super(pgDriver(config));
    }
}
