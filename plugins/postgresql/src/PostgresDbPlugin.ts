import { Pool } from 'pg';
import { decodeJsonColumns } from '@routier/sql-plugin-core';
import { OptimisticConcurrencyError } from '@routier/core';
import { buildFromPersistOperation, buildFromQueryOperation, compiledSchemaToPostgresTable, NO_VECTOR_SUPPORT, PostgresVectorSupport } from './utils';
import { DbPluginBulkPersistEvent, DbPluginEvent, DbPluginQueryEvent, IDbPlugin, ITranslatedValue } from '@routier/core/plugins';
import { PostgresSqlTranslator } from './PostgresSqlTranslator';
import { CallbackResult, PluginEventCallbackPartialResult, PluginEventCallbackResult, PluginEventResult, Result } from '@routier/core/results';
import { BulkPersistResult } from '@routier/core/collections';
import { CompiledSchema } from '@routier/core/schema';
import { logger } from '@routier/core/utilities';
import { SqlOperation, SqlPersistOperation } from './types';

export interface PostgresDbPluginConfig {
    host?: string;
    port?: number;
    database: string;
    user?: string;
    password?: string;
    connectionString?: string;
    pool?: {
        min?: number;
        max?: number;
    };
}

export class PostgresDbPlugin implements IDbPlugin {

    private pool: Pool;
    private tableCache: Record<string, string> = {};
    /** Resolved once per plugin instance; see `resolveVectorSupport`. */
    private vectorProbe: Promise<PostgresVectorSupport> | null = null;

    constructor(config: PostgresDbPluginConfig) {
        this.pool = new Pool({
            host: config.host || 'localhost',
            port: config.port || 5432,
            database: config.database,
            user: config.user,
            password: config.password,
            connectionString: config.connectionString,
            min: config.pool?.min || 2,
            max: config.pool?.max || 10,
        });

        // An idle client losing its connection (server restart/shutdown) emits 'error'
        // on the pool; without a handler that is an unhandled error that kills the
        // process. The pool discards the dead client and creates a new one on demand
        this.pool.on('error', (err) => {
            logger.warn('[DB] PostgreSQL pool error on idle client', { error: err });
        });
    }

    private resolveSchema<TEntity extends {}>(schema: CompiledSchema<TEntity>, vectors: PostgresVectorSupport) {
        if (this.tableCache[schema.collectionName] == null) {
            this.tableCache[schema.collectionName] = compiledSchemaToPostgresTable(schema, undefined, vectors);
        }
    }

    /**
     * Whether this server can store and search a `vector` column, asked once and reused.
     *
     * A schema with `s.vector()` works either way — without the extension the numbers go into
     * JSONB and the similarity search runs in memory. So this decides how FAST the feature is,
     * never whether it is available, and a probe that fails for any reason at all correctly
     * lands on the path that always works.
     *
     * Two ways to have it: already installed, or installable by this connection. The second
     * needs privileges an application role often lacks, which is why a failure here is
     * ordinary rather than exceptional and is not logged as an error.
     *
     * The promise is cached rather than the value, so concurrent first queries share one
     * probe instead of racing to create the extension.
     *
     * **This is decided per plugin instance, and the DDL it produces is permanent.** A table
     * created as JSONB keeps that column type after the extension is installed later — SQL
     * plugins here do not migrate. Installing pgvector against existing data is a migration,
     * and it has to be done as one.
     */
    private resolveVectorSupport(): Promise<PostgresVectorSupport> {
        if (this.vectorProbe != null) {
            return this.vectorProbe;
        }

        this.vectorProbe = this.pool
            .query(`SELECT 1 FROM pg_extension WHERE extname = 'vector'`)
            .then(installed => {
                if (installed.rowCount != null && installed.rowCount > 0) {
                    return { available: true };
                }

                return this.pool
                    .query('CREATE EXTENSION IF NOT EXISTS vector')
                    .then(() => ({ available: true }))
                    .catch(() => NO_VECTOR_SUPPORT);
            })
            .catch(() => NO_VECTOR_SUPPORT);

        return this.vectorProbe;
    }

