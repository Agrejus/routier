import type { SqliteConnection } from './drivers/types';

type Work<T> = (connection: SqliteConnection) => Promise<T>;

export interface SqliteConnections {
    read<T>(work: Work<T>): Promise<T>;
    write<T>(work: Work<T>): Promise<T>;
    close(): Promise<void>;
}

export const IDLE_CLOSE_MS = 1000;

const perOperation = (open: () => Promise<SqliteConnection>): SqliteConnections => {
    const lease = async <T>(work: Work<T>): Promise<T> => {
        const connection = await open();

        try {
            return await work(connection);
        } finally {
            await connection.close().catch((): void => undefined);
        }
    };

    return { read: lease, write: lease, close: async () => undefined };
};

class KeptConnection {
    private opening: Promise<SqliteConnection> | null = null;
    private idle: ReturnType<typeof setTimeout> | undefined;
    private active = 0;

    constructor(private readonly open: () => Promise<SqliteConnection>) { }

    async use<T>(work: Work<T>): Promise<T> {
        this.active++;
        clearTimeout(this.idle);

        try {
            this.opening ??= this.open().catch(error => {
                this.opening = null;
                throw error;
            });

            return await work(await this.opening);
        } finally {
            this.active--;

            if (this.active === 0) {
                this.idle = setTimeout(() => void this.close(), IDLE_CLOSE_MS);
                this.idle.unref();
            }
        }
    }

    async close(): Promise<void> {
        clearTimeout(this.idle);
        const opening = this.opening;
        this.opening = null;

        await opening?.then(connection => connection.close()).catch((): void => undefined);
    }
}

const writerReader = (open: () => Promise<SqliteConnection>): SqliteConnections => {
    const writer = new KeptConnection(open);
    const reader = new KeptConnection(open);

    return {
        read: work => reader.use(work),
        write: work => writer.use(work),
        close: async () => {
            await Promise.all([writer.close(), reader.close()]);
        },
    };
};

export const createConnections = (keepsConnections: boolean, open: () => Promise<SqliteConnection>): SqliteConnections =>
    keepsConnections ? writerReader(open) : perOperation(open);
