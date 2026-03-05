import { beforeEach, describe, expect, it } from '@jest/globals';
import { SqlTranslator } from './SqlTranslator';
import { QueryOption, QueryOrdering } from '../query/types';
import { Expression } from '../../expressions/types';

describe('SqlTranslator', () => {
    let translator: SqlTranslator<any, any>;
    let mockQuery: any;

    beforeEach(() => {
        mockQuery = {
            options: {
                has: () => false
            }
        };
        translator = new SqlTranslator(mockQuery);
        (translator as any).query = mockQuery;
    });

    describe('count/min/max/sum shaping', () => {
        it('count returns first row count field for array payloads', () => {
            const option: QueryOption<any, 'count'> = { name: 'count', value: true, target: 'database' };
            const result = translator.count([{ count: 7 }], option);
            expect(result).toBe(7);
        });

        it('count returns payload unchanged when not array payload', () => {
            const option: QueryOption<any, 'count'> = { name: 'count', value: true, target: 'database' };
            expect(translator.count(3, option)).toBe(3);
        });

        it('min/max/sum return first row for array payloads', () => {
            const minOpt: QueryOption<any, 'min'> = { name: 'min', value: true, target: 'database' };
            const maxOpt: QueryOption<any, 'max'> = { name: 'max', value: true, target: 'database' };
            const sumOpt: QueryOption<any, 'sum'> = { name: 'sum', value: true, target: 'database' };

            expect(translator.min([{ value: 1 }], minOpt)).toEqual({ value: 1 });
            expect(translator.max([{ value: 9 }], maxOpt)).toEqual({ value: 9 });
            expect(translator.sum([{ value: 10 }], sumOpt)).toEqual({ value: 10 });
        });
    });

    describe('pass-through operations', () => {
        it('distinct/filter/skip/take/sort return incoming payload', () => {
            const payload = [{ id: 1 }, { id: 2 }];
            const distinctOpt: QueryOption<any, 'distinct'> = { name: 'distinct', value: true, target: 'database' };
            const filterOpt: QueryOption<any, 'filter'> = {
                name: 'filter',
                value: { filter: () => true, params: null, expression: Expression.NOT_PARSABLE },
                target: 'database'
            };
            const skipOpt: QueryOption<any, 'skip'> = { name: 'skip', value: 1, target: 'database' };
            const takeOpt: QueryOption<any, 'take'> = { name: 'take', value: 1, target: 'database' };
            const sortOpt: QueryOption<any, 'sort'> = {
                name: 'sort',
                value: { selector: (x: any) => x.id, direction: QueryOrdering.Ascending, propertyName: 'id' },
                target: 'database'
            };

            expect(translator.distinct(payload, distinctOpt)).toBe(payload);
            expect(translator.filter(payload, filterOpt)).toBe(payload);
            expect(translator.skip(payload, skipOpt)).toBe(payload);
            expect(translator.take(payload, takeOpt)).toBe(payload);
            expect(translator.sort(payload, sortOpt)).toBe(payload);
        });
    });

    describe('map', () => {
        it('maps rows with selector and field-level deserialize hooks', () => {
            const data = [{ id: 1, amount: '10' }, { id: 2, amount: '20' }];
            const property = {
                getValue: (item: any) => item.amount,
                setValue: (item: any, value: unknown) => { item.amount = value; },
                deserialize: (value: unknown) => Number(value),
            };
            const option: QueryOption<any, 'map'> = {
                name: 'map',
                value: {
                    selector: (item: any) => ({ id: item.id, amount: item.amount }),
                    fields: [{ property } as any]
                },
                target: 'database'
            };

            const result = translator.map(data, option);
            expect(result).toEqual([{ id: 1, amount: 10 }, { id: 2, amount: 20 }]);
        });

        it('returns original data for count-only map branch', () => {
            mockQuery.options.has = (name: string) => name === 'count';
            const data = [{ count: 3 }];
            const option: QueryOption<any, 'map'> = {
                name: 'map',
                value: { selector: (item: any) => item.count, fields: [] },
                target: 'database'
            };

            const result = translator.map(data, option);
            expect(result).toBe(data);
        });

        it('throws when data is not an array', () => {
            const option: QueryOption<any, 'map'> = {
                name: 'map',
                value: { selector: (item: any) => item, fields: [] },
                target: 'database'
            };
            expect(() => translator.map({ id: 1 }, option)).toThrow('Can only map an array of data');
        });
    });

    describe('group', () => {
        it('groups rows by selector and maps selected fields', () => {
            const data = [
                { category: 'a', amount: '10' },
                { category: 'a', amount: '20' },
                { category: 'b', amount: '30' }
            ];
            const property = {
                getValue: (item: any) => item.amount,
                setValue: (item: any, value: unknown) => { item.amount = value; },
                deserialize: (value: unknown) => Number(value),
            };
            const option: QueryOption<any, 'group'> = {
                name: 'group',
                value: {
                    selector: (item: any) => item.category,
                    key: {} as any,
                    fields: [{ property } as any]
                },
                target: 'database'
            };

            const result = translator.group<Record<string, Array<{ amount: number }>>>(data, option);
            expect(result.a).toHaveLength(2);
            expect(result.b).toHaveLength(1);
            expect(result.a[0].amount).toBe(10);
        });

        it('throws when group data is not an array', () => {
            const option: QueryOption<any, 'group'> = {
                name: 'group',
                value: { selector: (x: any) => x.id, key: {} as any, fields: [] },
                target: 'database'
            };
            expect(() => translator.group({ id: 1 }, option)).toThrow('Can only group an array of data');
        });
    });
});