    query<TRoot extends {}, TShape extends any = TRoot>(event: DbPluginQueryEvent<TRoot, TShape>, done: PluginEventCallbackResult<ITranslatedValue<TShape>>): void {
        this.resolveVectorSupport().then(vectors => {
            this.resolveSchema(event.operation.schema, vectors);

            // Built once, here, and handed down. The builder decides whether the search made
            // it into the SQL, and the translator has to be told the SAME answer — building
            // twice would let the statement and the decision about it drift apart.
            const built = buildFromQueryOperation(event.operation, vectors);
            const translator = new PostgresSqlTranslator(event.operation, built.nearestPushedDown);

            this._doQueryWork<TRoot, TShape>(event, built, vectors, (result) => {
                if (result.ok === "error") {
                    done(PluginEventResult.error(event.id, result.error));
                    return;
                }

                // Nested objects and arrays are stored as JSON columns (see
                // toColumnAssignments); decode them before translation so the entity gets a
                // structure back rather than a JSON string. Skips properties whose schema
                // does its own deserialization.
                const decoded = decodeJsonColumns(result.data, event.operation.schema);
                const data = translator.translate(decoded);

                done(PluginEventResult.success(event.id, data));
            });
        });
    }

    destroy(event: DbPluginEvent, done: PluginEventCallbackResult<never>): void {
        this.pool.end()
            .then(() => {
                done(PluginEventResult.success(event.id));
            })
            .catch((err) => {
                done(PluginEventResult.error(event.id, err));
            });
    }

    bulkPersist(event: DbPluginBulkPersistEvent, done: PluginEventCallbackPartialResult<BulkPersistResult>) {
        // The probe gates the write too, not just the read: it decides the column type this
        // table is created with, and a table created before the answer is known would get
        // JSONB on a server that could have given it a real vector column.
        this.resolveVectorSupport().then(vectors => {
            this._doPersistWork(event, vectors, (result) => {
                if (result.ok === "error") {
                    done(PluginEventResult.error(event.id, result.error));
                    return;
                }

                done(PluginEventResult.success(event.id, result.data));
            });
        });
    }

    private resolveTableCreateStatement(schema: CompiledSchema<unknown>, vectors: PostgresVectorSupport): string {
        const collectionName = schema.collectionName;
        if (this.tableCache[collectionName]) {
            return this.tableCache[collectionName];
        }

        const createTableSQL = compiledSchemaToPostgresTable(schema, undefined, vectors);
        this.tableCache[collectionName] = createTableSQL;

        return createTableSQL;
    }

