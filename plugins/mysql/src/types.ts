import { SchemaId } from "@routier/core/schema";

export type SqlOperation = { sql: string, params: any[] };
export type SqlPersistOperation = SqlOperation & { createTableSql: string, schemaId: SchemaId };

/**
 * MySQL has no RETURNING, and `mergeChanges` requires the entire inserted document back —
 * so every write operation carries how its rows can be read back after it runs.
 */
export type MysqlSelectBack =
    /** Single numeric AUTO_INCREMENT key: a simple multi-row INSERT allocates a consecutive
     * id block, so the rows are `insertId .. insertId + rowCount - 1`. */
    | { mode: 'insert-id'; rowCount: number }
    /** Every key value is known client-side (caller-supplied keys, or identities this
     * plugin generated): select by `key IN (...)`. */
    | { mode: 'by-key'; ids: unknown[] }
    /** Composite keys: one (col = ? AND ...) conjunction per row. */
    | { mode: 'by-composite-key'; keyTuples: Record<string, unknown>[] };

export type MysqlAddsOperation = SqlOperation & { selectBack: MysqlSelectBack };
export type MysqlUpdatesOperation = SqlOperation & { ids: unknown[] };
/** The echo must be read BEFORE the delete runs; selectSql shares the delete's params. */
export type MysqlRemovesOperation = SqlOperation & { selectSql: string };
