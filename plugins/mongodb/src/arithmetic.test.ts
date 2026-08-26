import { describe, expect, it } from '@jest/globals';
import { toExpression } from '@routier/core/expressions';
import { s } from '@routier/core/schema';
import { toMql } from './mql';

/** The Mongo half of arithmetic. Every case takes `$expr`, since a computed value is not a field. */

const schema = s.define('arithmetic', {
    id: s.string().key(),
    age: s.number(),
    price: s.number(),
    other: s.number(),
}).compile();

const mql = (filter: (entity: any) => boolean) =>
    toMql(toExpression(schema as never, filter as never, undefined as never));

describe('arithmetic operators', () => {

    it('renders modulo as $mod inside $expr', () => {
        expect(mql((x: any) => x.age % 2 === 0))
            .toEqual({ $expr: { $eq: [{ $mod: ['$age', { $literal: 2 }] }, { $literal: 0 }] } });
    });

    it.each([
        ['addition', (x: any) => x.age + 1 > 3, '$add', '$gt', 1, 3],
        ['subtraction', (x: any) => x.age - 1 === 4, '$subtract', '$eq', 1, 4],
        ['multiplication', (x: any) => x.age * 2 > 6, '$multiply', '$gt', 2, 6],
        ['division', (x: any) => x.age / 2 === 5, '$divide', '$eq', 2, 5],
    ])('renders %s', (_, filter, operator, comparator, operand, compared) => {
        expect(mql(filter)).toEqual({
            $expr: { [comparator]: [{ [operator]: ['$age', { $literal: operand }] }, { $literal: compared }] },
        });
    });

    it('renders two properties as two fields', () => {
        expect(mql((x: any) => x.age + x.other === 7))
            .toEqual({ $expr: { $eq: [{ $add: ['$age', '$other'] }, { $literal: 7 }] } });
    });

    it('nests to match JavaScript precedence', () => {
        expect(mql((x: any) => x.age + x.other * 2 === 14)).toEqual({
            $expr: { $eq: [{ $add: ['$age', { $multiply: ['$other', { $literal: 2 }] }] }, { $literal: 14 }] },
        });
    });

    // 3 * 4 has no field in it, so the server is never asked to compute it
    it('folds arithmetic over literals', () => {
        expect(mql((x: any) => x.age + 3 * 4 === 14))
            .toEqual({ $expr: { $eq: [{ $add: ['$age', { $literal: 12 }] }, { $literal: 14 }] } });
    });
});
