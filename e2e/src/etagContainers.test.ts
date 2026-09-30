import { afterAll, beforeAll, describe } from '@jest/globals';
import { MongoDBContainer, StartedMongoDBContainer } from '@testcontainers/mongodb';
import { MySqlContainer, StartedMySqlContainer } from '@testcontainers/mysql';
import { MongoClient } from 'mongodb';
import { MongoClientDriver, MongoDbPlugin } from '@routier/mongodb-plugin';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { MysqlDbPlugin } from '@routier/mysql-plugin';
import { PostgresDbPlugin } from '@routier/postgresql-plugin';
import { describeEtagContract } from '@routier/test-utils';

const suite = process.env.E2E_CONTAINERS === '1' ? describe : describe.skip;

const DATABASE_COUNT = 16;
const databaseNames = Array.from({ length: DATABASE_COUNT }, (_, index) => `etag_${index}`);

const takeDatabase = (taken: { next: number }): string => {
    const database = databaseNames[taken.next++];

    if (database == null) {
        throw new Error(`The etag contract used more than ${DATABASE_COUNT} databases`);
    }

    return database;
};

suite('etag contract: postgresql', () => {
    let container: StartedPostgreSqlContainer;
    const taken = { next: 0 };

    beforeAll(async () => {
        container = await new PostgreSqlContainer('postgres:16-alpine').start();
        const { Client } = await import('pg');
        const admin = new Client({ connectionString: container.getConnectionUri() });
        await admin.connect();

        try {
            for (const name of databaseNames) {
                await admin.query(`CREATE DATABASE ${name}`);
            }
        } finally {
            await admin.end();
        }
    }, 300_000);

    afterAll(async () => {
        await container?.stop();
    });

    describeEtagContract('postgresql', () => new PostgresDbPlugin({
        host: container.getHost(),
        port: container.getPort(),
        database: takeDatabase(taken),
        user: container.getUsername(),
        password: container.getPassword(),
    }));
});

suite('etag contract: mysql', () => {
    let container: StartedMySqlContainer;
    const taken = { next: 0 };

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
            for (const name of databaseNames) {
                await admin.query(`CREATE DATABASE IF NOT EXISTS \`${name}\``);
            }
        } finally {
            await admin.end();
        }
    }, 300_000);

    afterAll(async () => {
        await container?.stop();
    });

    describeEtagContract('mysql', () => new MysqlDbPlugin({
        host: container.getHost(),
        port: container.getPort(),
        database: takeDatabase(taken),
        user: 'root',
        password: container.getRootPassword(),
    }));
});

suite('etag contract: mongodb', () => {
    let container: StartedMongoDBContainer;
    let client: MongoClient;
    const taken = { next: 0 };

    beforeAll(async () => {
        container = await new MongoDBContainer('mongo:7').start();
        client = new MongoClient(container.getConnectionString(), { directConnection: true });
        await client.connect();
    }, 300_000);

    afterAll(async () => {
        await client?.close();
        await container?.stop();
    });

    describeEtagContract('mongodb', () => new MongoDbPlugin(new MongoClientDriver(client, takeDatabase(taken), { transactions: 'required' })));
});
