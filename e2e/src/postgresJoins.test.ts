import { afterAll, beforeAll, describe, it } from '@jest/globals';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';
import { PostgresDbPlugin } from '@routier/postgresql-plugin';
import { describeJoinContract } from '@routier/test-utils';

/**
 * The cross-backend join suite against a real PostgreSQL server.
 *
 * The same `describeJoinContract` the in-memory backends run, which is the whole point: a native
 * `JOIN` and an in-memory hash join have to return the same pairs, and only running one suite
 * against both can say so.
 *
 * Why this needs a real server rather than a unit test over the emitted SQL: the SQL is what the
 * plugin BELIEVES, and every defect worth catching here is a place where the belief was wrong.
 * known-defects records four of them (#19–#22), all found only once PostgreSQL saw the statement.
 *
 * Opt-in behind E2E_CONTAINERS, like the other container suites.
 */

const shouldRun = process.env.E2E_CONTAINERS === '1';

let container: StartedPostgreSqlContainer;

/**
 * A fresh DATABASE per store, because the contract seeds its fixture once per test.
 *
 * The in-process backends get isolation from a per-store database name; a container has one
 * server, and tables persist between tests, so a second test would join over the first test's rows
 * and count too many pairs. Creating a database is the cheapest true isolation here — a shared one
 * with cleanup between tests would leave the suite order-dependent.
 */
let databaseIndex = 0;

const pluginFactory = () => {
    databaseIndex += 1;

    const database = `join_contract_${databaseIndex}`;

    return new PostgresDbPlugin({
        host: container.getHost(),
        port: container.getPort(),
        database,
        user: container.getUsername(),
        password: container.getPassword(),
    });
};

/** Databases cannot be created by the pooled plugin, so they are made up front on one admin client. */
const createDatabases = async (count: number) => {
    const admin = new Client({
        host: container.getHost(),
        port: container.getPort(),
        database: container.getDatabase(),
        user: container.getUsername(),
        password: container.getPassword(),
    });

    await admin.connect();

    try {
        for (let i = 1; i <= count; i++) {
            await admin.query(`CREATE DATABASE join_contract_${i}`);
        }
    } finally {
        await admin.end();
    }
};

if (shouldRun) {
    beforeAll(async () => {
        container = await new PostgreSqlContainer('postgres:16-alpine').start();

        // Comfortably more than the suite has tests. An unused database costs nothing and
        // running out mid-suite would fail in a way that looks like a join defect.
        await createDatabases(40);
    }, 120_000);

    afterAll(async () => {
        await container?.stop();
    });

    describeJoinContract('postgresql', pluginFactory);
} else {
    // A skipped TEST, not an empty describe: Jest fails a suite that contains no tests at all, so
    // an empty block would report as a failure rather than as "not run here".
    describe('postgresql join contract', () => {
        it.skip('runs only with E2E_CONTAINERS=1 and a Docker daemon', () => undefined);
    });
}
