import { describe, it, expect } from '@jest/globals';
import { childrenOf, forEach, getProperties } from './utils';
import { PropertyExpression, ComparatorExpression, OperatorExpression, ValueExpression, EmptyExpression, CallExpression } from './types';
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
describe('forEach', () => {
    const tree = () => new OperatorExpression({
        operator: '&&',
        left: new ComparatorExpression({
            comparator: 'equals',
            negated: false,
            strict: false,
            left: new PropertyExpression({ property: createMockProperty('a') }),
            right: new ValueExpression({ value: 1 }),
        }),
        right: new ComparatorExpression({
            comparator: 'equals',
            negated: false,
            strict: false,
            left: new PropertyExpression({ property: createMockProperty('b') }),
            right: new ValueExpression({ value: 2 }),
        }),
    });

    it('visits every node depth-first, parent before children, left before right', () => {
        const visited: string[] = [];

        forEach(tree(), expr => {
            visited.push(expr.type === 'property' ? (expr as PropertyExpression).property.name : expr.type);
            return true;
        });

        expect(visited).toEqual(['operator', 'comparator', 'a', 'value', 'comparator', 'b', 'value']);
    });

    it('stops the WHOLE traversal when the callback returns false', () => {
        const visited: string[] = [];

        forEach(tree(), expr => {
            visited.push(expr.type);
            // Stop on the first comparator: neither its children nor the right-hand
            // subtree may be visited afterwards.
            return expr.type !== 'comparator';
        });

        expect(visited).toEqual(['operator', 'comparator']);
    });

    it('stopping inside the left subtree also skips the right subtree', () => {
        const visited: string[] = [];

        forEach(tree(), expr => {
            if (expr.type === 'property') {
                visited.push((expr as PropertyExpression).property.name);
                return false;
            }
            return true;
        });

        expect(visited).toEqual(['a']);
    });

    it('visits a leaf-only expression exactly once', () => {
        const calls: unknown[] = [];

        forEach(new ValueExpression({ value: 42 }), expr => {
            calls.push(expr);
            return true;
        });

        expect(calls).toHaveLength(1);
    });
});

describe('forEach right-link failure propagation', () => {
    it('a stop inside a RIGHT subtree prevents visits to everything after it', () => {
        // The failure has to travel back through a right-child link (the `expr.right`
        // early-return), so the stopping node sits in a right subtree and a later sibling
        // exists to observe the stop.
        const stopHere = new ValueExpression({ value: 'stop' });
        const inner = new OperatorExpression({
            operator: '&&',
            left: new PropertyExpression({ property: createMockProperty('a') }),
            right: stopHere,
        });
        const after = new PropertyExpression({ property: createMockProperty('after') });
        const root = new OperatorExpression({ operator: '&&', left: inner, right: after });

        const visited: string[] = [];

        forEach(root, expr => {
            if (expr === stopHere) {
                visited.push('stop');
                return false;
            }
            visited.push(expr.type === 'property' ? (expr as PropertyExpression).property.name : expr.type);
            return true;
        });

        expect(visited).toEqual(['operator', 'operator', 'a', 'stop']);
    });
});

describe('childrenOf', () => {

    it('returns the two sides of a symmetric node', () => {
        const left = new PropertyExpression({ property: createMockProperty('a') });
        const right = new ValueExpression({ value: 1 });

        expect(childrenOf(new ComparatorExpression({ comparator: 'equals', negated: false, strict: true, left, right })))
            .toEqual([left, right]);
    });

    it('returns the operand and the arguments of a call, operand first', () => {
        const operand = new PropertyExpression({ property: createMockProperty('name') });
        const start = new ValueExpression({ value: 0 });
        const end = new ValueExpression({ value: 2 });

        expect(childrenOf(new CallExpression({ call: 'substring', expression: operand, arguments: [start, end] })))
            .toEqual([operand, start, end]);
    });

    it('returns just the operand for a unary call', () => {
        const operand = new PropertyExpression({ property: createMockProperty('name') });

        expect(childrenOf(new CallExpression({ call: 'to-lower-case', expression: operand })))
            .toEqual([operand]);
    });

    it('treats a call with no arguments array as unary, so a hand-built expression walks', () => {
        const operand = new PropertyExpression({ property: createMockProperty('name') });
        const handBuilt = { type: 'call', call: 'trim', expression: operand } as unknown as CallExpression;

        expect(childrenOf(handBuilt)).toEqual([operand]);
    });

    it('returns nothing for a leaf', () => {
        expect(childrenOf(new ValueExpression({ value: 1 }))).toEqual([]);
        expect(childrenOf(new EmptyExpression())).toEqual([]);
    });
});

describe('walking through a call', () => {

    const nameUnderTwoCalls = (): CallExpression => new CallExpression({
        call: 'to-lower-case',
        expression: new CallExpression({
            call: 'trim',
            expression: new PropertyExpression({ property: createMockProperty('name') }),
        }),
    });

    it('getProperties reaches a property nested inside a call', () => {
        expect(getProperties(nameUnderTwoCalls()).map(p => p.name)).toEqual(['name']);
    });

    it('getProperties reaches a property held only in a call argument', () => {
        const expression = new CallExpression({
            call: 'index-of',
            expression: new PropertyExpression({ property: createMockProperty('haystack') }),
            arguments: [new PropertyExpression({ property: createMockProperty('needle') })],
        });

        expect(getProperties(expression).map(p => p.name)).toEqual(['haystack', 'needle']);
    });

    it('forEach visits a property inside a call, which is what cuts a query over to memory', () => {
        const visited: string[] = [];

        forEach(nameUnderTwoCalls(), expression => {
            visited.push(expression.type === 'property' ? (expression as PropertyExpression).property.name : expression.type);
            return true;
        });

        expect(visited).toEqual(['call', 'call', 'name']);
    });

    it('forEach stops descending a call when the callback returns false', () => {
        const visited: string[] = [];

        forEach(nameUnderTwoCalls(), expression => {
            visited.push(expression.type);
            return expression.type !== 'call';
        });

        expect(visited).toEqual(['call']);
    });
});
