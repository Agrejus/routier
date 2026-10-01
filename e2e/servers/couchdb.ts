import { GenericContainer, Wait } from 'testcontainers';
import { environment } from './names';

export type CouchDbServer = {
    readonly url: string;
    readonly user: string;
    readonly password: string;
    stop(): Promise<void>;
};

const USER = 'admin';
const PASSWORD = 'password';

export const startCouchDb = async (): Promise<CouchDbServer> => {
    const url = environment('ROUTIER_COUCHDB_URL');
    const user = environment('ROUTIER_COUCHDB_USER');
    const password = environment('ROUTIER_COUCHDB_PASSWORD');

    if (url != null && user != null && password != null) {
        return { url, user, password, stop: async () => undefined };
    }

    const container = await new GenericContainer('couchdb:3')
        .withEnvironment({ COUCHDB_USER: USER, COUCHDB_PASSWORD: PASSWORD })
        .withExposedPorts(5984)
        .withWaitStrategy(Wait.forHttp('/_up', 5984).forStatusCode(200))
        .start();

    return {
        url: `http://${container.getHost()}:${container.getMappedPort(5984)}`,
        user: USER,
        password: PASSWORD,
        stop: async () => {
            await container.stop();
        },
    };
};
