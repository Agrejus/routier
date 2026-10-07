import { describe, expect, it } from '@jest/globals';
import { s } from '@routier/core/schema';
import { RecordIdsBuilder } from './RecordIdsBuilder';

const compositeSchema = s.define('record_ids_composite', {
    tenant: s.string().key(),
    code: s.number().key(),
    label: s.string(),
}).compile();

const untypedSchema = compositeSchema as never;

describe('RecordIdsBuilder.buildFromEntity', () => {

    it('collects every key of a composite key', () => {
        const ids = RecordIdsBuilder.buildFromEntity(untypedSchema, { tenant: 't1', code: 7, label: 'x' });

        expect(ids).toEqual({ tenant: 't1', code: 7 });
    });

    it.each([
        ['undefined', undefined],
        ['null', null],
    ])('leaves out a key whose value is %s', (_, missing) => {
        const ids = RecordIdsBuilder.buildFromEntity(untypedSchema, { tenant: missing, code: 7, label: 'x' });

        expect(ids).toEqual({ code: 7 });
    });
});
