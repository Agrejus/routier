import { GenericContainer, Wait } from 'testcontainers';
import { environment } from './names';

export type S3Server = {
    readonly endpoint: string;
    readonly accessKey: string;
    readonly secretKey: string;
    stop(): Promise<void>;
};

const ACCESS_KEY = 'routier';
const SECRET_KEY = 'routier-secret';

export const startS3 = async (): Promise<S3Server> => {
    const endpoint = environment('ROUTIER_S3_ENDPOINT');
    const accessKey = environment('ROUTIER_S3_ACCESS_KEY');
    const secretKey = environment('ROUTIER_S3_SECRET_KEY');

    if (endpoint != null && accessKey != null && secretKey != null) {
        return { endpoint, accessKey, secretKey, stop: async () => undefined };
    }

    const container = await new GenericContainer('versity/versitygw:v1.8.0')
        .withEnvironment({ ROOT_ACCESS_KEY: ACCESS_KEY, ROOT_SECRET_KEY: SECRET_KEY })
        .withCommand(['--port', ':7070', 'posix', '/tmp'])
        .withExposedPorts(7070)
        .withWaitStrategy(Wait.forListeningPorts())
        .start();

    return {
        endpoint: `http://${container.getHost()}:${container.getMappedPort(7070)}`,
        accessKey: ACCESS_KEY,
        secretKey: SECRET_KEY,
        stop: async () => {
            await container.stop();
        },
    };
};
