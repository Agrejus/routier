import { describe, expect, it } from '@jest/globals';
import { s } from '@routier/core/schema';
import type { CompiledSchema } from '@routier/core/schema';
import type { UnknownRecord } from '@routier/core/utilities';
import { Expression } from '@routier/core/expressions';
import { keyFilter } from './keyQuery';

const schema: CompiledSchema<UnknownRecord> = s.define('keyQueryRows', {
    tenant: s.string().key(),
    id: s.string().key(),
    title: s.string(),
}).compile() as never;

const filterOf = (rows: UnknownRecord[]) => {
    const [item] = keyFilter(schema, rows).get('filter');

    return item.option.value;
};

describe('keyFilter', () => {
    it('matches a row with every key of one of the rows', () => {
        const { filter } = filterOf([{ tenant: 'a', id: '1' }, { tenant: 'b', id: '2' }]);
        const matches = filter as (row: UnknownRecord) => boolean;

        expect(matches({ tenant: 'a', id: '1', title: 'x' })).toBe(true);
        expect(matches({ tenant: 'b', id: '2', title: 'y' })).toBe(true);
        expect(matches({ tenant: 'a', id: '2', title: 'z' })).toBe(false);
    });

    it('says the same thing as an expression, so a backend can run it', () => {
        expect(Expression.toJson(filterOf([{ tenant: 'a', id: '1' }, { tenant: 'b', id: '2' }]).expression)).toEqual({
            type: 'operator',
            operator: '||',
            left: {
                type: 'operator', operator: '&&',
                left: { type: 'comparator', comparator: 'equals', negated: false, strict: true, left: { type: 'property', path: 'tenant' }, right: { type: 'value', value: 'a' } },
                right: { type: 'comparator', comparator: 'equals', negated: false, strict: true, left: { type: 'property', path: 'id' }, right: { type: 'value', value: '1' } },
            },
            right: {
                type: 'operator', operator: '&&',
                left: { type: 'comparator', comparator: 'equals', negated: false, strict: true, left: { type: 'property', path: 'tenant' }, right: { type: 'value', value: 'b' } },
                right: { type: 'comparator', comparator: 'equals', negated: false, strict: true, left: { type: 'property', path: 'id' }, right: { type: 'value', value: '2' } },
            },
        });
    });
});
