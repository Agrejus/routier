import { SchemaId } from "@routier/core/schema";
import { ResultColumn } from "@routier/core/plugins";

export type SqlOperation = {
    sql: string,
    params: any[],
    /** Present on a token-checked UPDATE: zero affected rows means a concurrency conflict on this row. */
    conflictCheck?: { id: unknown },
    /**
     * The columns this statement returns, in order, described beside the select list that emits
     * them — never parsed back out of the SQL.
     *
     * A DESCRIPTION, not an instruction. What a driver does with it is the driver's business: one
     * that crosses a worker boundary turns it into a transfer plan with `buildTransferPlan`, and
     * every other driver ignores it.
     *
     * Absent when the statement's result cannot be described — an aggregate replaces the select
     * list, so the columns projected are not the columns returned.
     */
    result?: readonly ResultColumn[],
};
export type SqlPersistOperation = SqlOperation & { createTableSql: string, schemaId: SchemaId, };