import { SchemaId } from "@routier/core/schema";

export type SqlOperation = {
    sql: string,
    params: any[],
    /** Present on a token-checked UPDATE: zero affected rows means a concurrency conflict on this row. */
    conflictCheck?: { id: unknown },
};
export type SqlPersistOperation = SqlOperation & { createTableSql: string, schemaId: SchemaId, };