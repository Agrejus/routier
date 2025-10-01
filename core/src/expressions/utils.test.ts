import { describe, it, expect } from '@jest/globals';
import { getProperties } from './utils';
import { PropertyExpression, ComparatorExpression, OperatorExpression, ValueExpression, EmptyExpression } from './types';
import { PropertyInfo } from '../schema/PropertyInfo';

const createMockProperty = (name: string): PropertyInfo<any> => ({
    name,
    type: 'string',
    isNullable: false,
    isOptional: false,
    isKey: false,
    isIdentity: false,
    isReadonly: false,
    isUnmapped: false,
    isDistinct: false,
    indexes: [],
    injected: null,
    defaultValue: null,
    valueSerializer: null,
    valueDeserializer: null,
    functionBody: null,
    children: [],
    schema: {} as any,
    literals: [],
    getPathArray: () => [name],
    getParentPathArray: () => [] as any[],
    getValue: () => undefined as any,
    setValue: () => { },
    getSelectrorPath: () => name,
    getAssignmentPath: () => name,
    get level() { return 0; },
    get hasNullableParents() { return false; },
    get hasIdentityChildren() { return false; },
    get id() { return name; },
    _getPropertyChain: () => [] as any[],
    _needsOptionalChaining: () => false,
    _resolvePathArray: () => [name]
} as unknown as PropertyInfo<any>);

