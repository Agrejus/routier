import { describe, expect, it } from '@jest/globals';
import { toExpression } from '@routier/core/expressions';
import { Query, QueryOptionsCollection } from '@routier/core/plugins';
import { s } from '@routier/core/schema';
import { ChangeMatchProbe } from './ChangeMatchProbe';

const schema = s.define('probe_renamed', {
    id: s.string().key(),
    label: s.string().from('wire_label'),
}).compile();

const probeFor = (filter: (row: any) => boolean) => {
    const options = new QueryOptionsCollection<any>();
    options.add('filter', { filter, params: null, expression: toExpression(schema as never, filter as never, undefined as never) } as never);

    return {
        options,
        event: {
            id: 'probe',
            schemas: new Map() as never,
            source: 'test',
            action: 'query',
            operation: new Query(options, schema as never),
            explain: false,
            executedQueries: []
        } as never
    };
};

/**
 * The probe is seeded with rows the broadcast already deserialized, so they carry in-memory names
 * rather than `from` names. It answers a filter on a renamed property itself: handing it back, as a
 * plugin over stored rows does, answered with every seeded row and made every change a re-query.
 */
describe('ChangeMatchProbe over a renamed property', () => {
    it('keeps only the seeded rows the filter matches', () => {
        const probe = new ChangeMatchProbe('probe');
        probe.seed(schema, [{ id: 'r1', label: 'alpha' }, { id: 'r2', label: 'bravo' }]);

        const { options, event } = probeFor(row => row.label === 'bravo');
        let found: any[] | null = null;

        probe.query(event, result => {
            if (result.ok === 'error') {
                throw result.error;
            }

            found = result.data.value as any[];
        });

        expect(found).toEqual([{ id: 'r2', label: 'bravo' }]);
        expect(options.notExecuted()).toEqual([]);
    });
});
