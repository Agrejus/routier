import { afterAll, beforeAll, describe, it } from '@jest/globals';
import { MySqlContainer, StartedMySqlContainer } from '@testcontainers/mysql';
import { MysqlDbPlugin } from '@routier/mysql-plugin';
import { describeJoinContract } from '@routier/test-utils';

/**
 * The cross-backend join suite against a real MySQL server.
 *
 * The same `describeJoinContract` every other backend runs: a native `JOIN` and an in-memory hash
 * join must return the same pairs, and one suite over both is the only thing that can say so.
 *
 * A real server rather than a string-shape test over the emitted SQL, for the reason
 * `mysqlContainer.test.ts` gives at length — the SQL is what the plugin BELIEVES, and this engine
 * differs from the others in ways only it can reveal.
 *
 * Opt-in behind E2E_CONTAINERS.
 */

const shouldRun = process.env.E2E_CONTAINERS === '1';

let container: StartedMySqlContainer;

/**
 * A fresh DATABASE per store, following the contract kit in `mysqlContainer.test.ts`.
 *
 * The contract seeds its fixture once per test and one server keeps its tables between them, so a
 * shared database would have the second test joining over the first test's rows. Databases are
 * created up front by an admin connection because the pooled plugin connects to one and cannot
 * make another.
 */
const DATABASE_COUNT = 40;
const databaseNames: string[] = [];
let nextDatabase = 0;

const pluginFactory = () => {
    const database = databaseNames[nextDatabase++];

    if (database == null) {
        throw new Error(
            `MySQL join contract exhausted its ${DATABASE_COUNT} pre-created databases. ` +
            `Raise DATABASE_COUNT — the suite calls the factory once per store.`
        );
    }

    return new MysqlDbPlugin({
        host: container.getHost(),
        port: container.getPort(),
        database,
        user: 'root',
        password: container.getRootPassword(),
    });
};

if (shouldRun) {
    beforeAll(async () => {
        container = await new MySqlContainer('mysql:8.0').start();

        const { createConnection } = await import('mysql2/promise');
        const admin = await createConnection({
            host: container.getHost(),
            port: container.getPort(),
            user: 'root',
            password: container.getRootPassword(),
        });

        try {
            for (let i = 0; i < DATABASE_COUNT; i++) {
                const name = `join_contract_${i}`;
                await admin.query(`CREATE DATABASE IF NOT EXISTS \`${name}\``);
                databaseNames.push(name);
            }
        } finally {
            await admin.end();
        }
    }, 300_000);

    afterAll(async () => {
        await container?.stop();
    });

    describeJoinContract('mysql', pluginFactory);
} else {
    // A skipped TEST, not an empty describe: Jest fails a suite that contains no tests at all, so
    // an empty block would report as a failure rather than as "not run here".
    describe('mysql join contract', () => {
        it.skip('runs only with E2E_CONTAINERS=1 and a Docker daemon', () => undefined);
    });
}