    private _doPersistWork(
        event: DbPluginBulkPersistEvent,
        vectors: PostgresVectorSupport,
        done: CallbackResult<BulkPersistResult>
    ): void {
        this.pool.connect((err, client, release) => {
            if (err) {
                return done(Result.error(err));
            }

            const result = event.operation.toResult();

            // Flattened: one entry per operation, removes before updates before adds within
            // a schema, so a save mixing all three applies all three (grouping them and
            // executing only one per group silently dropped the rest)
            const operations: { op: SqlPersistOperation, type: 'adds' | 'updates' | 'removes' }[] = [];

            for (const [schemaId, changes] of event.operation) {
                if (!changes || changes.hasItems === false) {
                    continue;
                }

                const schema = event.schemas.get(schemaId);
                const persistOperations = buildFromPersistOperation(schema, changes);
                const createTableSql = this.resolveTableCreateStatement(schema, vectors);

                if (persistOperations.removes != null) {
                    operations.push({ op: { ...persistOperations.removes, createTableSql, schemaId }, type: 'removes' });
                }

                // One operation PER GROUP: PostgreSQL permits exactly one command per
                // parameterized statement, so heterogeneous update batches cannot be
                // joined with ';' — each group runs as its own query in the transaction.
                for (const updateOperation of persistOperations.updates) {
                    operations.push({ op: { ...updateOperation, createTableSql, schemaId }, type: 'updates' });
                }

                if (persistOperations.adds != null) {
                    operations.push({ op: { ...persistOperations.adds, createTableSql, schemaId }, type: 'adds' });
                }
            }

            // Begin transaction
            client.query('BEGIN', (beginErr) => {
                if (beginErr) {
                    release();
                    return done(Result.error(beginErr));
                }

                const executeNext = (index: number) => {
                    if (index >= operations.length) {
                        // All operations completed, commit
                        client.query('COMMIT', (commitErr) => {
                            if (commitErr) {
                                client.query('ROLLBACK', () => {
                                    release();
                                    done(Result.error(commitErr));
                                });
                                return;
                            }
                            release();
                            done(Result.success(result));
                        });
                        return;
                    }

                    const executeOperation = (op: SqlPersistOperation, type: 'adds' | 'updates' | 'removes') => {
                        // SQL text only. Parameter VALUES are row data — names, emails,
                        // tokens, anything the caller stored — and a plugin must not put
                        // them on stdout. The count is enough to diagnose a binding
                        // mismatch, which is what these logs were actually for.
                        logger.debug(`[DB] PostgreSQL ${type} operation:`, {
                            sql: op.sql,
                            paramsCount: (op.params || []).length,
                            schemaId: op.schemaId,
                        });

                        const fail = (error: unknown) => {
                            client.query('ROLLBACK', () => {
                                release();
                                done(Result.error(error));
                            });
                        };

                        // Nested objects and arrays come back from RETURNING as JSON —
                        // decode before the rows are echoed to mergeChanges, or the entity
                        // is handed a string where a structure belongs. Same rule as the
                        // query path; skips properties whose schema deserializes itself.
                        const collectRows = (rows: unknown[]) => {
                            const schema = event.schemas.get(op.schemaId);
                            const decoded = decodeJsonColumns(rows, schema) as { [x: string]: never; }[];
                            const bucket = result.get(op.schemaId);

                            if (type === "adds") {
                                bucket.adds.push(...decoded);
                            }

                            if (type === "updates") {
                                bucket.updates.push(...decoded);
                            }

                            if (type === "removes") {
                                bucket.removes.push(...decoded);
                            }
                        };

                        // A token-checked UPDATE that matched no row lost the race:
                        // another writer changed the row after this one read it. The
                        // transaction rolls back and the conflict names the row.
                        const conflictOn = (rows: unknown[]) => {
                            if (op.conflictCheck == null || rows.length > 0) {
                                return false;
                            }

                            fail(new OptimisticConcurrencyError(
                                event.schemas.get(op.schemaId).collectionName,
                                [op.conflictCheck.id as never]
                            ));

                            return true;
                        };

                        const retryWrite = () => {
                            logger.debug(`[DB] PostgreSQL ${type} retry after table creation:`, {
                                sql: op.sql,
                                paramsCount: (op.params || []).length,
                            });
                            client.query(op.sql, op.params || [], (retryErr, retryResult) => {
                                if (retryErr) {
                                    fail(retryErr);
                                    return;
                                }

                                if (conflictOn(retryResult.rows)) {
                                    return;
                                }

                                collectRows(retryResult.rows);
                                executeNext(index + 1);
                            });
                        };

                        // PostgreSQL aborts the whole transaction on the first error, so the
                        // create-table-on-demand recovery below can only work if the failed
                        // write is rolled back to a savepoint first. Without it, the CREATE
                        // TABLE runs inside an aborted transaction and fails with 25P02.
                        const savepoint = `sp_${index}_${type}`;

                        client.query(`SAVEPOINT ${savepoint}`, (savepointErr) => {
                            if (savepointErr) {
                                fail(savepointErr);
                                return;
                            }

                            client.query(op.sql, op.params || [], (err, queryResult) => {
                                // 42P01 undefined_table — by code, not message text
                                if (err && (err as { code?: string }).code === '42P01') {
                                    // Table doesn't exist: roll back the failed write, then
                                    // create the table and retry inside the same transaction
                                    client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`, (rollbackToErr) => {
                                        if (rollbackToErr) {
                                            fail(rollbackToErr);
                                            return;
                                        }

                                        // The DDL gets its own savepoint: CREATE TABLE IF NOT
                                        // EXISTS is not atomic against a concurrent creator,
                                        // and a failed create with no savepoint would abort
                                        // the whole transaction with no way back.
                                        const ddlSavepoint = `${savepoint}_ddl`;

                                        client.query(`SAVEPOINT ${ddlSavepoint}`, (ddlSavepointErr) => {
                                            if (ddlSavepointErr) {
                                                fail(ddlSavepointErr);
                                                return;
                                            }

                                            client.query(op.createTableSql, (createErr) => {
                                                if (createErr == null) {
                                                    retryWrite();
                                                    return;
                                                }

                                                // Two connections creating the same table at
                                                // once collide in the system catalog even with
                                                // IF NOT EXISTS: 23505 on
                                                // pg_type_typname_nsp_index, or 42P07
                                                // duplicate_table. Either way the other
                                                // connection won and the table exists — roll
                                                // back the DDL and retry the write.
                                                const code = (createErr as { code?: string }).code;

                                                if (code === '23505' || code === '42P07') {
                                                    client.query(`ROLLBACK TO SAVEPOINT ${ddlSavepoint}`, (ddlRollbackErr) => {
                                                        if (ddlRollbackErr) {
                                                            fail(ddlRollbackErr);
                                                            return;
                                                        }

                                                        retryWrite();
                                                    });
                                                    return;
                                                }

                                                fail(createErr);
                                            });
                                        });
                                    });
                                } else if (err) {
                                    // Other error, rollback
                                    fail(err);
                                } else {
                                    if (conflictOn(queryResult.rows)) {
                                        return;
                                    }

                                    // Success, continue to next operation
                                    collectRows(queryResult.rows);
                                    executeNext(index + 1);
                                }
                            });
                        });
                    };

                    executeOperation(operations[index].op, operations[index].type);
                };

                // Start executing operations
                executeNext(0);
            });
        });
    }

    private _doQueryWork<TRoot extends {}, TShape extends any = TRoot>(
        event: DbPluginQueryEvent<TRoot, TShape>,
        built: SqlOperation,
        vectors: PostgresVectorSupport,
        done: CallbackResult<TShape>
    ) {
        this.pool.connect((err, client, release) => {
            if (err) {
                const nodeErr = err as NodeJS.ErrnoException;
                const isConnectionError = nodeErr.message?.includes('ECONNREFUSED') || 
                                         nodeErr.message?.includes('connect') ||
                                         nodeErr.code === 'ECONNREFUSED';
                
                if (isConnectionError) {
                    // The pg error carries everything a reader needs. Host, port, database
                    // and user are deployment topology and were being written to stdout on
                    // every failed connection — dropped, not downgraded.
                    logger.error('[DB] PostgreSQL connection error:', {
                        code: nodeErr.code,
                        message: nodeErr.message,
                    });
                }
                return done(Result.error(err));
            }

            const createTableSQL = this.resolveTableCreateStatement(event.operation.schema, vectors);
            const { params, sql } = built;

            logger.debug('[DB] PostgreSQL query:', {
                sql,
                paramsCount: (params || []).length,
                table: event.operation.schema.collectionName,
            });

            client.query(sql, params || [], (queryErr, queryResult) => {
                if (queryErr && (queryErr as { code?: string }).code === '42P01') {
                    // Table doesn't exist, create it and retry
                    client.query(createTableSQL, (createErr) => {
                        if (createErr) {
                            release();
                            return done(Result.error(createErr));
                        }

                        // Retry the SELECT after table creation
                        logger.debug('[DB] PostgreSQL query retry after table creation:', {
                            sql,
                            paramsCount: (params || []).length,
                        });
                        client.query(sql, params || [], (retryErr, retryResult) => {
                            release();
                            if (retryErr) {
                                return done(Result.error(retryErr));
                            }
                            done(Result.success(retryResult.rows as TShape));
                        });
                    });
                } else {
                    release();
                    if (queryErr) {
                        done(Result.error(queryErr));
                    } else {
                        done(Result.success(queryResult.rows as TShape));
                    }
                }
            });
        });
    }
}
