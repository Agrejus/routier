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

const single = (open: () => Promise<SqliteConnection>): SqliteConnections => {
    let opening: Promise<SqliteConnection> | null = null;
    let turn: Promise<void> = Promise.resolve();

    const use = <T>(work: Work<T>): Promise<T> => {
        const result = turn.then(async () => {
            opening ??= open().catch(error => {
                opening = null;
                throw error;
            });

            return work(await opening);
        });

        turn = result.then((): void => undefined, (): void => undefined);
        return result;
    };

    return {
        read: use,
        write: use,
        close: async () => {
            const closing = opening;
            opening = null;
            await closing?.then(connection => connection.close()).catch((): void => undefined);
        },
    };
};

export type ConnectionStrategy = 'per-operation' | 'writer-reader' | 'single';

const STRATEGIES: Record<ConnectionStrategy, (open: () => Promise<SqliteConnection>) => SqliteConnections> = {
    'per-operation': perOperation,
    'writer-reader': writerReader,
    'single': single,
};

export const strategyFor = (keepsConnections: boolean, databaseName: string): ConnectionStrategy =>
    !keepsConnections ? 'per-operation' : databaseName === ':memory:' ? 'single' : 'writer-reader';

export const createConnections = (strategy: ConnectionStrategy, open: () => Promise<SqliteConnection>): SqliteConnections =>
    STRATEGIES[strategy](open);
