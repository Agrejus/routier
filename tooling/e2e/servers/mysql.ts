import { MySqlContainer } from '@testcontainers/mysql';
import { createConnection } from 'mysql2/promise';
import { environment, uniqueName } from './names';

export type MysqlServer = {
    getHost(): string;
    getPort(): number;
    getDatabase(): string;
    getUsername(): string;
    getUserPassword(): string;
    getRootPassword(): string;
    createDatabase(): Promise<string>;
    stop(): Promise<void>;
};

type Connection = { host: string; port: number; user: string; userPassword: string; rootPassword: string; database: string };

const sharedConnection = (): Connection | null => {
    const host = environment('ROUTIER_MYSQL_HOST');
    const port = environment('ROUTIER_MYSQL_PORT');
    const password = environment('ROUTIER_MYSQL_PASSWORD');

    return host == null || port == null || password == null
        ? null
        : { host, port: Number(port), user: 'root', userPassword: password, rootPassword: password, database: '' };
};

const runAdmin = async (connection: Connection, sql: string): Promise<void> => {
    const admin = await createConnection({ host: connection.host, port: connection.port, user: 'root', password: connection.rootPassword });

    try {
        await admin.query(sql);
    } finally {
        await admin.end();
    }
};

const serverOn = async (connection: Connection, owned: boolean, release: () => Promise<unknown>): Promise<MysqlServer> => {
    const created: string[] = [];

    const createDatabase = async (): Promise<string> => {
        const name = uniqueName('e2e');
        await runAdmin(connection, `CREATE DATABASE \`${name}\``);
        created.push(name);
        return name;
    };

    const database = owned ? await createDatabase() : connection.database;

    return {
        getHost: () => connection.host,
        getPort: () => connection.port,
        getDatabase: () => database,
        getUsername: () => connection.user,
        getUserPassword: () => connection.userPassword,
        getRootPassword: () => connection.rootPassword,
        createDatabase,
        stop: async () => {
            if (owned) {
                for (const name of created.splice(0)) {
                    await runAdmin(connection, `DROP DATABASE IF EXISTS \`${name}\``);
                }
            }

            await release();
        },
    };
};

export const startMysql = async (): Promise<MysqlServer> => {
    const shared = sharedConnection();

    if (shared != null) {
        return serverOn(shared, true, async () => undefined);
    }

    const container = await new MySqlContainer('mysql:8.0').start();
    const connection = {
        host: container.getHost(),
        port: container.getPort(),
        user: container.getUsername(),
        userPassword: container.getUserPassword(),
        rootPassword: container.getRootPassword(),
        database: container.getDatabase(),
    };

    return serverOn(connection, false, () => container.stop());
};
