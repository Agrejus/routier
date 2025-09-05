import { describe, it, expect, vi } from 'vitest';
import { CommentsTestSuite, EventsTestSuite, ProductTestSuite } from 'routier-plugin-testing';
import { DexiePlugin } from './DexiePlugin';
import { uuidv4 } from '@routier/core';

const testSections = [
    new ProductTestSuite(new DexiePlugin(uuidv4()), { expect: expect as any, fn: vi.fn, debugTestNames: ["Should handle complex sorting and mapping"] }),
    new EventsTestSuite(new DexiePlugin(uuidv4()), { expect: expect as any, fn: vi.fn }),
    new CommentsTestSuite(new DexiePlugin(uuidv4()), { expect: expect as any, fn: vi.fn })
];

describe('Dexie Plugin Tests', () => {
    for (const section of testSections) {
        for (const suite of section.getTestSuites()) {
            describe(suite.name, () => {
                for (const test of suite.testCases) {
                    it(test.name, async () => {
                        await test.execute();
                    });
                }
            });
        }
    }
});