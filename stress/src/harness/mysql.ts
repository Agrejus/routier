import { MySqlContainer, StartedMySqlContainer } from '@testcontainers/mysql';
import { IDbPlugin } from '@routier/core';
import { MysqlDbPlugin } from '@routier/mysql-plugin';

/**
 * One MySQL container, shared by every scenario in a file.
 *
 * Deliberately the same shape as `PostgresHarness` — see that file for why a container
 * cannot be a `Backend`: `Backend.create()` is synchronous and starting a server is not.
 * Isolation between scenarios comes from their collection names, so they land in different
 * tables of one database rather than paying a container start each.
 *
 * MySQL earns its own harness rather than sharing Postgres's because the failures worth
 * finding under load are engine-specific. DDL implicitly commits here, so a table created
 * mid-save ends the transaction; there is no RETURNING, so every written row is read back by
 * a second statement whose correctness depends on assumptions about what the server just
 * did; and a concurrency conflict is `affectedRows === 0` rather than an empty result. None
 * of that is observable against Postgres, and a green Postgres run says nothing about it.
 */

const IMAGE = 'mysql:8.0';

export class MysqlHarness {
    private container: StartedMySqlContainer | null = null;
    private readonly plugins: IDbPlugin[] = [];

    /** Starts the server. Call from `beforeAll` — allow a generous timeout, MySQL is slow to boot. */
    async start(): Promise<void> {
        this.container = await new MySqlContainer(IMAGE).start();
    }

    /**
     * Stops the server and destroys every plugin handed out.
     *
     * Pools close before the server goes away, for the same reason as Postgres: a pool
     * outliving its server reports a connection failure from teardown, which says nothing
     * about the scenario that just ran.
     */
    async stop(): Promise<void> {
        for (const plugin of this.plugins.splice(0)) {
            await new Promise<void>(resolve => {
                try {
                    plugin.destroy({} as any, () => resolve());
                } catch {
                    resolve();
                }
            });
        }

        await this.container?.stop();
        this.container = null;
    }

    get started() {
        return this.container != null;
    }

    /** Connection details for the running server. */
    get connection() {
        if (this.container == null) {
            throw new Error('MysqlHarness.connect() called before start()');
        }

        return {
            host: this.container.getHost(),
            port: this.container.getPort(),
            database: this.container.getDatabase(),
            user: this.container.getUsername(),
            password: this.container.getUserPassword(),
        };
    }

    /**
     * A plugin against the running server, tracked for teardown.
     *
     * Every call is an independent plugin with its own pool over the SAME database — several
     * processes sharing one server, which is what the multi-instance scenarios need, rather
     * than several handles onto one pool.
     */
    createPlugin(): IDbPlugin {
        const plugin = new MysqlDbPlugin(this.connection);
        this.plugins.push(plugin);
        return plugin;
    }
}
