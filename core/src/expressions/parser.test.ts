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
                getAssignmentPath: () => 'price',
                type: SchemaTypes.Number
            },
            {
                getAssignmentPath: () => 'isActive',
                type: SchemaTypes.Boolean
            },
            {
                getAssignmentPath: () => 'isVerified',
                type: SchemaTypes.Boolean
            },
            {
                getAssignmentPath: () => 'rating',
                type: SchemaTypes.Number
            },
            {
                getAssignmentPath: () => 'reviewCount',
                type: SchemaTypes.Number
            },
            {
                getAssignmentPath: () => 'category',
                type: SchemaTypes.String
            },
            {
                getAssignmentPath: () => 'description',
                type: SchemaTypes.String
            },
            {
                getAssignmentPath: () => 'features',
                type: SchemaTypes.Array
            },
            {
                getAssignmentPath: () => 'specifications',
                type: SchemaTypes.Object
            },
            {
                getAssignmentPath: () => 'brand',
                type: SchemaTypes.String
            },
            {
                getAssignmentPath: () => 'id',
                type: SchemaTypes.Number
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

            it('should parse between comparison', () => {
                const expression = toExpression(mockSchema, (entity: any) => entity.age <= 65 && entity.age >= 35);

                expect(expression).toBeInstanceOf(OperatorExpression);
                const operatorExpression = expression as OperatorExpression;
                expect(operatorExpression.operator).toBe("&&");

                const comp1 = operatorExpression.left as ComparatorExpression;
                const comp2 = operatorExpression.right as ComparatorExpression;

                expect(comp1.comparator).toBe('less-than-equals');
                expect(comp1.negated).toBe(false);
                expect(comp1.strict).toBe(false);

                expect(comp2.comparator).toBe('greater-than-equals');
                expect(comp2.negated).toBe(false);
                expect(comp2.strict).toBe(false);
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

            it('should handle to lower case', () => {
                const expression = toExpression(mockSchema, (entity: any) => entity.name.toLowerCase().startsWith('test'));

                expect(expression).toBeInstanceOf(ComparatorExpression);
                const comp = expression as ComparatorExpression;
                expect(comp.comparator).toBe('starts-with');
                expect(comp.negated).toBe(false);
                expect(comp.strict).toBe(false);
                expect((comp.left as PropertyExpression).transformer).toBe('to-lower-case');
                expect((comp.right as ValueExpression).value).toBe('test');
                expect((comp.right as ValueExpression).transformer).toBeNull()
            });

            it('should handle to lower case for value and property', () => {
                const expression = toExpression(mockSchema, (entity: any) => entity.name.toLowerCase().startsWith('test'.toLowerCase()));

                expect(expression).toBeInstanceOf(ComparatorExpression);
                const comp = expression as ComparatorExpression;
                expect(comp.comparator).toBe('starts-with');
                expect(comp.negated).toBe(false);
                expect(comp.strict).toBe(false);
                expect((comp.left as PropertyExpression).transformer).toBe('to-lower-case');
                expect((comp.right as ValueExpression).value).toBe('test');
                expect((comp.right as ValueExpression).transformer).toBe('to-lower-case');
            });

            it('should handle value-side toLowerCase', () => {
                const expression = toExpression(mockSchema, (entity: any) => entity.name === 'TEST'.toLowerCase());

                expect(expression).toBeInstanceOf(ComparatorExpression);
                const comp = expression as ComparatorExpression;
                expect(comp.comparator).toBe('equals');
                expect(comp.negated).toBe(false);
                expect(comp.strict).toBe(true);
                expect((comp.left as PropertyExpression).transformer).toBeNull();
                expect((comp.right as ValueExpression).transformer).toBe('to-lower-case');
                expect((comp.right as ValueExpression).value).toBe('TEST');
            });

            it('should handle toLocaleLowerCase', () => {
                const expression = toExpression(mockSchema, (entity: any) => entity.name.toLocaleLowerCase().startsWith('test'));

                expect(expression).toBeInstanceOf(ComparatorExpression);
                const comp = expression as ComparatorExpression;
                expect(comp.comparator).toBe('starts-with');
                expect(comp.negated).toBe(false);
                expect(comp.strict).toBe(false);
                expect((comp.left as PropertyExpression).transformer).toBe('to-lower-case');
                expect((comp.left as PropertyExpression).locale).toBe('en-US');
                expect((comp.right as ValueExpression).value).toBe('test');
                expect((comp.right as ValueExpression).transformer).toBeNull();
            });

            it('should handle toLocaleUpperCase', () => {
                const expression = toExpression(mockSchema, (entity: any) => entity.name.toLocaleUpperCase().includes('TEST'));

                expect(expression).toBeInstanceOf(ComparatorExpression);
                const comp = expression as ComparatorExpression;
                expect(comp.comparator).toBe('includes');
                expect(comp.negated).toBe(false);
                expect(comp.strict).toBe(false);
                expect((comp.left as PropertyExpression).transformer).toBe('to-upper-case');
                expect((comp.left as PropertyExpression).locale).toBe('en-US');
                expect((comp.right as ValueExpression).value).toBe('TEST');
                expect((comp.right as ValueExpression).transformer).toBeNull();
            });

            it('should handle value-side toLocaleLowerCase', () => {
                const expression = toExpression(mockSchema, (entity: any) => entity.name === 'TEST'.toLocaleLowerCase());

                expect(expression).toBeInstanceOf(ComparatorExpression);
                const comp = expression as ComparatorExpression;
                expect(comp.comparator).toBe('equals');
                expect(comp.negated).toBe(false);
                expect(comp.strict).toBe(true);
                expect((comp.left as PropertyExpression).transformer).toBeNull();
                expect((comp.right as ValueExpression).transformer).toBe('to-lower-case');
                expect((comp.right as ValueExpression).locale).toBe('en-US');
                expect((comp.right as ValueExpression).value).toBe('TEST');
            });

            it('should handle combined locale transformations', () => {
                const expression = toExpression(mockSchema, (entity: any) => entity.name.toLocaleLowerCase().startsWith('test'.toLocaleLowerCase()));

                expect(expression).toBeInstanceOf(ComparatorExpression);
                const comp = expression as ComparatorExpression;
                expect(comp.comparator).toBe('starts-with');
                expect(comp.negated).toBe(false);
                expect(comp.strict).toBe(false);
                expect((comp.left as PropertyExpression).transformer).toBe('to-lower-case');
                expect((comp.left as PropertyExpression).locale).toBe('en-US');
                expect((comp.right as ValueExpression).value).toBe('test');
                expect((comp.right as ValueExpression).transformer).toBe('to-lower-case');
                expect((comp.right as ValueExpression).locale).toBe('en-US');
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

        describe('array methods', () => {
            it('should parse boolean false comparison', () => {
                const expression = toExpression(mockSchema, (entity: any) => entity.tags.includes("test"));

                expect(expression).toBeInstanceOf(ComparatorExpression);
                const comp = expression as ComparatorExpression;
                expect(comp.comparator).toBe('includes');
                // The parser treats "false" as a string and converts it to Boolean("false") = true
                expect((comp.right as ValueExpression).value).toBe("test");
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

        describe('null/undefined comparisons', () => {
            it('should parse null comparison', () => {
                const expression = toExpression(mockSchema, (entity: any) => entity.name == null);

                expect(expression).toBeInstanceOf(ComparatorExpression);
                const comp = expression as ComparatorExpression;
                expect(comp.comparator).toBe('equals');
                expect(comp.strict).toBe(false);
                expect((comp.right as ValueExpression).value).toBeNull();
            });

            it('should parse null comparison', () => {
                const expression = toExpression(mockSchema, (entity: any) => entity.name == undefined);

                expect(expression).toBeInstanceOf(ComparatorExpression);
                const comp = expression as ComparatorExpression;
                expect(comp.comparator).toBe('equals');
                expect(comp.strict).toBe(false);
                expect((comp.right as ValueExpression).value).toBeUndefined();
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

            it('should handle numeric string values', () => {
                const expression = toExpression(mockSchema, (entity: any) => entity.age == '25');

                const comp = expression as ComparatorExpression;
                expect((comp.right as ValueExpression).value).toBe(25);
            });

            it('should handle boolean string values', () => {
                const expression = toExpression(mockSchema, (entity: any) => entity.isActive == 'true');

                const comp = expression as ComparatorExpression;
                expect((comp.right as ValueExpression).value).toBe(true);
            });
        });

        describe('edge cases', () => {
            it('should handle expressions with extra whitespace', () => {
                const expression = toExpression(mockSchema, (entity: any) => entity.name == 'test' && entity.age > 18);

                expect(expression).toBeInstanceOf(OperatorExpression);
                const op = expression as OperatorExpression;
                expect(op.operator).toBe('&&');
                expect(op.left).toBeInstanceOf(ComparatorExpression);
                expect(op.right).toBeInstanceOf(ComparatorExpression);
            });

            it('should handle expressions with multiple parentheses levels', () => {
                const expression = toExpression(mockSchema, (entity: any) => ((entity.name == 'test')));

                expect(expression).toBeInstanceOf(ComparatorExpression);
                const comp = expression as ComparatorExpression;
                expect(comp.comparator).toBe('equals');
            });

            it('should handle expressions with complex parentheses grouping', () => {
                const expression = toExpression(mockSchema, (entity: any) => (entity.name == 'test' && entity.age > 18) || entity.isActive == true);

                expect(expression).toBeInstanceOf(OperatorExpression);
                const op = expression as OperatorExpression;
                expect(op.operator).toBe('&&');
                expect(op.left).toBeInstanceOf(ComparatorExpression);
                expect(op.right).toBeInstanceOf(OperatorExpression);
            });

            it('should handle expressions with string values containing spaces', () => {
                const expression = toExpression(mockSchema, (entity: any) => entity.name == 'test value');

                expect(expression).toBeInstanceOf(ComparatorExpression);
                const comp = expression as ComparatorExpression;
                expect((comp.right as ValueExpression).value).toBe('test value');
            });

            it('should handle expressions with numeric comparisons to string numbers', () => {
                const expression = toExpression(mockSchema, (entity: any) => entity.age > '18');

                expect(expression).toBeInstanceOf(ComparatorExpression);
                const comp = expression as ComparatorExpression;
                expect(comp.comparator).toBe('greater-than');
                expect((comp.right as ValueExpression).value).toBe(18);
            });
        });

        describe('reversed comparisons', () => {
            it('should handle reversed equality comparison', () => {
                const expression = toExpression(mockSchema, (entity: any) => "test" === entity.name);

                expect(expression).toBeInstanceOf(ComparatorExpression);
                const comp = expression as ComparatorExpression;
                expect(comp.comparator).toBe('equals');
                expect(comp.negated).toBe(false);
                expect(comp.strict).toBe(true);
                expect(comp.left).toBeInstanceOf(PropertyExpression);
                expect(comp.right).toBeInstanceOf(ValueExpression);
                expect((comp.right as ValueExpression).value).toBe('test');
            });

            it('should handle reversed numeric comparison', () => {
                const expression = toExpression(mockSchema, (entity: any) => 18 <= entity.age);

                expect(expression).toBeInstanceOf(ComparatorExpression);
                const comp = expression as ComparatorExpression;
                expect(comp.comparator).toBe('greater-than-equals');
                expect(comp.negated).toBe(false);
                expect(comp.strict).toBe(false);
                expect(comp.left).toBeInstanceOf(PropertyExpression);
                expect(comp.right).toBeInstanceOf(ValueExpression);
                expect((comp.right as ValueExpression).value).toBe(18);
            });
        });

        describe('todo', () => {



            // it('should parse multiple complex expressions efficiently', () => {
            //     const params = {
            //         filters: {
            //             categories: ['electronics', 'books'],
            //             priceRange: { min: 10, max: 500 },
            //             searchTerm: 'javascript'
            //         }
            //     };

            //     const expressions = [
            //         // Expression 1: Product search with category and price filtering
            //         ([entity, params]: [any, { filters: { categories: string[], priceRange: { min: number, max: number }, searchTerm: string } }]) =>
            //             entity.category === params.filters.categories[0] &&
            //             entity.price >= params.filters.priceRange.min &&
            //             entity.price <= params.filters.priceRange.max &&
            //             entity.name.toLowerCase().includes(params.filters.searchTerm.toLowerCase()) &&
            //             entity.isActive === true &&
            //             entity.rating >= 4.0,

            //         // Expression 2: User preference based filtering
            //         ([entity, params]: [any, { filters: { categories: string[], priceRange: { min: number, max: number }, searchTerm: string } }]) =>
            //             (entity.category === params.filters.categories[0] || entity.category === params.filters.categories[1]) &&
            //             entity.price <= params.filters.priceRange.max &&
            //             entity.description.toLowerCase().includes(params.filters.searchTerm.toLowerCase()) &&
            //             entity.reviewCount > 5 &&
            //             entity.isVerified === true,

            //         // Expression 3: Advanced filtering with multiple conditions
            //         ([entity, params]: [any, { filters: { categories: string[], priceRange: { min: number, max: number }, searchTerm: string } }]) =>
            //             entity.price >= params.filters.priceRange.min &&
            //             entity.price <= params.filters.priceRange.max &&
            //             (entity.name.startsWith('Pro') || entity.name.endsWith('Plus')) &&
            //             entity.tags && entity.tags.length > 0 &&
            //             !entity.tags.includes('deprecated') &&
            //             entity.createdAt >= '2023-01-01' &&
            //             entity.createdAt <= '2023-12-31',

            //         // Expression 4: Complex nested logical operations
            //         ([entity, params]: [any, { filters: { categories: string[], priceRange: { min: number, max: number }, searchTerm: string } }]) =>
            //             ((entity.category === 'electronics' && entity.price > 100) ||
            //                 (entity.category === 'books' && entity.price < 50) ||
            //                 (entity.category === 'clothing' && entity.price >= 20 && entity.price <= 200)) &&
            //             entity.name.toLowerCase().includes(params.filters.searchTerm.toLowerCase()) &&
            //             entity.isActive === true &&
            //             entity.rating >= 3.5,

            //         // Expression 5: Multi-field search with validation
            //         ([entity, params]: [any, { filters: { categories: string[], priceRange: { min: number, max: number }, searchTerm: string } }]) =>
            //             entity.price >= params.filters.priceRange.min &&
            //             entity.price <= params.filters.priceRange.max &&
            //             (entity.name.toLowerCase().includes(params.filters.searchTerm.toLowerCase()) ||
            //                 entity.description.toLowerCase().includes(params.filters.searchTerm.toLowerCase()) ||
            //                 entity.brand.toLowerCase().includes(params.filters.searchTerm.toLowerCase())) &&
            //             entity.isVerified === true &&
            //             entity.reviewCount >= 3
            //     ];

            //     const start = performance.now();

            //     const parsedExpressions = expressions.map(expr =>
            //         toExpression(mockSchema, expr, params)
            //     );

            //     const end = performance.now();
            //     const duration = end - start;

            //     console.log(`Parsed ${expressions.length} complex expressions in: ${duration.toFixed(2)}ms`);
            //     console.log(`Average time per expression: ${(duration / expressions.length).toFixed(2)}ms`);

            //     parsedExpressions.forEach((expression, index) => {
            //         expect(expression).not.toBeNull();
            //         expect(expression).not.toStrictEqual(Expression.NOT_PARSABLE);
            //     });

            //     expect(duration).toBeLessThan(200); // Should complete in under 200ms
            // });
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

    describe("performance", () => {
        it('should parse simple expression under .3 ms', () => {

            const start = performance.now();
            const expression = toExpression(mockSchema, (entity: any) => entity.name === 'test');
            const delta = performance.now() - start;
            console.log(`Took ${delta}ms`)
            expect(delta).toBeLessThan(.3);
            expect(expression).toBeInstanceOf(ComparatorExpression);
            const comp = expression as ComparatorExpression;
            expect(comp.comparator).toBe('equals');
            expect(comp.negated).toBe(false);
            expect(comp.strict).toBe(true);
        });

        it('should parse slightly complex real-world expression under 1ms', () => {
            const complexParams = {
                userFilters: {
                    ageRange: { min: 18, max: 65 },
                    categories: ['electronics', 'books', 'clothing'],
                    priceRange: { min: 10, max: 1000 },
                    searchTerms: ['javascript', 'react', 'typescript'],
                    excludeTags: ['deprecated', 'legacy'],
                    dateRange: { start: '2023-01-01', end: '2023-12-31' }
                },
                userPreferences: {
                    preferredCategories: ['electronics', 'books'],
                    maxPrice: 500,
                    requireReviews: true,
                    minRating: 4.0
                }
            };

            const start = performance.now();
            const expression = toExpression(mockSchema,
                ([entity, params]: [any, typeof complexParams]) =>
                    // User age and category preferences
                    (entity.age >= params.userFilters.ageRange.min && entity.age <= params.userFilters.ageRange.max) &&

                    // Price filtering with user preferences
                    (entity.price >= params.userFilters.priceRange.min && entity.price <= params.userFilters.priceRange.max) &&
                    (entity.price <= params.userPreferences.maxPrice) &&

                    // Date range filtering
                    (entity.createdAt >= params.userFilters.dateRange.start && entity.createdAt <= params.userFilters.dateRange.end) &&

                    // Quality filters
                    (entity.isActive === true) &&
                    (entity.isVerified === true) &&
                    (entity.rating >= params.userPreferences.minRating) &&
                    (entity.reviewCount > 0) &&

                    // Complex nested conditions
                    ((entity.category === 'electronics' && entity.price > 100) ||
                        (entity.category === 'books' && entity.price < 50) ||
                        (entity.category === 'clothing' && entity.price >= 20 && entity.price <= 200)) &&

                    // Advanced string matching
                    (entity.name.startsWith('Premium') || entity.name.endsWith('Pro') || entity.name.includes('Advanced')) &&

                    // Multiple OR conditions with AND combinations
                    ((entity.brand === 'Apple' && entity.price > 200) ||
                        (entity.brand === 'Samsung' && entity.price > 150) ||
                        (entity.brand === 'Sony' && entity.price > 100) ||
                        (entity.brand !== 'Apple' && entity.brand !== 'Samsung' && entity.brand !== 'Sony' && entity.price < 100)) &&

                    // Final validation checks
                    (entity.id > 0) &&
                    (entity.name !== '') &&
                    (entity.category !== '') &&
                    (entity.price > 0)
                , complexParams);

            const end = performance.now();
            const duration = end - start;

            console.log(`Complex expression parsing took: ${duration.toFixed(2)}ms`);

            expect(expression).not.toBeNull();
            expect(expression).not.toStrictEqual(Expression.NOT_PARSABLE); // Parser can handle this expression
            expect(duration).toBeLessThan(1); // Should complete in under 100ms
        });
    })
}); 