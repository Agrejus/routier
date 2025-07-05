import { describe, it, expect, beforeEach } from 'vitest';
import { JsonTranslator } from './JsonTranslator';
import { QueryOption, QueryOrdering } from '../query/types';
import { Filter, ParamsFilter } from '../../expressions/types';
import { Expression } from '../../expressions/types';

describe('JsonTranslator', () => {
    let translator: JsonTranslator<any, any>;
    let mockQuery: any;

    beforeEach(() => {
        mockQuery = {
            options: {
                getLast: () => null as any
            }
        };
        translator = new JsonTranslator(mockQuery);
        (translator as any).query = mockQuery;
    });

    describe('filter', () => {
        it('should return data unchanged when no filter is provided', () => {
            const data = [{ id: 1, name: 'test' }];
            const option: QueryOption<any, 'filter'> = {
                name: 'filter',
                value: { filter: null, params: null, expression: Expression.NOT_PARSABLE },
                target: 'memory'
            };

            const result = translator.filter(data, option);

            expect(result).toEqual(data);
        });

        it('should apply standard filter function', () => {
            const data = [
                { id: 1, name: 'test1' },
                { id: 2, name: 'test2' },
                { id: 3, name: 'other' }
            ];
            const filter: Filter<any> = (item: any): boolean => item.name.startsWith('test');
            const option: QueryOption<any, 'filter'> = {
                name: 'filter',
                value: { filter, params: null, expression: Expression.NOT_PARSABLE },
                target: 'memory'
            };

            const result = translator.filter(data, option) as any;

            expect(result).toHaveLength(2);
            expect(result[0].name).toBe('test1');
            expect(result[1].name).toBe('test2');
        });

        it('should apply parameterized filter function', () => {
            const data = [
                { id: 1, name: 'test1' },
                { id: 2, name: 'test2' },
                { id: 3, name: 'other' }
            ];
            const filter: ParamsFilter<any, { searchTerm: string }> = (payload: [any, { searchTerm: string }]): boolean => {
                const [item, params] = payload;
                return item.name.includes(params.searchTerm);
            };
            const option: QueryOption<any, 'filter'> = {
                name: 'filter',
                value: { filter, params: { searchTerm: 'test' }, expression: Expression.NOT_PARSABLE },
                target: 'memory'
            };

            const result = translator.filter(data, option) as any;

            expect(result).toHaveLength(2);
            expect(result[0].name).toBe('test1');
            expect(result[1].name).toBe('test2');
        });

        it('should throw error when data is not an array', () => {
            const data = { id: 1, name: 'test' };
            const option: QueryOption<any, 'filter'> = {
                name: 'filter',
                value: { filter: null, params: null, expression: Expression.NOT_PARSABLE },
                target: 'memory'
            };

            expect(() => translator.filter(data, option)).toThrow();
        });
    });

    describe('map', () => {
        it('should map array data using selector function', () => {
            const data = [
                { id: 1, name: 'test1' },
                { id: 2, name: 'test2' }
            ];
            const selector = (item: any) => ({ id: item.id, mappedName: item.name });
            const option: QueryOption<any, 'map'> = {
                name: 'map',
                value: { selector, fields: [] },
                target: 'memory'
            };

            const result = translator.map(data, option);

            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({ id: 1, mappedName: 'test1' });
            expect(result[1]).toEqual({ id: 2, mappedName: 'test2' });
        });

        it('should throw error when data is not an array', () => {
            const data = { id: 1, name: 'test' };
            const selector = (item: any) => item.name;
            const option: QueryOption<any, 'map'> = {
                name: 'map',
                value: { selector, fields: [] },
                target: 'memory'
            };

            expect(() => translator.map(data, option)).toThrow('Can only map an array of data');
        });
    });

    describe('count', () => {
        it('should return array length', () => {
            const data = [{ id: 1 }, { id: 2 }, { id: 3 }];
            const option: QueryOption<any, 'count'> = {
                name: 'count',
                value: true,
                target: 'memory'
            };

            const result = translator.count(data, option);

            expect(result).toBe(3);
        });

        it('should return 0 for empty array', () => {
            const data: any[] = [];
            const option: QueryOption<any, 'count'> = {
                name: 'count',
                value: true,
                target: 'memory'
            };

            const result = translator.count(data, option);

            expect(result).toBe(0);
        });

        it('should throw error when data is not an array', () => {
            const data = { id: 1, name: 'test' };
            const option: QueryOption<any, 'count'> = {
                name: 'count',
                value: true,
                target: 'memory'
            };

            expect(() => translator.count(data, option)).toThrow('Cannot count resulting data, it must be an array');
        });
    });

    describe('min', () => {
        it('should return minimum number from array', () => {
            const data = [5, 2, 8, 1, 9];
            const option: QueryOption<any, 'min'> = {
                name: 'min',
                value: true,
                target: 'memory'
            };

            const result = translator.min(data, option);

            expect(result).toBe(1);
        });

        it('should return minimum string from array', () => {
            const data = ['zebra', 'apple', 'banana'];
            const option: QueryOption<any, 'min'> = {
                name: 'min',
                value: true,
                target: 'memory'
            };

            const result = translator.min(data, option);

            expect(result).toBe('zebra');
        });

        it('should return minimum date from array', () => {
            const date1 = new Date('2023-01-01');
            const date2 = new Date('2023-01-02');
            const date3 = new Date('2022-12-31');
            const data = [date1, date2, date3];
            const option: QueryOption<any, 'min'> = {
                name: 'min',
                value: true,
                target: 'memory'
            };

            const result = translator.min(data, option);

            expect(result).toBe(date3);
        });

        it('should throw error when data is not an array', () => {
            const data = 5;
            const option: QueryOption<any, 'min'> = {
                name: 'min',
                value: true,
                target: 'memory'
            };

            expect(() => translator.min(data, option)).toThrow();
        });
    });

    describe('max', () => {
        it('should return maximum number from array', () => {
            const data = [5, 2, 8, 1, 9];
            const option: QueryOption<any, 'max'> = {
                name: 'max',
                value: true,
                target: 'memory'
            };

            const result = translator.max(data, option);

            expect(result).toBe(9);
        });

        it('should return maximum string from array', () => {
            const data = ['zebra', 'apple', 'banana'];
            const option: QueryOption<any, 'max'> = {
                name: 'max',
                value: true,
                target: 'memory'
            };

            const result = translator.max(data, option);

            expect(result).toBe('zebra');
        });

        it('should return maximum date from array', () => {
            const date1 = new Date('2023-01-01');
            const date2 = new Date('2023-01-02');
            const date3 = new Date('2022-12-31');
            const data = [date1, date2, date3];
            const option: QueryOption<any, 'max'> = {
                name: 'max',
                value: true,
                target: 'memory'
            };

            const result = translator.max(data, option);

            expect(result).toBe(date2);
        });
    });

    describe('sort', () => {
        it('should sort array in ascending order', () => {
            const data = [3, 1, 4, 1, 5];
            const selector = (item: number) => item;
            const option: QueryOption<any, 'sort'> = {
                name: 'sort',
                value: { selector, direction: QueryOrdering.Ascending, propertyName: 'value' },
                target: 'memory'
            };

            const result = translator.sort(data, option);

            expect(result).toEqual([1, 1, 3, 4, 5]);
        });

        it('should sort array in descending order', () => {
            const data = [3, 1, 4, 1, 5];
            const selector = (item: number) => item;
            const option: QueryOption<any, 'sort'> = {
                name: 'sort',
                value: { selector, direction: QueryOrdering.Descending, propertyName: 'value' },
                target: 'memory'
            };

            const result = translator.sort(data, option);

            expect(result).toEqual([5, 4, 3, 1, 1]);
        });

        it('should sort objects by property in ascending order', () => {
            const data = [
                { id: 3, name: 'c' },
                { id: 1, name: 'a' },
                { id: 2, name: 'b' }
            ];
            const selector = (item: any) => item.id;
            const option: QueryOption<any, 'sort'> = {
                name: 'sort',
                value: { selector, direction: QueryOrdering.Ascending, propertyName: 'id' },
                target: 'memory'
            };

            const result = translator.sort(data, option);

            expect(result).toEqual([
                { id: 1, name: 'a' },
                { id: 2, name: 'b' },
                { id: 3, name: 'c' }
            ]);
        });

        it('should return data unchanged when not an array', () => {
            const data = { id: 1, name: 'test' };
            const selector = (item: any) => item.id;
            const option: QueryOption<any, 'sort'> = {
                name: 'sort',
                value: { selector, direction: QueryOrdering.Ascending, propertyName: 'id' },
                target: 'memory'
            };

            const result = translator.sort(data, option);

            expect(result).toBe(data);
        });
    });

    describe('sum', () => {
        beforeEach(() => {
            mockQuery.options.getLast = () => ({
                name: 'map',
                value: {
                    fields: [{ sourceName: 'value' }]
                }
            });
        });

        it('should sum array of numbers', () => {
            const data = [1, 2, 3, 4, 5];
            const option: QueryOption<any, 'sum'> = {
                name: 'sum',
                value: true,
                target: 'memory'
            };

            const result = translator.sum(data, option);

            expect(result).toBe(15);
        });

        it('should return 0 for empty array', () => {
            const data: number[] = [];
            const option: QueryOption<any, 'sum'> = {
                name: 'sum',
                value: true,
                target: 'memory'
            };

            const result = translator.sum(data, option);

            expect(result).toBe(0);
        });

        it('should throw error when data is not an array', () => {
            const data = 5;
            const option: QueryOption<any, 'sum'> = {
                name: 'sum',
                value: true,
                target: 'memory'
            };

            expect(() => translator.sum(data, option)).toThrow();
        });

        it('should throw error when array contains non-numbers', () => {
            const data = [1, 2, 'three', 4];
            const option: QueryOption<any, 'sum'> = {
                name: 'sum',
                value: true,
                target: 'memory'
            };

            expect(() => translator.sum(data, option)).toThrow('Cannot sum, property is not a number');
        });

        it('should throw error when no map option is found', () => {
            mockQuery.options.getLast = () => null as any;
            const data = [1, 2, 3];
            const option: QueryOption<any, 'sum'> = {
                name: 'sum',
                value: true,
                target: 'memory'
            };

            expect(() => translator.sum(data, option)).toThrow('sum() operation can only be performed when one field is mapped');
        });

        it('should throw error when multiple fields are mapped', () => {
            mockQuery.options.getLast = () => ({
                name: 'map',
                value: {
                    fields: [{ sourceName: 'value1' }, { sourceName: 'value2' }]
                }
            });
            const data = [1, 2, 3];
            const option: QueryOption<any, 'sum'> = {
                name: 'sum',
                value: true,
                target: 'memory'
            };

            expect(() => translator.sum(data, option)).toThrow('sum() operation can only be performed when one field is mapped');
        });
    });

    describe('distinct', () => {
        it('should return unique numbers', () => {
            const data = [1, 2, 2, 3, 1, 4];
            const option: QueryOption<any, 'distinct'> = {
                name: 'distinct',
                value: true,
                target: 'memory'
            };

            const result = translator.distinct(data, option);

            expect(result).toEqual([1, 2, 3, 4]);
        });

        it('should return unique strings', () => {
            const data = ['a', 'b', 'a', 'c', 'b'];
            const option: QueryOption<any, 'distinct'> = {
                name: 'distinct',
                value: true,
                target: 'memory'
            };

            const result = translator.distinct(data, option);

            expect(result).toEqual(['a', 'b', 'c']);
        });

        it('should return unique dates', () => {
            const date1 = new Date('2023-01-01');
            const date2 = new Date('2023-01-02');
            const date3 = new Date('2023-01-01');
            const data = [date1, date2, date3];
            const option: QueryOption<any, 'distinct'> = {
                name: 'distinct',
                value: true,
                target: 'memory'
            };

            const result = translator.distinct(data, option) as any;

            expect(result).toHaveLength(2);
            expect(result[0]).toBeInstanceOf(Date);
            expect(result[1]).toBeInstanceOf(Date);
        });

        it('should handle mixed data types', () => {
            const data = [1, 'a', 1, 'b', 2, 'a'];
            const option: QueryOption<any, 'distinct'> = {
                name: 'distinct',
                value: true,
                target: 'memory'
            };

            const result = translator.distinct(data, option);

            expect(result).toEqual([1, 'a', 'b', 2]);
        });

        it('should throw error when data is not an array', () => {
            const data = 5;
            const option: QueryOption<any, 'distinct'> = {
                name: 'distinct',
                value: true,
                target: 'memory'
            };

            expect(() => translator.distinct(data, option)).toThrow();
        });
    });

    describe('skip', () => {
        it('should skip specified number of items', () => {
            const data = [1, 2, 3, 4, 5];
            const option: QueryOption<any, 'skip'> = {
                name: 'skip',
                value: 2,
                target: 'memory'
            };

            const result = translator.skip(data, option);

            expect(result).toEqual([3, 4, 5]);
        });

        it('should return empty array when skip count exceeds array length', () => {
            const data = [1, 2, 3];
            const option: QueryOption<any, 'skip'> = {
                name: 'skip',
                value: 5,
                target: 'memory'
            };

            const result = translator.skip(data, option);

            expect(result).toEqual(data);
        });

        it('should return original array when skip count is 0', () => {
            const data = [1, 2, 3];
            const option: QueryOption<any, 'skip'> = {
                name: 'skip',
                value: 0,
                target: 'memory'
            };

            const result = translator.skip(data, option);

            expect(result).toEqual(data);
        });

        it('should return original array when skip count is negative', () => {
            const data = [1, 2, 3];
            const option: QueryOption<any, 'skip'> = {
                name: 'skip',
                value: -1,
                target: 'memory'
            };

            const result = translator.skip(data, option);

            expect(result).toEqual(data);
        });

        it('should return data unchanged when not an array', () => {
            const data = { id: 1, name: 'test' };
            const option: QueryOption<any, 'skip'> = {
                name: 'skip',
                value: 2,
                target: 'memory'
            };

            const result = translator.skip(data, option);

            expect(result).toBe(data);
        });
    });

    describe('take', () => {
        it('should take specified number of items', () => {
            const data = [1, 2, 3, 4, 5];
            const option: QueryOption<any, 'take'> = {
                name: 'take',
                value: 3,
                target: 'memory'
            };

            const result = translator.take(data, option);

            expect(result).toEqual([1, 2, 3]);
        });

        it('should return all items when take count exceeds array length', () => {
            const data = [1, 2, 3];
            const option: QueryOption<any, 'take'> = {
                name: 'take',
                value: 5,
                target: 'memory'
            };

            const result = translator.take(data, option);

            expect(result).toEqual([1, 2, 3]);
        });

        it('should return empty array when take count is 0', () => {
            const data = [1, 2, 3];
            const option: QueryOption<any, 'take'> = {
                name: 'take',
                value: 0,
                target: 'memory'
            };

            const result = translator.take(data, option);

            expect(result).toEqual(data);
        });

        it('should return empty array when take count is negative', () => {
            const data = [1, 2, 3];
            const option: QueryOption<any, 'take'> = {
                name: 'take',
                value: -1,
                target: 'memory'
            };

            const result = translator.take(data, option);

            expect(result).toEqual(data);
        });

        it('should return data unchanged when not an array', () => {
            const data = { id: 1, name: 'test' };
            const option: QueryOption<any, 'take'> = {
                name: 'take',
                value: 2,
                target: 'memory'
            };

            const result = translator.take(data, option);

            expect(result).toBe(data);
        });
    });
}); 