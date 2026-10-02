import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';
import { environment, uniqueName } from './names';

export type PostgresServer = {
    getHost(): string;
    getPort(): number;
    getDatabase(): string;
    getUsername(): string;
    getPassword(): string;
    getConnectionUri(): string;
    createDatabase(): Promise<string>;
    stop(): Promise<void>;
};

type Connection = { host: string; port: number; user: string; password: string; database: string };

const sharedConnection = (prefix: string): Connection | null => {
    const host = environment(`${prefix}_HOST`);
    const port = environment(`${prefix}_PORT`);
    const user = environment(`${prefix}_USER`);
    const password = environment(`${prefix}_PASSWORD`);
    const database = environment(`${prefix}_DATABASE`);

    return host == null || port == null || user == null || password == null || database == null
        ? null
        : { host, port: Number(port), user, password, database };
};

const runAdmin = async (connection: Connection, sql: string): Promise<void> => {
    const client = new Client(connection);
    await client.connect();

    try {
        await client.query(sql);
    } finally {
        await client.end();
    }
};

const serverOn = async (connection: Connection, owned: boolean, release: () => Promise<unknown>): Promise<PostgresServer> => {
    const created: string[] = [];

    const createDatabase = async (): Promise<string> => {
        const name = uniqueName('e2e');
        await runAdmin(connection, `CREATE DATABASE ${name}`);
        created.push(name);
        return name;
    };

    const database = owned ? await createDatabase() : connection.database;

    return {
        getHost: () => connection.host,
        getPort: () => connection.port,
        getDatabase: () => database,
        getUsername: () => connection.user,
        getPassword: () => connection.password,
        getConnectionUri: () => `postgres://${connection.user}:${connection.password}@${connection.host}:${connection.port}/${database}`,
        createDatabase,
        stop: async () => {
            if (owned) {
                for (const name of created.splice(0)) {
                    await runAdmin(connection, `DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
                }
            }

            await release();
        },
    };
};

const start = async (prefix: string, image: string): Promise<PostgresServer> => {
    const shared = sharedConnection(prefix);

    if (shared != null) {
        return serverOn(shared, true, async () => undefined);
    }

    const container = await new PostgreSqlContainer(image).start();
    const connection = {
        host: container.getHost(),
        port: container.getPort(),
        user: container.getUsername(),
        password: container.getPassword(),
        database: container.getDatabase(),
    };

    return serverOn(connection, false, () => container.stop());
};

export const startPostgres = (): Promise<PostgresServer> => start('ROUTIER_PG', 'postgres:16-alpine');

export const startPgvector = (): Promise<PostgresServer> => start('ROUTIER_PGVECTOR', 'pgvector/pgvector:pg16');