describe('getProperties', () => {
    it('should extract properties from a simple property expression', () => {
        const property = createMockProperty('name');
        const expression = new PropertyExpression({ property });

        const result = getProperties(expression);

        expect(result).toHaveLength(1);
        expect(result[0]).toBe(property);
    });

    it('should extract properties from a comparator expression with property on left', () => {
        const property = createMockProperty('age');
        const expression = new ComparatorExpression({
            comparator: 'equals',
            negated: false,
            strict: false,
            left: new PropertyExpression({ property }),
            right: new ValueExpression({ value: 25 })
        });

        const result = getProperties(expression);

        expect(result).toHaveLength(1);
        expect(result[0]).toBe(property);
    });

    it('should extract properties from a comparator expression with property on right', () => {
        const property = createMockProperty('score');
        const expression = new ComparatorExpression({
            comparator: 'greater-than',
            negated: false,
            strict: false,
            left: new ValueExpression({ value: 100 }),
            right: new PropertyExpression({ property })
        });

        const result = getProperties(expression);

        expect(result).toHaveLength(1);
        expect(result[0]).toBe(property);
    });

    it('should extract properties from a comparator expression with properties on both sides', () => {
        const leftProperty = createMockProperty('x');
        const rightProperty = createMockProperty('y');
        const expression = new ComparatorExpression({
            comparator: 'equals',
            negated: false,
            strict: false,
            left: new PropertyExpression({ property: leftProperty }),
            right: new PropertyExpression({ property: rightProperty })
        });

        const result = getProperties(expression);

        expect(result).toHaveLength(2);
        expect(result).toContain(leftProperty);
        expect(result).toContain(rightProperty);
    });

    it('should extract properties from an operator expression with two properties', () => {
        const leftProperty = createMockProperty('isActive');
        const rightProperty = createMockProperty('isVerified');
        const expression = new OperatorExpression({
            operator: '&&',
            left: new PropertyExpression({ property: leftProperty }),
            right: new PropertyExpression({ property: rightProperty })
        });

        const result = getProperties(expression);

        expect(result).toHaveLength(2);
        expect(result).toContain(leftProperty);
        expect(result).toContain(rightProperty);
    });

    it('should extract properties from a complex nested expression', () => {
        const prop1 = createMockProperty('name');
        const prop2 = createMockProperty('age');
        const prop3 = createMockProperty('email');

        const innerExpression = new OperatorExpression({
            operator: '||',
            left: new PropertyExpression({ property: prop2 }),
            right: new PropertyExpression({ property: prop3 })
        });

        const expression = new OperatorExpression({
            operator: '&&',
            left: new PropertyExpression({ property: prop1 }),
            right: innerExpression
        });

        const result = getProperties(expression);

        expect(result).toHaveLength(3);
        expect(result).toContain(prop1);
        expect(result).toContain(prop2);
        expect(result).toContain(prop3);
    });

    it('should extract properties from a deeply nested expression', () => {
        const prop1 = createMockProperty('level1');
        const prop2 = createMockProperty('level2');
        const prop3 = createMockProperty('level3');

        const level3Expression = new PropertyExpression({ property: prop3 });

        const level2Expression = new OperatorExpression({
            operator: '&&',
            left: new PropertyExpression({ property: prop2 }),
            right: level3Expression
        });

        const level1Expression = new OperatorExpression({
            operator: '||',
            left: new PropertyExpression({ property: prop1 }),
            right: level2Expression
        });

        const result = getProperties(level1Expression);

        expect(result).toHaveLength(3);
        expect(result).toContain(prop1);
        expect(result).toContain(prop2);
        expect(result).toContain(prop3);
    });

    it('should handle expressions with duplicate properties', () => {
        const property = createMockProperty('status');
        const expression = new OperatorExpression({
            operator: '&&',
            left: new PropertyExpression({ property }),
            right: new PropertyExpression({ property })
        });

        const result = getProperties(expression);

        expect(result).toHaveLength(2);
        expect(result[0]).toBe(property);
        expect(result[1]).toBe(property);
    });

    it('should handle expressions with only value expressions', () => {
        const expression = new ValueExpression({ value: 'test' });

        const result = getProperties(expression);

        expect(result).toHaveLength(0);
    });

    it('should handle expressions with mixed property and value expressions', () => {
        const property = createMockProperty('category');
        const expression = new OperatorExpression({
            operator: '&&',
            left: new PropertyExpression({ property }),
            right: new ValueExpression({ value: 'electronics' })
        });

        const result = getProperties(expression);

        expect(result).toHaveLength(1);
        expect(result[0]).toBe(property);
    });

    it('should handle expressions with null or undefined children', () => {
        const property = createMockProperty('title');
        const expression = new ComparatorExpression({
            comparator: 'equals',
            negated: false,
            strict: false,
            left: new PropertyExpression({ property }),
            right: null as any
        });

        const result = getProperties(expression);

        expect(result).toHaveLength(1);
        expect(result[0]).toBe(property);
    });

    it('should handle empty expression', () => {
        const expression = new EmptyExpression();

        const result = getProperties(expression);

        expect(result).toHaveLength(0);
    });

    it('should handle complex expression with multiple operators and properties', () => {
        const prop1 = createMockProperty('firstName');
        const prop2 = createMockProperty('lastName');
        const prop3 = createMockProperty('email');
        const prop4 = createMockProperty('phone');

        const leftBranch = new OperatorExpression({
            operator: '&&',
            left: new PropertyExpression({ property: prop1 }),
            right: new PropertyExpression({ property: prop2 })
        });

        const rightBranch = new OperatorExpression({
            operator: '||',
            left: new PropertyExpression({ property: prop3 }),
            right: new PropertyExpression({ property: prop4 })
        });

        const rootExpression = new OperatorExpression({
            operator: '&&',
            left: leftBranch,
            right: rightBranch
        });

        const result = getProperties(rootExpression);

        expect(result).toHaveLength(4);
        expect(result).toContain(prop1);
        expect(result).toContain(prop2);
        expect(result).toContain(prop3);
        expect(result).toContain(prop4);
    });

    it('should handle a large expression tree with many properties', () => {
        const properties = [
            createMockProperty('prop1'),
            createMockProperty('prop2'),
            createMockProperty('prop3'),
            createMockProperty('prop4'),
            createMockProperty('prop5')
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

        const result = getProperties(expression);

        expect(result).toHaveLength(5);
        properties.forEach(prop => {
            expect(result).toContain(prop);
        });
    });

    it('should handle expressions with only non-property expressions', () => {
        const expression = new OperatorExpression({
            operator: '&&',
            left: new ValueExpression({ value: true }),
            right: new ValueExpression({ value: false })
        });

        const result = getProperties(expression);

        expect(result).toHaveLength(0);
    });

    it('should handle expressions with one property and one non-property', () => {
        const property = createMockProperty('enabled');
        const expression = new OperatorExpression({
            operator: '&&',
            left: new PropertyExpression({ property }),
            right: new ValueExpression({ value: true })
        });

        const result = getProperties(expression);

        expect(result).toHaveLength(1);
        expect(result[0]).toBe(property);
    });

    it('should preserve order of properties as they appear in traversal', () => {
        const prop1 = createMockProperty('a');
        const prop2 = createMockProperty('b');
        const prop3 = createMockProperty('c');

        const expression = new OperatorExpression({
            operator: '&&',
            left: new PropertyExpression({ property: prop1 }),
            right: new OperatorExpression({
                operator: '||',
                left: new PropertyExpression({ property: prop2 }),
                right: new PropertyExpression({ property: prop3 })
            })
        });

        const result = getProperties(expression);

        expect(result).toHaveLength(3);
        expect(result[0]).toBe(prop1);
        expect(result[1]).toBe(prop2);
        expect(result[2]).toBe(prop3);
    });
}); 