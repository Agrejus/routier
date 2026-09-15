import { describe, expect, it } from '@jest/globals';
import { s } from '../builder';
import { getStorageDateReviver } from './storageDates';

const schema = s.define('storage_dates', {
    id: s.string().key().identity(),
    label: s.string().from('wire_label'),
    createdDate: s.date(),
    dueDate: s.date().from('wire_due'),
    closedDate: s.date().nullable(),
    window: s.object({ opens: s.date().from('wire_opens') }).from('wire_window'),
    maybe: s.object({ at: s.date() }).optional(),
    history: s.array(s.date()),
    custom: s.date().serialize(value => value.getTime() as never).deserialize(value => new Date(value)),
}).compile();

const stored = () => ({
    id: 'a',
    wire_label: '2024-01-01T00:00:00.000Z',
    createdDate: '2024-01-01T00:00:00.000Z',
    wire_due: '2025-02-02T00:00:00.000Z',
    closedDate: null as string | null,
    wire_window: { wire_opens: '2026-03-03T00:00:00.000Z' },
    history: ['2020-01-01T00:00:00.000Z', '2021-01-01T00:00:00.000Z'],
    custom: 1700000000000,
} as Record<string, any>);

describe('getStorageDateReviver', () => {

    it('revives dates at their storage paths, and moves no key', () => {
        const record = stored();

        getStorageDateReviver(schema)!(record);

        expect(record.createdDate).toEqual(new Date('2024-01-01T00:00:00.000Z'));
        expect(record.wire_due).toEqual(new Date('2025-02-02T00:00:00.000Z'));
        expect(record.wire_window.wire_opens).toEqual(new Date('2026-03-03T00:00:00.000Z'));
        expect(record.history).toEqual([new Date('2020-01-01T00:00:00.000Z'), new Date('2021-01-01T00:00:00.000Z')]);
        expect(Object.keys(record).sort()).toEqual(Object.keys(stored()).sort());
    });

    it('leaves a string property, a null, an absent parent and a custom-serialized date alone', () => {
        const record = stored();

        getStorageDateReviver(schema)!(record);

        expect(record.wire_label).toBe('2024-01-01T00:00:00.000Z');
        expect(record.closedDate).toBeNull();
        expect(record).not.toHaveProperty('maybe');
        expect(record.custom).toBe(1700000000000);
    });

    it('is a no-op on a record already revived', () => {
        const record = stored();
        const reviver = getStorageDateReviver(schema)!;

        reviver(record);
        const created = record.createdDate;
        reviver(record);

        expect(record.createdDate).toBe(created);
    });

    it('deserializes a revived record to the same entity as the stored one', () => {
        const revived = stored();
        getStorageDateReviver(schema)!(revived);

        expect(schema.deserialize(revived as never)).toEqual(schema.deserialize(stored() as never));
    });

    it('is null for a schema with no dates, and built once per schema', () => {
        const plain = s.define('storage_no_dates', { id: s.string().key(), name: s.string() }).compile();

        expect(getStorageDateReviver(plain)).toBeNull();
        expect(getStorageDateReviver(schema)).toBe(getStorageDateReviver(schema));
    });
});
