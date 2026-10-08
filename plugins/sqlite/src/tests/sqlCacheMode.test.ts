import { describe, expect, it, jest } from '@jest/globals';
import type * as QueryCache from '../queryCache';

const modes: QueryCache.SqlCacheMode[] = [];

jest.mock('../queryCache', () => {
    const actual = jest.requireActual<typeof QueryCache>('../queryCache');

    class RecordingCache extends actual.SqlFrameCache {
        constructor(mode: QueryCache.SqlCacheMode) {
            super(mode);
            modes.push(mode);
        }
    }

    return { ...actual, SqlFrameCache: RecordingCache };
});

import { SqliteDbPlugin } from '../index';

describe('the plugin\'s SQL cache mode', () => {
    it.each<[string, { sqlCache?: QueryCache.SqlCacheMode }, QueryCache.SqlCacheMode]>([
        ['defaults to shadow', {}, 'shadow'],
        ['passes an explicit mode through', { sqlCache: 'on' }, 'on'],
    ])('%s', (_label, options, expected) => {
        modes.length = 0;

        new SqliteDbPlugin('unused.sqlite', options);

        expect(modes).toEqual([expected]);
    });
});
