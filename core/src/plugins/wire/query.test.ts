import { describe, expect, it } from '@jest/globals';
import { s } from '../../schema';
import { QueryOptionsCollection } from '../query/QueryOptionsCollection';
import { QueryOrdering } from '../query/types';
import { splitSendableOptions } from './query';

const schema = s.define('wire_sorts', {
    _id: s.string().key(),
    name: s.string(),
}).compile();

const name = schema.getProperty('name');

const sortBy = (isDirectProperty?: boolean) => {
    const options = new QueryOptionsCollection<any>();

    options.add('sort', { selector: (row: any) => row.name, direction: QueryOrdering.Ascending, propertyName: 'name', property: name, isDirectProperty } as never);
    options.add('take', 1);

    return splitSendableOptions(options);
};

describe('splitSendableOptions', () => {

    it('sends a sort that is the property, and the window after it', () => {
        const { sendable, local } = sortBy(true);

        expect(sendable.get('sort')).toHaveLength(1);
        expect(sendable.get('take')).toHaveLength(1);
        expect(local.isEmpty).toBe(true);
    });

    it('sends a sort built from a property rather than a selector', () => {
        expect(sortBy(undefined).sendable.get('sort')).toHaveLength(1);
    });

    /**
     * Sent, it would travel as the property it reads, and the receiver would order by `name` rather than
     * by `name.length`.
     */
    it('keeps a sort by a computed value local, with everything after it', () => {
        const { sendable, local } = sortBy(false);

        expect(sendable.isEmpty).toBe(true);
        expect(local.get('sort')).toHaveLength(1);
        expect(local.get('take')).toHaveLength(1);
    });
});
