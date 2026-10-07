import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { logger, s } from '@routier/core';
import { convertToDexieSchema } from '../utils';

describe('the nested object warning', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('warns once per schema, naming every nested property', () => {
        const warn = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
        const schema = s.define('nested_warning', {
            id: s.string().key(),
            facts: s.object({ name: s.object({ value: s.string() }), size: s.number() }),
            other: s.object({ flag: s.boolean() }),
        }).compile();

        convertToDexieSchema(schema);

        expect(warn.mock.calls).toEqual([[
            'Dexie does not support querying on nested objects. Collection: nested_warning. Properties: facts.name, facts.name.value, facts.size, other.flag',
        ]]);
    });

    it('does not warn for a schema with nothing nested', () => {
        const warn = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);

        convertToDexieSchema(s.define('flat_warning', { id: s.string().key(), name: s.string() }).compile());

        expect(warn).not.toHaveBeenCalled();
    });
});
