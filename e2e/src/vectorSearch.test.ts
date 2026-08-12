import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { MySqlContainer, StartedMySqlContainer } from '@testcontainers/mysql';
import { MongoDBContainer, StartedMongoDBContainer } from '@testcontainers/mongodb';
import { MongoClient } from 'mongodb';
import { describeFullTextSearch, describeVectorSearch, vectorContractSchema } from '@routier/test-utils';
import { PostgresDbPlugin } from '@routier/postgresql-plugin';
import { MysqlDbPlugin } from '@routier/mysql-plugin';
import { MongoClientDriver, MongoDbPlugin } from '@routier/mongodb-plugin';

/**
 * The vector suite against every backend that needs a real server.
 *
 * The in-process backends run it in their own packages; these four cannot. Together they close
 * the claim that `s.vector()` and `.nearest()` work everywhere, and they are the only place
 * the two PostgreSQL paths can be told apart — same schema, same assertions, one server with
 * pgvector and one without.
 *
 * The cases live in `@routier/test-utils` rather than here. A copy per backend is exactly how
 * two engines end up asserting subtly different things and the disagreement this file exists
 * to catch becomes invisible.
 */

const shouldRun = process.env.E2E_CONTAINERS === '1';
const suite = shouldRun ? describe : describe.skip;

suite('vector search on server-backed stores', () => {

    /** Stock PostgreSQL: no pgvector, so JSONB storage and in-memory scoring. */
    let plainPostgres: StartedPostgreSqlContainer;
    /** The same server with the extension available, so a native column and `<=>`. */
    let vectorPostgres: StartedPostgreSqlContainer;
    let mysql: StartedMySqlContainer;
    let mongo: StartedMongoDBContainer;
    let mongoClient: MongoClient;

    const postgresConfig = (container: StartedPostgreSqlContainer) => ({
        host: container.getHost(),
        port: container.getPort(),
        database: container.getDatabase(),
        user: container.getUsername(),
        password: container.getPassword(),
    });

    // The MySQL container names the same accessor differently.
    const mysqlConfig = () => ({
        host: mysql.getHost(),
        port: mysql.getPort(),
        database: mysql.getDatabase(),
        user: mysql.getUsername(),
        password: mysql.getUserPassword(),
    });

    beforeAll(async () => {
        [plainPostgres, vectorPostgres, mysql, mongo] = await Promise.all([
            new PostgreSqlContainer('postgres:16-alpine').start(),
            new PostgreSqlContainer('pgvector/pgvector:pg16').start(),
            new MySqlContainer('mysql:8').start(),
            new MongoDBContainer('mongo:7').start(),
        ]);

        // `directConnection` is required against a single-node replica set: without it the
        // driver tries to discover other members and never finds a primary.
        mongoClient = new MongoClient(mongo.getConnectionString(), { directConnection: true });
        await mongoClient.connect();
    }, 300_000);

    afterAll(async () => {
        await mongoClient?.close();
        await Promise.all([
            plainPostgres?.stop(),
            vectorPostgres?.stop(),
            mysql?.stop(),
            mongo?.stop(),
        ]);
    });

    describeVectorSearch(
        'PostgreSQL without pgvector (JSONB, scored in memory)',
        () => new PostgresDbPlugin(postgresConfig(plainPostgres)),
    );

    // Full-text search on the server engines. Nothing here uses `tsvector`, `FULLTEXT` or
    // FTS5 — see "Why the engine's own search is out". What each engine DOES contribute is
    // the `IN` that narrows index rows, which is why these run at all.
    describeFullTextSearch(
        'PostgreSQL',
        () => new PostgresDbPlugin(postgresConfig(plainPostgres)),
    );

    describeFullTextSearch(
        'MySQL',
        () => new MysqlDbPlugin(mysqlConfig()),
    );

    describeFullTextSearch(
        'MongoDB',
        () => new MongoDbPlugin(new MongoClientDriver(mongoClient as never, 'routier_search_e2e', { transactions: 'required' })),
        { borrowsConnection: true },
    );


    describeVectorSearch(
        'PostgreSQL with pgvector (native column, pushed down)',
        () => new PostgresDbPlugin(postgresConfig(vectorPostgres)),
    );

    describeVectorSearch(
        'MySQL (JSON, scored in memory)',
        () => new MysqlDbPlugin(mysqlConfig()),
    );

    describeVectorSearch(
        'MongoDB (BSON array, scored in memory)',
        () => new MongoDbPlugin(new MongoClientDriver(mongoClient as never, 'routier_vector_e2e', { transactions: 'required' })),
        // The client is opened here and shared by every plugin, and `MongoDbPlugin.destroy`
        // closes the client it is given. Letting the suite tear stores down would close this
        // one after the first test.
        { borrowsConnection: true },
    );

    it('gives the vector a native column only where pgvector exists', async () => {
        // The behavioural cases above pass either way, which is the point of the feature and
        // also why they cannot tell the two PostgreSQL paths apart. This reads the column type
        // directly, so a regression that quietly stopped pushing anything down — leaving both
        // servers on the JSONB path — fails here rather than passing silently everywhere.
        const columnType = async (container: StartedPostgreSqlContainer) => {
            const { Client } = await import('pg');
            const client = new Client(postgresConfig(container));

            await client.connect();

            try {
                const result = await client.query(
                    `SELECT udt_name FROM information_schema.columns
                     WHERE table_name = $1 AND column_name = 'embedding'`,
                    [vectorContractSchema.collectionName]
                );

                return result.rows[0]?.udt_name;
            } finally {
                await client.end();
            }
        };

        expect(await columnType(plainPostgres)).toBe('jsonb');
        expect(await columnType(vectorPostgres)).toBe('vector');
    }, 60_000);
});
