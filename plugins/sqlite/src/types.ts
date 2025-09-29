import { SchemaId } from "@routier/core/schema";

export type SqlOperation = { sql: string, params: any[] };
export type SqlPersistOperation = SqlOperation & { createTableSql: string, schemaId: SchemaId, };