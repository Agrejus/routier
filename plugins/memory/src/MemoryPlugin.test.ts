import { describe, it, expect, vi } from 'vitest';
import { CommentsTestSuite, EventsTestSuite, ProductTestSuite } from 'routier-plugin-testing';
import { MemoryPlugin } from './MemoryPlugin';
import { uuidv4 } from 'routier-core';

const testSections = [
    new ProductTestSuite(new MemoryPlugin(uuidv4()), { expect: expect as any, fn: vi.fn, debugTestNames: ["Should preview changes when entities are added"] }),
    new EventsTestSuite(new MemoryPlugin(uuidv4()), { expect: expect as any, fn: vi.fn }),
    new CommentsTestSuite(new MemoryPlugin(uuidv4()), { expect: expect as any, fn: vi.fn })
];

describe('Memory Plugin Tests', () => {
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