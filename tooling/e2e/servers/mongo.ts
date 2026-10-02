import { MongoDBContainer } from '@testcontainers/mongodb';
import { MongoClient } from 'mongodb';
import { environment, uniqueName } from './names';

export type MongoServer = {
    getConnectionString(): string;
    databaseName(base: string): string;
    stop(): Promise<void>;
};

const sharedServer = (url: string): MongoServer => {
    const named: string[] = [];

    return {
        getConnectionString: () => url,
        databaseName: (base) => {
            const name = uniqueName(`e2e_${base}`);
            named.push(name);
            return name;
        },
        stop: async () => {
            const client = new MongoClient(url, { directConnection: true });
            await client.connect();

            try {
                for (const name of named.splice(0)) {
                    await client.db(name).dropDatabase();
                }
            } finally {
                await client.close();
            }
        },
    };
};

export const startMongo = async (): Promise<MongoServer> => {
    const url = environment('ROUTIER_MONGO_URL');

    if (url != null) {
        return sharedServer(url);
    }

    const container = await new MongoDBContainer('mongo:7').start();

    return {
        getConnectionString: () => container.getConnectionString(),
        databaseName: (base) => uniqueName(base),
        stop: async () => {
            await container.stop();
        },
    };
};
