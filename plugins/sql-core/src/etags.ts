import { nextEtagToken } from '@routier/core/collections';
import { CompiledSchema, EtagMode, SchemaTypes } from '@routier/core/schema';
import type { SqlDialect } from './sql';

export type SqlEtag =
    | { kind: 'increment'; column: string }
    | { kind: 'value'; column: string; valueOf: (entity: Record<string, unknown>) => unknown };

export function sqlEtagOf<T extends {}>(schema: CompiledSchema<T>, mode: EtagMode | undefined): SqlEtag | null {
    const property = schema.etagProperty;

    if (property == null) {
        return null;
    }

    const column = property.getResolvedName();

    if (mode === 'keep') {
        return { kind: 'value', column, valueOf: entity => entity[column] };
    }

    return property.type === SchemaTypes.Number
        ? { kind: 'increment', column }
        : { kind: 'value', column, valueOf: () => nextEtagToken() };
}

export function withEtagValue(resolved: Map<string, unknown>, entity: Record<string, unknown>, etag: SqlEtag | null): Map<string, unknown> {
    if (etag == null) {
        return resolved;
    }

    const columns = new Map(resolved);
    columns.delete(etag.column);

    if (etag.kind === 'value') {
        columns.set(etag.column, etag.valueOf(entity));
    }

    return columns;
}

export function etagIncrementClauses(etag: SqlEtag | null, dialect: SqlDialect): string[] {
    if (etag?.kind !== 'increment') {
        return [];
    }

    const column = dialect.quoteIdentifier(etag.column);
    return [`${column} = COALESCE(${column}, 0) + 1`];
}
