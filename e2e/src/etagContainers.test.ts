import { afterAll, beforeAll, describe } from '@jest/globals';
import { MongoClient } from 'mongodb';
import { MongoClientDriver, MongoDbPlugin } from '@routier/mongodb-plugin';
import { MysqlDbPlugin } from '@routier/mysql-plugin';
import { PostgresDbPlugin } from '@routier/postgresql-plugin';
import { describeEtagContract } from '@routier/test-utils';
import { MongoServer, MysqlServer, PostgresServer, startMongo, startMysql, startPostgres } from '../servers';

const suite = process.env.E2E_CONTAINERS === '1' ? describe : describe.skip;

const DATABASE_COUNT = 16;

const databasesFrom = async (create: () => Promise<string>): Promise<string[]> => {
    const names: string[] = [];

    for (let index = 0; index < DATABASE_COUNT; index++) {
        names.push(await create());
    }

    return names;
};

const take = (names: string[]): string => {
    const name = names.shift();

    if (name == null) {
        throw new Error(`The etag contract used more than ${DATABASE_COUNT} databases`);
    }

    return name;
};

suite('etag contract: postgresql', () => {
    let server: PostgresServer;
    let databases: string[] = [];

    beforeAll(async () => {
        server = await startPostgres();
        databases = await databasesFrom(server.createDatabase);
    }, 300_000);

    afterAll(async () => {
        await server?.stop();
    });

    describeEtagContract('postgresql', () => new PostgresDbPlugin({
        host: server.getHost(),
        port: server.getPort(),
        database: take(databases),
        user: server.getUsername(),
        password: server.getPassword(),
    }));
});

suite('etag contract: mysql', () => {
    let server: MysqlServer;
    let databases: string[] = [];

    beforeAll(async () => {
        server = await startMysql();
        databases = await databasesFrom(server.createDatabase);
    }, 300_000);

    afterAll(async () => {
        await server?.stop();
    });

    describeEtagContract('mysql', () => new MysqlDbPlugin({
        host: server.getHost(),
        port: server.getPort(),
        database: take(databases),
        user: 'root',
        password: server.getRootPassword(),
    }));
});

suite('etag contract: mongodb', () => {
    let server: MongoServer;

    beforeAll(async () => {
        server = await startMongo();
    }, 300_000);

    afterAll(async () => {
        await server?.stop();
    });

    describeEtagContract('mongodb', () => new MongoDbPlugin(new MongoClientDriver(
        new MongoClient(server.getConnectionString(), { directConnection: true }),
        server.databaseName('etag'),
        { transactions: 'required' },
    )));
});
