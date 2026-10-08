import { reportUnrenderableFilters, reportUnrenderableSelectors, toSql } from '@routier/sql-plugin-core';
import { logger, type Expression } from '@routier/core';
import type { IQuery, ResultColumn } from '@routier/core/plugins';
import { buildFromQueryOperation } from './utils';
import type { SqlOperation } from './types';

export type SqlCacheMode = 'off' | 'shadow' | 'on';

export const SQL_FRAME_CACHE_MAX = 256;

type Frame = { before: string; after: string; result: readonly ResultColumn[] | undefined };

type Where = { section: string; params: SqlOperation['params'] };

type Build = <TEntity extends {}, TShape>(query: IQuery<TEntity, TShape>) => SqlOperation;

const fingerprintOf = <TEntity extends {}, TShape>({ options }: IQuery<TEntity, TShape>): string => JSON.stringify([
    [...options.items].flatMap(([name, items]) => items.map(({ index, option }) => [name, index, option.target, option.reason])),
    options.get('sort').map(({ index, option }) => [index, option.value.propertyName, option.value.direction]),
    options.get('skip').map(({ index, option }) => [index, option.value]),
    options.get('take').map(({ index, option }) => [index, option.value]),
    options.get('map').map(({ index, option }) => [index, option.value.fields.map(field => [field.sourceName, field.destinationName])]),
]);

const filtersOf = <TEntity extends {}, TShape>({ options }: IQuery<TEntity, TShape>): Expression[] =>
    options.get('filter')
        .filter(({ option }) => option.reason === 'executed')
        .map(({ option }) => option.value.expression);

const whereOf = (filters: readonly Expression[]): Where => {
    const clauses: string[] = [];
    const params: SqlOperation['params'] = [];

    for (const filter of filters) {
        const { where, params: filterParams } = toSql(filter, 'sqlite');
        clauses.push(where);
        params.push(...filterParams);
    }

    return { section: clauses.length === 0 ? '' : ` WHERE ${clauses.join(' AND ')}`, params };
};

const frameOf = (operation: SqlOperation, where: Where): Frame | null => {
    const at = operation.sql.indexOf(where.section);

    if (at === -1) {
        return null;
    }

    return {
        before: operation.sql.slice(0, at),
        after: operation.sql.slice(at + where.section.length),
        result: operation.result,
    };
};

const fill = (frame: Frame, where: Where): SqlOperation => ({
    sql: frame.before + where.section + frame.after,
    params: where.params,
    result: frame.result,
});

const columnsMatch = (a: readonly ResultColumn[], b: readonly ResultColumn[]): boolean =>
    a.every((column, i) => {
        const other = b[i];
        return other !== undefined && column.name === other.name && column.property === other.property;
    });

const sameResult = (a: readonly ResultColumn[] | undefined, b: readonly ResultColumn[] | undefined): boolean =>
    a === b || (a !== undefined && b !== undefined && columnsMatch(a, b) && columnsMatch(b, a));

const sameOperation = (a: SqlOperation, b: SqlOperation): boolean =>
    a.sql === b.sql
    && a.params.length === b.params.length
    && a.params.every((param, i) => Object.is(param, b.params[i]))
    && sameResult(a.result, b.result);

export class SqlFrameCache {
    private readonly frames = new WeakMap<object, Map<string, Frame>>();

    constructor(private readonly mode: SqlCacheMode, private readonly build: Build = buildFromQueryOperation) { }

    operationFor<TEntity extends {}, TShape>(query: IQuery<TEntity, TShape>): SqlOperation {
        if (this.mode === 'off') {
            return this.build(query);
        }

        reportUnrenderableFilters(query.options, 'sqlite');
        reportUnrenderableSelectors(query.options);

        const frames = this.framesFor(query.schema);
        const fingerprint = fingerprintOf(query);
        const frame = frames.get(fingerprint);
        const where = whereOf(filtersOf(query));

        if (frame === undefined) {
            return this.learn(query, frames, fingerprint, where);
        }

        const cached = fill(frame, where);

        if (this.mode === 'on') {
            return cached;
        }

        const fresh = this.build(query);

        if (!sameOperation(cached, fresh)) {
            frames.delete(fingerprint);
            logger.warn(`SQL frame cache mismatch for fingerprint ${fingerprint}. Cached: ${cached.sql} Fresh: ${fresh.sql}`);
        }

        return fresh;
    }

    private framesFor(schema: object): Map<string, Frame> {
        let frames = this.frames.get(schema);

        if (frames === undefined) {
            frames = new Map();
            this.frames.set(schema, frames);
        }

        return frames;
    }

    private learn<TEntity extends {}, TShape>(query: IQuery<TEntity, TShape>, frames: Map<string, Frame>, fingerprint: string, where: Where): SqlOperation {
        const fresh = this.build(query);
        const frame = frameOf(fresh, where);

        if (frame !== null) {
            frames.set(fingerprint, frame);

            if (frames.size > SQL_FRAME_CACHE_MAX) {
                const [oldest] = frames.keys();
                frames.delete(oldest);
            }
        }

        return fresh;
    }
}
