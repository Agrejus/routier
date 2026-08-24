import { Pool, PoolClient } from 'pg';
import { PluginDestroyedError } from '@routier/core';
import { logger } from '@routier/core/utilities';
import type { PostgresConnection, PostgresDriver } from '@routier/postgres-plugin-core';

export interface PostgresDbPluginConfig {
    host?: string;
    port?: number;
    database: string;
    user?: string;
    password?: string;
    connectionString?: string;
    pool?: {
        min?: number;
        max?: number;
    };
}

/**
 * A stable, credential-free identifier for the server and database a config points at.
 *
 * The regex fallback exists so a connection string `URL` cannot parse still yields a usable
 * identifier rather than throwing from a constructor that previously never threw — it strips
 * the `user:password@` userinfo section, which is the only part that must not survive.
 */
export const describeTarget = (config: PostgresDbPluginConfig): string => {
    if (config.connectionString != null) {
        try {
            const url = new URL(config.connectionString);
            return `postgres://${url.hostname}:${url.port || 5432}${url.pathname}`;
        } catch {
            return config.connectionString.replace(/\/\/[^@/]*@/, '//');
        }
    }

    return `postgres://${config.host || 'localhost'}:${config.port || 5432}/${config.database}`;
};

class PooledConnection implements PostgresConnection {

    constructor(private readonly client: PoolClient, private readonly onRelease: () => void) { }

    async all(sql: string, params?: readonly unknown[]): Promise<unknown[]> {
        const result = await this.client.query(sql, params as unknown[] | undefined);

        return result.rows;
    }

    async run(sql: string, params?: readonly unknown[]): Promise<void> {
        await this.client.query(sql, params as unknown[] | undefined);
    }

    async release(): Promise<void> {
        this.onRelease();
    }
}

/**
 * PostgreSQL over the network, through a `pg` connection pool.
 *
 * Concurrent `connect` calls are the point of a pool, so unlike a single-connection engine
 * this driver does not serialise them.
 */
export const pgDriver = (config: PostgresDbPluginConfig): PostgresDriver => {
    const pool = new Pool({
        host: config.host || 'localhost',
        port: config.port || 5432,
        database: config.database,
        user: config.user,
        password: config.password,
        connectionString: config.connectionString,
        min: config.pool?.min || 2,
        max: config.pool?.max || 10,
    });

    // An idle client losing its connection (server restart/shutdown) emits 'error' on the
    // pool; without a handler that is an unhandled error that kills the process. The pool
    // discards the dead client and creates a new one on demand.
    pool.on('error', (err) => {
        logger.warn('[DB] PostgreSQL pool error on idle client', { error: err });
    });

    return {
        name: 'pg',
        databaseName: describeTarget(config),

        async connect(): Promise<PostgresConnection> {
            let client: PoolClient;

            try {
                client = await pool.connect();
            } catch (error) {
                // `pg` throws SYNCHRONOUSLY from `connect` once the pool has ended, which
                // lands past a callback-shaped caller as an unhandled exception. Rejecting
                // with the plugin's own error keeps a destroyed store reporting itself as one.
                if ((error as Error)?.message?.includes('after calling end')) {
                    throw new PluginDestroyedError("the connection pool was ended before this operation reached it");
                }

                throw error;
            }

            return new PooledConnection(client, () => client.release());
        },

        dispose(): Promise<void> {
            return pool.end();
        },
    };
};
