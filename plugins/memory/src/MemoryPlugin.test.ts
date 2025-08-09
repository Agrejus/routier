import { describe, it, expect, vi } from 'vitest';
import { CommentsTestSuite, EventsTestSuite, ProductTestSuite } from 'routier-plugin-testing';
import { MemoryPlugin } from './MemoryPlugin';

const testSections = [
    new ProductTestSuite(new MemoryPlugin(), { expect: expect as any, fn: vi.fn }),
    new EventsTestSuite(new MemoryPlugin(), { expect: expect as any, fn: vi.fn }),
    new CommentsTestSuite(new MemoryPlugin(), { expect: expect as any, fn: vi.fn })
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