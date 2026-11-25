import { describe, expect, it, jest } from '@jest/globals';
import { SchemaCollection } from '@routier/core/collections';
import type { DbPluginQueryEvent } from '@routier/core/plugins';
import { s } from '@routier/core/schema';
import type { CompiledSchema } from '@routier/core/schema';
import type { UnknownRecord } from '@routier/core/utilities';
import { Expression } from '@routier/core/expressions';
import { keyFilter, queryByKeys } from './keyQuery';

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

describe('queryByKeys', () => {
    const schemas = new SchemaCollection();
    const fakePlugin = (answer: (event: DbPluginQueryEvent<UnknownRecord, UnknownRecord>) => PluginEventResultValue) => {
        const events: DbPluginQueryEvent<UnknownRecord, UnknownRecord>[] = [];
        const query = jest.fn((event: DbPluginQueryEvent<UnknownRecord, UnknownRecord>, done: (result: PluginEventResultValue) => void) => {
            events.push(event);
            done(answer(event));
        });

        return { plugin: { databaseName: 'fake', query, bulkPersist: jest.fn(), destroy: jest.fn() } as never, events, query };
    };

    type PluginEventResultValue = { ok: 'success'; data: { forEach: (callback: (row: UnknownRecord | number) => void) => void } } | { ok: 'error'; error: Error };

    it('reads the rows with a plain query from the given source', async () => {
        const { plugin, events } = fakePlugin(() => ({ ok: 'success', data: { forEach: callback => [{ tenant: 'a', id: '1' }, 7].forEach(callback) } }));

        expect(await queryByKeys(plugin, schemas, schema, [{ tenant: 'a', id: '1' }], 'test-source')).toEqual([{ tenant: 'a', id: '1' }]);
        expect(events[0]).toEqual(expect.objectContaining({ schemas, source: 'test-source', action: 'query', explain: false, executedQueries: [] }));
    });

    it('rejects with the plugin error', async () => {
        const failure = new Error('offline');
        const { plugin } = fakePlugin(() => ({ ok: 'error', error: failure }));

        await expect(queryByKeys(plugin, schemas, schema, [{ tenant: 'a', id: '1' }], 'test')).rejects.toBe(failure);
    });

    it('asks nothing for no rows', async () => {
        const { plugin, query } = fakePlugin(() => ({ ok: 'error', error: new Error('unexpected') }));

        expect(await queryByKeys(plugin, schemas, schema, [], 'test')).toEqual([]);
        expect(query).not.toHaveBeenCalled();
    });
});
