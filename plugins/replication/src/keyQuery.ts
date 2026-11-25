import { ComparatorExpression, OperatorExpression, PropertyExpression, ValueExpression, type Expression } from '@routier/core/expressions';
import { Query, QueryOptionsCollection, type IDbPlugin } from '@routier/core/plugins';
import { SchemaCollection } from '@routier/core/collections';
import { Result } from '@routier/core/results';
import type { CompiledSchema } from '@routier/core/schema';
import { uuid, type UnknownRecord } from '@routier/core/utilities';

type Schema = CompiledSchema<UnknownRecord>;

const isRecord = <TValue>(value: TValue): value is TValue & UnknownRecord =>
    typeof value === 'object' && value !== null && Array.isArray(value) === false;

const keysOf = (schema: Schema, row: UnknownRecord) =>
    schema.idProperties.map(property => ({ property, value: row[property.getResolvedName()] }));

const rowExpression = (schema: Schema, row: UnknownRecord): Expression => keysOf(schema, row)
    .map(({ property, value }): Expression => new ComparatorExpression({
        comparator: 'equals',
        negated: false,
        strict: true,
        left: new PropertyExpression({ property }),
        right: new ValueExpression({ value }),
    }))
    .reduce((left, right) => new OperatorExpression({ operator: '&&', left, right }));

/** A filter that matches the rows with the same keys as any of `rows`. */
export const keyFilter = (schema: Schema, rows: readonly UnknownRecord[]): QueryOptionsCollection<UnknownRecord> => {
    const options = QueryOptionsCollection.EMPTY<UnknownRecord>();
    const wanted = rows.map(row => keysOf(schema, row));

    options.add('filter', {
        filter: (candidate: UnknownRecord) => wanted.some(keys => keys.every(({ property, value }) => candidate[property.getResolvedName()] === value)),
        expression: rows.map(row => rowExpression(schema, row)).reduce((left, right) => new OperatorExpression({ operator: '||', left, right })),
        params: undefined,
    });

    return options;
};

/** Reads the rows of `schema` with the same keys as `rows`, through `plugin`. */
export const queryByKeys = (plugin: IDbPlugin, schemas: SchemaCollection | null, schema: Schema, rows: readonly UnknownRecord[], source: string): Promise<UnknownRecord[]> =>
    new Promise((resolve, reject) => {
        plugin.query({
            id: uuid(8),
            schemas: schemas ?? new SchemaCollection(),
            source,
            action: 'query',
            explain: false,
            executedQueries: [],
            operation: new Query<UnknownRecord, UnknownRecord>(keyFilter(schema, rows), schema),
        }, result => {
            if (result.ok === Result.ERROR) {
                reject(result.error);
                return;
            }

            const found: UnknownRecord[] = [];

            result.data.forEach(row => {
                if (isRecord(row)) {
                    found.push(row);
                }
            });

            resolve(found);
        });
    });
