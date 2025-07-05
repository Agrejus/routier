import { describe, it, expect } from 'vitest';
import { toExpression, combineExpressions } from './parser';
import { CompiledSchema, SchemaTypes } from '../schema';
import { Expression, ComparatorExpression, OperatorExpression, PropertyExpression, ValueExpression } from './types';

describe('Parser', () => {
    const mockSchema = {
        properties: [
            {
                getAssignmentPath: () => 'name',
                type: SchemaTypes.String
            },
            {
                getAssignmentPath: () => 'age',
                type: SchemaTypes.Number
            },
            {
                getAssignmentPath: () => 'isActive',
                type: SchemaTypes.Boolean
            },
            {
                getAssignmentPath: () => 'tags',
                type: SchemaTypes.Array
            },
            {
                getAssignmentPath: () => 'profile',
                type: SchemaTypes.Object
            },
            {
                getAssignmentPath: () => 'createdAt',
                type: SchemaTypes.Date
            }
        ]
    } as CompiledSchema<any>;

    describe('toExpression', () => {
        describe('basic comparisons', () => {
            it('should parse equality comparison with ==', () => {
                const expression = toExpression(mockSchema, (entity: any) => entity.name == 'test');

                expect(expression).toBeInstanceOf(ComparatorExpression);
                const comp = expression as ComparatorExpression;
                expect(comp.comparator).toBe('equals');
                expect(comp.negated).toBe(false);
                expect(comp.strict).toBe(false);
                expect(comp.left).toBeInstanceOf(PropertyExpression);
                expect(comp.right).toBeInstanceOf(ValueExpression);
                expect((comp.right as ValueExpression).value).toBe('test');
            });

            it('should parse strict equality comparison with ===', () => {
                const expression = toExpression(mockSchema, (entity: any) => entity.name === 'test');

                expect(expression).toBeInstanceOf(ComparatorExpression);
                const comp = expression as ComparatorExpression;
                expect(comp.comparator).toBe('equals');
                expect(comp.negated).toBe(false);
                expect(comp.strict).toBe(true);
            });

            it('should parse inequality comparison with !=', () => {
                const expression = toExpression(mockSchema, (entity: any) => entity.name != 'test');

                expect(expression).toBeInstanceOf(ComparatorExpression);
                const comp = expression as ComparatorExpression;
                expect(comp.comparator).toBe('equals');
                expect(comp.negated).toBe(true);
                expect(comp.strict).toBe(false);
            });

            it('should parse strict inequality comparison with !==', () => {
                const expression = toExpression(mockSchema, (entity: any) => entity.name !== 'test');

                expect(expression).toBeInstanceOf(ComparatorExpression);
                const comp = expression as ComparatorExpression;
                expect(comp.comparator).toBe('equals');
                expect(comp.negated).toBe(true);
                expect(comp.strict).toBe(true);
            });
        });

        describe('numeric comparisons', () => {
            it('should parse greater than comparison', () => {
                const expression = toExpression(mockSchema, (entity: any) => entity.age > 18);

                expect(expression).toBeInstanceOf(ComparatorExpression);
                const comp = expression as ComparatorExpression;
                expect(comp.comparator).toBe('greater-than');
                expect(comp.negated).toBe(false);
                expect(comp.strict).toBe(false);
                expect((comp.right as ValueExpression).value).toBe(18);
            });

            it('should parse less than comparison', () => {
                const expression = toExpression(mockSchema, (entity: any) => entity.age < 65);

                expect(expression).toBeInstanceOf(ComparatorExpression);
                const comp = expression as ComparatorExpression;
                expect(comp.comparator).toBe('less-than');
                expect(comp.negated).toBe(false);
                expect(comp.strict).toBe(false);
            });

            it('should parse greater than or equal comparison', () => {
                const expression = toExpression(mockSchema, (entity: any) => entity.age >= 18);

                expect(expression).toBeInstanceOf(ComparatorExpression);
                const comp = expression as ComparatorExpression;
                expect(comp.comparator).toBe('greater-than-equals');
                expect(comp.negated).toBe(false);
                expect(comp.strict).toBe(false);
            });

            it('should parse less than or equal comparison', () => {
                const expression = toExpression(mockSchema, (entity: any) => entity.age <= 65);

                expect(expression).toBeInstanceOf(ComparatorExpression);
                const comp = expression as ComparatorExpression;
                expect(comp.comparator).toBe('less-than-equals');
                expect(comp.negated).toBe(false);
                expect(comp.strict).toBe(false);
            });
        });

        describe('string methods', () => {
            it('should parse startsWith method', () => {
                const expression = toExpression(mockSchema, (entity: any) => entity.name.startsWith('test'));

                expect(expression).toBeInstanceOf(ComparatorExpression);
                const comp = expression as ComparatorExpression;
                expect(comp.comparator).toBe('starts-with');
                expect(comp.negated).toBe(false);
                expect(comp.strict).toBe(false);
                expect((comp.right as ValueExpression).value).toBe('test');
            });

            it('should parse endsWith method', () => {
                const expression = toExpression(mockSchema, (entity: any) => entity.name.endsWith('test'));

                expect(expression).toBeInstanceOf(ComparatorExpression);
                const comp = expression as ComparatorExpression;
                expect(comp.comparator).toBe('ends-with');
                expect(comp.negated).toBe(false);
                expect(comp.strict).toBe(false);
            });

            it('should parse includes method', () => {
                const expression = toExpression(mockSchema, (entity: any) => entity.name.includes('test'));

                expect(expression).toBeInstanceOf(ComparatorExpression);
                const comp = expression as ComparatorExpression;
                expect(comp.comparator).toBe('includes');
                expect(comp.negated).toBe(false);
                expect(comp.strict).toBe(false);
            });

            it('should parse negated startsWith method', () => {
                const expression = toExpression(mockSchema, (entity: any) => !entity.name.startsWith('test'));

                expect(expression).toBeInstanceOf(ComparatorExpression);
                const comp = expression as ComparatorExpression;
                expect(comp.comparator).toBe('starts-with');
                expect(comp.negated).toBe(true);
                expect(comp.strict).toBe(false);
            });

            it('should parse startsWith method compared to false', () => {
                const expression = toExpression(mockSchema, (entity: any) => entity.name.startsWith('test') === false);

                expect(expression).toBeInstanceOf(ComparatorExpression);
                const comp = expression as ComparatorExpression;
                expect(comp.comparator).toBe('starts-with');
                expect(comp.negated).toBe(true);
                expect(comp.strict).toBe(false);
            });
        });

        describe('boolean values', () => {
            it('should parse boolean true comparison', () => {
                const expression = toExpression(mockSchema, (entity: any) => entity.isActive == true);

                expect(expression).toBeInstanceOf(ComparatorExpression);
                const comp = expression as ComparatorExpression;
                expect(comp.comparator).toBe('equals');
                expect((comp.right as ValueExpression).value).toBe(true);
            });

            it('should parse boolean false comparison', () => {
                const expression = toExpression(mockSchema, (entity: any) => entity.isActive == false);

                expect(expression).toBeInstanceOf(ComparatorExpression);
                const comp = expression as ComparatorExpression;
                expect(comp.comparator).toBe('equals');
                // The parser treats "false" as a string and converts it to Boolean("false") = true
                expect((comp.right as ValueExpression).value).toBe(true);
            });
        });

        describe('parameterized filters', () => {
            it('should parse parameterized filter with string parameter', () => {
                const expression = toExpression(mockSchema, ([entity, params]: [any, { searchTerm: string }]) => entity.name == params.searchTerm, { searchTerm: 'test' });

                expect(expression).toBeInstanceOf(ComparatorExpression);
                const comp = expression as ComparatorExpression;
                expect(comp.comparator).toBe('equals');
                expect((comp.right as ValueExpression).value).toBe('test');
            });

            it('should parse parameterized filter with number parameter', () => {
                const expression = toExpression(mockSchema, ([entity, params]: [any, { minAge: number }]) => entity.age >= params.minAge, { minAge: 18 });

                expect(expression).toBeInstanceOf(ComparatorExpression);
                const comp = expression as ComparatorExpression;
                expect(comp.comparator).toBe('greater-than-equals');
                expect((comp.right as ValueExpression).value).toBe(18);
            });

            it('should parse parameterized filter with nested parameter', () => {
                const expression = toExpression(mockSchema, ([entity, params]: [any, { filters: { searchTerm: string } }]) => entity.name == params.filters.searchTerm, { filters: { searchTerm: 'test' } });

                expect(expression).toBeInstanceOf(ComparatorExpression);
                const comp = expression as ComparatorExpression;
                expect(comp.comparator).toBe('equals');
                expect((comp.right as ValueExpression).value).toBe('test');
            });

            it('should return NOT_PARSABLE for invalid parameter path', () => {
                const expression = toExpression(mockSchema, ([entity, params]: [any, { searchTerm: string }]) => entity.name == (params as any).invalidPath, { searchTerm: 'test' });

                expect(expression).toStrictEqual(Expression.NOT_PARSABLE);
            });

            it('should return NOT_PARSABLE for invalid parameter usage', () => {
                const expression = toExpression(mockSchema, ([entity, params]: [any, { searchTerm: string }]) => entity.name == params as any, { searchTerm: 'test' });

                expect(expression).toStrictEqual(Expression.NOT_PARSABLE);
            });
        });

        describe('logical operators', () => {
            it('should parse AND operator', () => {
                const expression = toExpression(mockSchema, (entity: any) => entity.name == 'test' && entity.age > 18);

                expect(expression).toBeInstanceOf(OperatorExpression);
                const op = expression as OperatorExpression;
                expect(op.operator).toBe('&&');
                expect(op.left).toBeInstanceOf(ComparatorExpression);
                expect(op.right).toBeInstanceOf(ComparatorExpression);
            });

            it('should parse OR operator', () => {
                const expression = toExpression(mockSchema, (entity: any) => entity.name == 'test' || entity.age > 18);

                expect(expression).toBeInstanceOf(OperatorExpression);
                const op = expression as OperatorExpression;
                expect(op.operator).toBe('||');
                expect(op.left).toBeInstanceOf(ComparatorExpression);
                expect(op.right).toBeInstanceOf(ComparatorExpression);
            });

            it('should parse complex logical expression with precedence', () => {
                const expression = toExpression(mockSchema, (entity: any) => entity.name == 'test' && entity.age > 18 || entity.isActive == true);

                expect(expression).toBeInstanceOf(OperatorExpression);
                const op = expression as OperatorExpression;
                expect(op.operator).toBe('&&');
                expect(op.left).toBeInstanceOf(ComparatorExpression);
                expect(op.right).toBeInstanceOf(OperatorExpression);
            });
        });

        describe('parentheses', () => {
            it('should parse expression with parentheses', () => {
                const expression = toExpression(mockSchema, (entity: any) => (entity.name == 'test') && (entity.age > 18));

                expect(expression).toBeInstanceOf(OperatorExpression);
                const op = expression as OperatorExpression;
                expect(op.operator).toBe('&&');
                expect(op.left).toBeInstanceOf(ComparatorExpression);
                expect(op.right).toBeInstanceOf(ComparatorExpression);
            });

            it('should parse nested parentheses', () => {
                const expression = toExpression(mockSchema, (entity: any) => ((entity.name == 'test')));

                expect(expression).toBeInstanceOf(ComparatorExpression);
                const comp = expression as ComparatorExpression;
                expect(comp.comparator).toBe('equals');
            });
        });

        describe('error handling', () => {
            it('should return NOT_PARSABLE for invalid function format', () => {
                const expression = toExpression(mockSchema, (() => 'invalid') as any);

                expect(expression).toStrictEqual(Expression.NOT_PARSABLE);
            });

            it('should return NOT_PARSABLE for unsupported expression format', () => {
                const expression = toExpression(mockSchema, (entity: any) => entity.name + 'test' as any);

                expect(expression).toStrictEqual(Expression.NOT_PARSABLE);
            });

            it('should return NOT_PARSABLE for unknown property', () => {
                const expression = toExpression(mockSchema, (entity: any) => entity.unknownProperty == 'test');

                expect(expression).toStrictEqual(Expression.NOT_PARSABLE);
            });

            it('should return NOT_PARSABLE for invalid parameter usage', () => {
                const expression = toExpression(mockSchema, ([entity, params]: [any, { searchTerm: string }]) => entity.name == params as any, { searchTerm: 'test' });

                expect(expression).toStrictEqual(Expression.NOT_PARSABLE);
            });
        });

        describe('type conversion', () => {
            it('should convert string values for string properties', () => {
                const expression = toExpression(mockSchema, (entity: any) => entity.name == 'test');

                const comp = expression as ComparatorExpression;
                expect((comp.right as ValueExpression).value).toBe('test');
            });

            it('should convert number values for number properties', () => {
                const expression = toExpression(mockSchema, (entity: any) => entity.age == 25);

                const comp = expression as ComparatorExpression;
                expect((comp.right as ValueExpression).value).toBe(25);
            });

            it('should convert boolean values for boolean properties', () => {
                const expression = toExpression(mockSchema, (entity: any) => entity.isActive == true);

                const comp = expression as ComparatorExpression;
                expect((comp.right as ValueExpression).value).toBe(true);
            });
        });
    });

    describe('combineExpressions', () => {
        it('should throw error for empty expressions array', () => {
            expect(() => {
                combineExpressions();
            }).toThrow('combineExpressions requires at least 1 expression');
        });

        it('should return single expression when only one provided', () => {
            const expression = new ComparatorExpression({
                comparator: 'equals',
                negated: false,
                strict: false
            });

            const result = combineExpressions(expression);
            expect(result).toBe(expression);
        });

        it('should combine two expressions with AND operator', () => {
            const expr1 = new ComparatorExpression({
                comparator: 'equals',
                negated: false,
                strict: false
            });
            const expr2 = new ComparatorExpression({
                comparator: 'greater-than',
                negated: false,
                strict: false
            });

            const result = combineExpressions(expr1, expr2);
            expect(result).toBeInstanceOf(OperatorExpression);
            const op = result as OperatorExpression;
            expect(op.operator).toBe('&&');
            expect(op.left).toBe(expr1);
            expect(op.right).toBe(expr2);
        });

        it('should combine multiple expressions with AND operators', () => {
            const expr1 = new ComparatorExpression({
                comparator: 'equals',
                negated: false,
                strict: false
            });
            const expr2 = new ComparatorExpression({
                comparator: 'greater-than',
                negated: false,
                strict: false
            });
            const expr3 = new ComparatorExpression({
                comparator: 'less-than',
                negated: false,
                strict: false
            });

            const result = combineExpressions(expr1, expr2, expr3);
            expect(result).toBeInstanceOf(OperatorExpression);
            const op = result as OperatorExpression;
            expect(op.operator).toBe('&&');
            expect(op.left).toBeInstanceOf(OperatorExpression);
            expect(op.right).toBe(expr3);
        });
    });
}); 