import { describe, it, expect, vi } from 'vitest';
import { CommentsTestSuite, EventsTestSuite, ProductTestSuite, executeTests } from 'routier-plugin-testing';
import { PouchDbPlugin } from './PouchDbPlugin';
import { uuidv4 } from 'routier-core';

const testSections = [
    new ProductTestSuite(new PouchDbPlugin(uuidv4()), { expect: expect as any, fn: vi.fn }),
    new EventsTestSuite(new PouchDbPlugin(uuidv4()), { expect: expect as any, fn: vi.fn }),
    new CommentsTestSuite(new PouchDbPlugin(uuidv4()), { expect: expect as any, fn: vi.fn }),
];

describe('PouchDB Plugin Tests', () => {
    executeTests({
        describe,
        expect,
        fn: vi.fn,
        it,
        // debug: {
        //     name: "Can add item with default",
        //     suite: "Add Operations"
        // }
    }, ...testSections);
});