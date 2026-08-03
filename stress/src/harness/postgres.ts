import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { IDbPlugin } from '@routier/core';
import { PostgresDbPlugin } from '@routier/postgresql-plugin';

/**
 * One PostgreSQL container, shared by every scenario in a file.
 *
 * The other backends are described by `Backend` in backends.ts, and a container cannot join
 * that list: `Backend.create()` is synchronous, and starting a server is not. Forcing it in
 * would mean either a blocking start or a factory that hands back a plugin pointing at a
 * server that is not listening yet.
 *
 * So containers get their own shape, built around the one thing that is actually different —
 * an asynchronous, expensive, once-per-file startup. Reusing a single container across a file's
 * scenarios is deliberate: a Postgres start is several seconds, and paying it per scenario
 * would spend most of the budget on setup. Isolation comes from each scenario using its own
 * collection names, so they land in different tables of the same database.
 */

const IMAGE = 'postgres:16-alpine';

export class PostgresHarness {
    private container: StartedPostgreSqlContainer | null = null;
    private readonly plugins: IDbPlugin[] = [];

    /** Starts the server. Call from `beforeAll`. */
    async start(): Promise<void> {
        this.container = await new PostgreSqlContainer(IMAGE).start();
    }

    /**
     * Stops the server and destroys every plugin handed out.
     *
     * Order matters: the pool has to close before the server goes away, or `pg` emits an idle
     * client error against a socket that is no longer there — a failure in teardown, reported
     * from the wrong place, that says nothing about the scenario.
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
            throw new Error('PostgresHarness.connect() called before start()');
        }

        return {
            host: this.container.getHost(),
            port: this.container.getPort(),
            database: this.container.getDatabase(),
            user: this.container.getUsername(),
            password: this.container.getPassword(),
        };
    }

    /**
     * A plugin against the running server, tracked for teardown.
     *
     * Every call is an independent plugin with its own connection pool over the SAME database,
     * which is what the multi-instance scenario needs — the equivalent of several processes
     * sharing one server, rather than several handles onto one pool.
     */
    createPlugin(): IDbPlugin {
        const plugin = new PostgresDbPlugin(this.connection);
        this.plugins.push(plugin);
        return plugin;
    }
}
