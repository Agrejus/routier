import { describe, it, expect } from 'vitest';
import { getProperties } from './utils';
import { Expression, ComparatorExpression, OperatorExpression, PropertyExpression, ValueExpression } from './types';
import { PropertyInfo } from '../common/PropertyInfo';
import { SchemaTypes } from '../schema';

describe('Utils', () => {
    const mockProperty1: PropertyInfo<any> = {
        getAssignmentPath: () => 'name',
        type: SchemaTypes.String
    } as PropertyInfo<any>;

    const mockProperty2: PropertyInfo<any> = {
        getAssignmentPath: () => 'age',
        type: SchemaTypes.Number
    } as PropertyInfo<any>;

    const mockProperty3: PropertyInfo<any> = {
        getAssignmentPath: () => 'isActive',
        type: SchemaTypes.Boolean
    } as PropertyInfo<any>;

    describe('getProperties', () => {
        it('should extract properties from a single property expression', () => {
            const expression = new PropertyExpression({
                property: mockProperty1
            });

            const properties = getProperties(expression);

            expect(properties).toHaveLength(1);
            expect(properties[0]).toBe(mockProperty1);
        });

        it('should extract properties from a comparator expression', () => {
            const expression = new ComparatorExpression({
                comparator: 'equals',
                negated: false,
                strict: false,
                left: new PropertyExpression({ property: mockProperty1 }),
                right: new ValueExpression({ value: 'test' })
            });

            const properties = getProperties(expression);

            expect(properties).toHaveLength(1);
            expect(properties[0]).toBe(mockProperty1);
        });

        it('should extract properties from an operator expression with two properties', () => {
            const expression = new OperatorExpression({
                operator: '&&',
                left: new PropertyExpression({ property: mockProperty1 }),
                right: new PropertyExpression({ property: mockProperty2 })
            });

            const properties = getProperties(expression);

            expect(properties).toHaveLength(2);
            expect(properties).toContain(mockProperty1);
            expect(properties).toContain(mockProperty2);
        });

        it('should extract properties from a complex nested expression', () => {
            const innerExpression = new OperatorExpression({
                operator: '||',
                left: new PropertyExpression({ property: mockProperty2 }),
                right: new PropertyExpression({ property: mockProperty3 })
            });

            const expression = new OperatorExpression({
                operator: '&&',
                left: new PropertyExpression({ property: mockProperty1 }),
                right: innerExpression
            });

            const properties = getProperties(expression);

            expect(properties).toHaveLength(3);
            expect(properties).toContain(mockProperty1);
            expect(properties).toContain(mockProperty2);
            expect(properties).toContain(mockProperty3);
        });

        it('should extract properties from a deeply nested expression', () => {
            const level3Expression = new PropertyExpression({ property: mockProperty3 });

            const level2Expression = new OperatorExpression({
                operator: '&&',
                left: new PropertyExpression({ property: mockProperty2 }),
                right: level3Expression
            });

            const level1Expression = new OperatorExpression({
                operator: '||',
                left: new PropertyExpression({ property: mockProperty1 }),
                right: level2Expression
            });

            const properties = getProperties(level1Expression);

            expect(properties).toHaveLength(3);
            expect(properties).toContain(mockProperty1);
            expect(properties).toContain(mockProperty2);
            expect(properties).toContain(mockProperty3);
        });

        it('should handle expressions with duplicate properties', () => {
            const expression = new OperatorExpression({
                operator: '&&',
                left: new PropertyExpression({ property: mockProperty1 }),
                right: new PropertyExpression({ property: mockProperty1 })
            });

            const properties = getProperties(expression);

            expect(properties).toHaveLength(2);
            expect(properties[0]).toBe(mockProperty1);
            expect(properties[1]).toBe(mockProperty1);
        });

        it('should handle expressions with only value expressions', () => {
            const expression = new ValueExpression({ value: 'test' });

            const properties = getProperties(expression);

            expect(properties).toHaveLength(0);
        });

        it('should handle expressions with mixed property and value expressions', () => {
            const expression = new OperatorExpression({
                operator: '&&',
                left: new PropertyExpression({ property: mockProperty1 }),
                right: new ValueExpression({ value: 'test' })
            });

            const properties = getProperties(expression);

            expect(properties).toHaveLength(1);
            expect(properties[0]).toBe(mockProperty1);
        });

        it('should handle complex expression with multiple operators and properties', () => {
            const leftBranch = new OperatorExpression({
                operator: '&&',
                left: new PropertyExpression({ property: mockProperty1 }),
                right: new PropertyExpression({ property: mockProperty2 })
            });

            const rightBranch = new OperatorExpression({
                operator: '||',
                left: new PropertyExpression({ property: mockProperty3 }),
                right: new ValueExpression({ value: 'default' })
            });

            const rootExpression = new OperatorExpression({
                operator: '&&',
                left: leftBranch,
                right: rightBranch
            });

            const properties = getProperties(rootExpression);

            expect(properties).toHaveLength(3);
            expect(properties).toContain(mockProperty1);
            expect(properties).toContain(mockProperty2);
            expect(properties).toContain(mockProperty3);
        });

        it('should handle expressions with null or undefined children', () => {
            const expression = new ComparatorExpression({
                comparator: 'equals',
                negated: false,
                strict: false,
                left: new PropertyExpression({ property: mockProperty1 }),
                right: null as any
            });

            const properties = getProperties(expression);

            expect(properties).toHaveLength(1);
            expect(properties[0]).toBe(mockProperty1);
        });

        it('should handle NOT_PARSABLE expression', () => {
            const expression = Expression.NOT_PARSABLE;

            const properties = getProperties(expression);

            expect(properties).toHaveLength(0);
        });

        it('should handle a large expression tree with many properties', () => {
            const createProperty = (name: string): PropertyInfo<any> => ({
                getAssignmentPath: () => name,
                type: SchemaTypes.String
            } as PropertyInfo<any>);

            const properties = [
                createProperty('prop1'),
                createProperty('prop2'),
                createProperty('prop3'),
                createProperty('prop4'),
                createProperty('prop5')
            ];

            const expression = new OperatorExpression({
                operator: '&&',
                left: new OperatorExpression({
                    operator: '||',
                    left: new PropertyExpression({ property: properties[0] }),
                    right: new PropertyExpression({ property: properties[1] })
                }),
                right: new OperatorExpression({
                    operator: '&&',
                    left: new PropertyExpression({ property: properties[2] }),
                    right: new OperatorExpression({
                        operator: '||',
                        left: new PropertyExpression({ property: properties[3] }),
                        right: new PropertyExpression({ property: properties[4] })
                    })
                })
            });

            const extractedProperties = getProperties(expression);

            expect(extractedProperties).toHaveLength(5);
            properties.forEach(prop => {
                expect(extractedProperties).toContain(prop);
            });
        });
    });
}); 