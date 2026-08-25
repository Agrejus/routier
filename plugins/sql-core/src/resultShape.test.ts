import { describe, expect, it } from '@jest/globals';
import { s } from '@routier/core/schema';
import { rawStorageTransferTypes, transferEncodingFor } from '@routier/core/transfer';
import { ResultColumn } from '@routier/core/plugins';
import { entityResultColumns } from './resultShape';

/**
 * Which columns a flat table projects, and under which names.
 *
 * The encoding rules are engine-agnostic and tested in `core/src/transfer/plan.test.ts`. They are
 * applied here only to show a described column carries enough for a consumer to encode it.
 */

const schema = s.define('plan_target', {
    id: s.string().key(),
    name: s.string(),
    price: s.number(),
    createdAt: s.date(),
    nested: s.object({ inner: s.object({ value: s.string() }) }),
    tags: s.array(s.string()),
}).compile();

const encodings = (columns: readonly ResultColumn[]) =>
    Object.fromEntries(columns.map(column => [column.name, transferEncodingFor(column, rawStorageTransferTypes)]));

describe('entityResultColumns', () => {

    it('names the columns in select-list order', () => {
        expect(entityResultColumns(schema as any).map(column => column.name)).toEqual([
            'id', 'name', 'price', 'createdAt', 'nested', 'tags',
        ]);
    });

    it('uses the storage name of a renamed property, not the declared one', () => {
        const renamed = s.define('plan_renamed', {
            id: s.string().key(),
            label: s.string().from('wire_label'),
            count: s.number().from('wire_count'),
        }).compile();

        const columns = entityResultColumns(renamed as any);

        expect(columns.map(column => column.name)).toEqual(['id', 'wire_label', 'wire_count']);
        expect(encodings(columns)).toEqual({ id: 'clone', wire_label: 'clone', wire_count: 'float64' });
    });

    /**
     * Root properties only. A nested subtree is ONE column named for its root, so listing every
     * property would name `inner` and `value` as columns — which do not exist. This is the rule
     * that keeps this function out of core.
     */
    it('emits one json column for a nested object rather than one per descendant', () => {
        const columns = entityResultColumns(schema as any);
        const names = columns.map(column => column.name);

        expect(names).not.toContain('inner');
        expect(names).not.toContain('value');
        expect(encodings(columns).nested).toBe('json');
    });

    it('carries the property through, so the encoding rules can read its serializers', () => {
        const columns = entityResultColumns(schema as any);

        expect(columns.every(column => column.property != null)).toBe(true);
    });
});
