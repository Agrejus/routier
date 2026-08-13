import { afterAll, beforeAll, describe } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { MySqlContainer, StartedMySqlContainer } from '@testcontainers/mysql';
import { uuidv4 } from '@routier/core';
import { SqliteDbPlugin } from '@routier/sqlite-plugin';
import { PostgresDbPlugin } from '@routier/postgresql-plugin';
import { MysqlDbPlugin } from '@routier/mysql-plugin';
import { describeDialectConformance } from './dialectConformance';

/**
 * The shared SQL matrix, against each engine that consumes `@routier/sql-plugin-core`.
 *
 * SQLite always runs — it needs a file and nothing else — so a change to the shared builders
 * is caught by a plain `npx jest`. PostgreSQL and MySQL need containers and are gated behind
 * E2E_CONTAINERS with the rest. That split is deliberate rather than convenient: SQLite is
 * the permissive engine, so its passing is necessary and nowhere near sufficient, and the
 * gate is what keeps that honest instead of implied.
 */

const containersEnabled = process.env.E2E_CONTAINERS === '1';

// --- SQLite: a file, always on ---

describe('SQLite', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'routier-conformance-'));
    const file = path.join(directory, `${uuidv4()}.sqlite`);

    afterAll(() => {
        fs.rmSync(directory, { recursive: true, force: true });
    });

    describeDialectConformance({
        name: 'sqlite',
        createPlugin: () => new SqliteDbPlugin(file),
    });
});

// --- PostgreSQL ---

(containersEnabled ? describe : describe.skip)('PostgreSQL', () => {
    let container: StartedPostgreSqlContainer;

    beforeAll(async () => {
        container = await new PostgreSqlContainer('postgres:16-alpine').start();
    }, 180_000);

    afterAll(async () => {
        await container?.stop();
    });

    describeDialectConformance({
        name: 'postgresql',
        createPlugin: () => new PostgresDbPlugin({
            host: container.getHost(),
            port: container.getPort(),
            database: container.getDatabase(),
            user: container.getUsername(),
            password: container.getPassword(),
        }),
    });
});

// --- MySQL ---

(containersEnabled ? describe : describe.skip)('MySQL', () => {
    let container: StartedMySqlContainer;

    beforeAll(async () => {
        container = await new MySqlContainer('mysql:8.0').start();
    }, 300_000);

    afterAll(async () => {
        await container?.stop();
    });

    describeDialectConformance({
        name: 'mysql',
        createPlugin: () => new MysqlDbPlugin({
            host: container.getHost(),
            port: container.getPort(),
            database: container.getDatabase(),
            user: container.getUsername(),
            password: container.getUserPassword(),
        }),
    });
});
